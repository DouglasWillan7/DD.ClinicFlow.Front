import { getApiUrl } from "../../api/client";

export type CaptureConnectionState = "connecting" | "connected" | "degraded" | "closed";
export interface MicrophoneCaptureCallbacks {
  onConnectionState?(state: CaptureConnectionState): void;
  onDeviceLost?(): void;
  onError?(error: Error): void;
}

interface BufferedFrame { sequence: number; bytes: ArrayBuffer }

export class MicrophoneCaptureService {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private socket: WebSocket | null = null;
  private sequence = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private unacknowledged: BufferedFrame[] = [];
  private reconnectTimer: number | null = null;
  private stopping = false;
  private terminalError = false;
  private readonly maxBufferedFrames = 100;

  constructor(
    private readonly sessionId: string,
    private readonly accessToken: () => string,
    private readonly callbacks: MicrophoneCaptureCallbacks = {},
  ) {}

  async start() {
    this.stopping = false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
      } });
    } catch (cause) {
      throw new Error(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Permissão do microfone negada. Libere o acesso para iniciar a gravação."
        : "Nenhum microfone disponível para a gravação.", { cause });
    }
    this.context = new AudioContext();
    await this.context.audioWorklet.addModule("/transcription-audio-worklet.js");
    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "clinicflow-pcm16", { processorOptions: { chunkMilliseconds: 100 } });
    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => this.sendAudio(event.data);
    this.source.connect(this.worklet);
    this.stream.getAudioTracks().forEach((track) => { track.onended = () => this.callbacks.onDeviceLost?.(); });
    this.startedAt = performance.now();
    await this.connect();
  }

  async pause() { if (this.context?.state === "running") { await this.context.suspend(); this.pausedAt = performance.now(); } }
  async resume() { if (this.context?.state === "suspended") { this.pausedDuration += performance.now() - this.pausedAt; await this.context.resume(); } }

  private async connect() {
    this.callbacks.onConnectionState?.("connecting");
    const url = new URL(getApiUrl(`/transcription-sessions/${this.sessionId}/audio`));
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("access_token", this.accessToken());
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "audio.config", encoding: "linear16", sampleRate: this.context!.sampleRate, channels: 1 }));
        for (const frame of this.unacknowledged) socket.send(frame.bytes);
        this.callbacks.onConnectionState?.("connected"); resolve();
      };
      socket.onerror = () => reject(new Error("Não foi possível abrir o canal de áudio."));
      socket.onmessage = (event) => this.receiveAck(event.data);
      socket.onclose = () => { if (!this.stopping && !this.terminalError) this.scheduleReconnect(); };
    });
  }

  private sendAudio(payload: ArrayBuffer) {
    const sequence = ++this.sequence;
    const frame = new ArrayBuffer(16 + payload.byteLength);
    const view = new DataView(frame);
    view.setBigInt64(0, BigInt(sequence), true);
    view.setBigInt64(8, BigInt(Math.max(0, Math.round(performance.now() - this.startedAt - this.pausedDuration))), true);
    new Uint8Array(frame, 16).set(new Uint8Array(payload));
    this.unacknowledged.push({ sequence, bytes: frame });
    if (this.unacknowledged.length > this.maxBufferedFrames) {
      this.unacknowledged.shift(); this.callbacks.onConnectionState?.("degraded");
    }
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(frame);
  }

  private receiveAck(raw: unknown) {
    if (typeof raw !== "string") return;
    try {
      const message = JSON.parse(raw) as { type?: string; sequence?: number; message?: string };
      if (message.type === "audio.error") {
        this.terminalError = true;
        this.callbacks.onConnectionState?.("degraded");
        this.callbacks.onError?.(new Error(message.message ?? "O provider de transcrição não está configurado."));
        return;
      }
      if (message.type === "audio.ack" && typeof message.sequence === "number")
        this.unacknowledged = this.unacknowledged.filter((frame) => frame.sequence > message.sequence!);
    } catch { /* eventos desconhecidos não afetam o áudio */ }
  }

  private scheduleReconnect() {
    this.callbacks.onConnectionState?.("degraded");
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error: Error) => { this.callbacks.onError?.(error); this.scheduleReconnect(); });
    }, 1_500);
  }

  async stop() {
    this.stopping = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.close(1000, "capture finished");
    this.worklet?.disconnect(); this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.socket = null; this.worklet = null; this.source = null; this.stream = null; this.context = null;
    this.callbacks.onConnectionState?.("closed");
  }
}
