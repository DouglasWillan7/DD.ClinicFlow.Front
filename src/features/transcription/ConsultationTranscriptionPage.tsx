import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, Circle, Mic, Pause, Play, Square } from "lucide-react";
import { createRef, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment, ConsultationTranscript, TranscriptSegment, TranscriptSpeakerRole, TranscriptionEvent, TranscriptionSession } from "../../api/types";
import { getApiUrl } from "../../api/client";
import { Link } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { hasRole } from "../../auth/roles";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { appointmentTypeLabels } from "../appointments/appointmentLabels";
import { ImportantPointsPanel } from "./ImportantPointsPanel";
import type { ConsultationImportantPoint, ImportantPointEvidence } from "./importantPoints";
import { MicrophoneCaptureService, type CaptureConnectionState } from "./MicrophoneCaptureService";
import { mergeEvidenceRanges, renderTranscriptText, selectFirstEvidence } from "./transcriptEvidence";
import styles from "./ConsultationTranscriptionPage.module.css";

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatAppointmentDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function speakerKey(streamNumber: number, speakerTag: number) { return `${streamNumber}:${speakerTag}`; }

interface VoiceSummary {
  key: string;
  streamNumber: number;
  speakerTag: number;
  role: TranscriptSpeakerRole;
  segmentCount: number;
}

export function ConsultationTranscriptionPage({ appointmentId }: { appointmentId: string }) {
  const { request, session: auth } = useAuth();
  const queryClient = useQueryClient();
  const appointment = useQuery({ queryKey: ["appointments", "detail", appointmentId], queryFn: () => request<Appointment>(`/appointments/${appointmentId}`) });
  const transcript = useQuery({ queryKey: ["transcription", appointmentId], queryFn: () => request<ConsultationTranscript>(`/consultations/${appointmentId}/transcription`) });
  const [liveSession, setSession] = useState<TranscriptionSession | null>(null);
  const [liveSegments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [partial, setPartial] = useState<TranscriptionEvent | null>(null);
  const [connection, setConnection] = useState<CaptureConnectionState>("closed");
  const [error, setError] = useState<string | null>(null);
  const [correctingSpeaker, setCorrectingSpeaker] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const captureRef = useRef<MicrophoneCaptureService | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const evidenceTimeoutRef = useRef<number | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<{
    pointId: string;
    evidence: ImportantPointEvidence[];
  } | null>(null);

  const session = liveSession ?? transcript.data?.session ?? null;
  const { refetch: refetchTranscript } = transcript;
  const segments = useMemo(() => [...(liveSegments ?? transcript.data?.segments ?? [])]
    .sort((a, b) => a.startTimeMs - b.startTimeMs || a.sequence - b.sequence), [liveSegments, transcript.data?.segments]);
  const segmentRefs = useMemo(() => new Map(segments.map((segment) => [segment.id, createRef<HTMLElement>()])), [segments]);
  const display = useMemo(() => [...segments, ...(partial ? [{ id: "partial", sequence: partial.sequence, providerStreamNumber: partial.streamNumber,
    providerSpeakerTag: partial.speakerTag, speakerRole: partial.speakerRole, startTimeMs: partial.startTimeMs,
    endTimeMs: partial.endTimeMs, text: partial.text }] : [])], [partial, segments]);
  const voices = useMemo(() => {
    const detected = new Map<string, VoiceSummary>();
    for (const item of display) {
      if (item.providerSpeakerTag === null) continue;
      const key = speakerKey(item.providerStreamNumber, item.providerSpeakerTag);
      const current = detected.get(key);
      detected.set(key, {
        key,
        streamNumber: item.providerStreamNumber,
        speakerTag: item.providerSpeakerTag,
        role: item.speakerRole === "Unknown" ? current?.role ?? "Unknown" : item.speakerRole,
        segmentCount: (current?.segmentCount ?? 0) + (item.id === "partial" ? 0 : 1),
      });
    }
    return [...detected.values()].sort((a, b) => a.streamNumber - b.streamNumber || a.speakerTag - b.speakerTag);
  }, [display]);
  useEffect(() => {
    if (!auth) return;
    const hub = new HubConnectionBuilder().withUrl(getApiUrl("/hubs/transcription"), { accessTokenFactory: () => auth.tokens.accessToken })
      .withAutomaticReconnect().configureLogging(LogLevel.None).build();
    hub.on("TranscriptionPartial", (event: TranscriptionEvent) => setPartial(event));
    hub.on("TranscriptionFinal", (event: TranscriptionEvent) => {
      setPartial(null);
      if (!event.segmentId) {
        void refetchTranscript();
        return;
      }
      const segmentId = event.segmentId;
      setSegments((current) => [...(current ?? transcript.data?.segments ?? []).filter((item) => item.id !== segmentId), {
        id: segmentId, sequence: event.sequence, providerStreamNumber: event.streamNumber,
        providerSpeakerTag: event.speakerTag, speakerRole: event.speakerRole, startTimeMs: event.startTimeMs,
        endTimeMs: event.endTimeMs, text: event.text,
      }].sort((a, b) => a.startTimeMs - b.startTimeMs || a.sequence - b.sequence));
    });
    hub.on("TranscriptionPaused", () => setSession((value) => value ? { ...value, status: "Paused" } : value));
    hub.on("TranscriptionResumed", () => setSession((value) => value ? { ...value, status: "Recording" } : value));
    hub.on("TranscriptionCompleted", () => setSession((value) => value ? { ...value, status: "Completed", endedAtUtc: new Date().toISOString() } : value));
    hub.on("TranscriptionError", () => { setConnection("degraded"); setError("A transcrição está em recuperação. O áudio recebido foi preservado."); });
    hub.on("importantPointsUpdated", (event: { appointmentId: string }) => {
      if (event.appointmentId !== appointmentId) return;
      void queryClient.invalidateQueries({
        queryKey: ["consultation-important-points", appointmentId],
      });
    });
    void hub.start().then(() => hub.invoke("JoinConsultation", appointmentId), () => setError("Eventos ao vivo desconectados. Tentando reconectar…"));
    return () => { void hub.stop(); };
  }, [appointmentId, auth, queryClient, refetchTranscript, transcript.data?.segments]);

  useEffect(() => {
    if (!session || session.status === "Completed" || session.status === "Failed") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer);
  }, [session]);
  useEffect(() => {
    const element = transcriptRef.current; if (!element || !autoScrollRef.current) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [partial, segments]);
  useEffect(() => () => {
    void captureRef.current?.stop();
    if (evidenceTimeoutRef.current !== null) window.clearTimeout(evidenceTimeoutRef.current);
  }, []);

  const navigateToEvidence = (point: ConsultationImportantPoint) => {
    const firstEvidence = selectFirstEvidence(point.evidence);
    if (!firstEvidence) return;
    const container = transcriptRef.current;
    const target = segmentRefs.get(firstEvidence.segmentId)?.current;
    if (!container || !target) return;

    if (evidenceTimeoutRef.current !== null) window.clearTimeout(evidenceTimeoutRef.current);
    setActiveEvidence({ pointId: point.id, evidence: point.evidence });
    autoScrollRef.current = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: Math.max(0, target.offsetTop - container.offsetTop - 12),
      behavior: reducedMotion ? "auto" : "smooth",
    });
    target.focus({ preventScroll: true });
    evidenceTimeoutRef.current = window.setTimeout(() => {
      setActiveEvidence(null);
      evidenceTimeoutRef.current = null;
    }, 1_500);
  };

  const elapsed = session ? (session.endedAtUtc ? new Date(session.endedAtUtc).getTime() : now || new Date(session.startedAtUtc).getTime()) - new Date(session.startedAtUtc).getTime() : 0;
  const status = session?.status ?? "idle";
  const statusCopy = useMemo(() => {
    if (status === "Recording") return connection === "degraded" ? "Reconectando" : "Gravando";
    if (status === "Paused") return "Pausada";
    if (status === "Starting") return "Iniciando";
    if (status === "Recovering") return "Recuperando";
    if (status === "StopRequested" || status === "Draining") return "Finalizando";
    if (status === "Completed") return "Finalizada";
    if (status === "Failed") return "Falha na transcrição";
    return "Pronta para iniciar";
  }, [connection, status]);

  async function start() {
    setError(null);
    try {
      const active = await request<TranscriptionSession>(`/consultations/${appointmentId}/transcription/start`, { method: "POST" });
      setSession(active);
      const capture = new MicrophoneCaptureService(active.id, () => auth!.tokens.accessToken, {
        onConnectionState: setConnection,
        onDeviceLost: () => setError("O microfone foi desconectado. Pause a consulta e escolha outro dispositivo."),
        onError: (value) => setError(value.message),
      });
      captureRef.current = capture; await capture.start();
      setSession((value) => value ? { ...value, status: "Recording" } : value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a gravação."); await captureRef.current?.stop(); captureRef.current = null; }
  }
  async function pause() { if (!session) return; await captureRef.current?.pause(); await request(`/transcription-sessions/${session.id}/pause`, { method: "POST" }); setSession({ ...session, status: "Paused" }); }
  async function resume() { if (!session) return; await request(`/transcription-sessions/${session.id}/resume`, { method: "POST" }); await captureRef.current?.resume(); setSession({ ...session, status: "Recording" }); }
  async function finish() {
    if (!session) return; setSession({ ...session, status: "StopRequested" }); await captureRef.current?.stop(); captureRef.current = null;
    try { await request(`/transcription-sessions/${session.id}/finish`, { method: "POST" }); setSession((value) => value ? { ...value, status: "Completed", endedAtUtc: new Date().toISOString() } : value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível finalizar."); }
  }
  async function correctSpeaker(streamNumber: number, speakerTag: number, role: Exclude<TranscriptSpeakerRole, "Unknown">) {
    if (!session) return;
    const key = `${streamNumber}:${speakerTag}`;
    setCorrectingSpeaker(key); setError(null);
    try {
      await request(`/transcription-sessions/${session.id}/speaker`, {
        method: "PUT",
        body: JSON.stringify({ providerStreamNumber: streamNumber, providerSpeakerTag: speakerTag, role }),
      });
      setSegments((current) => (current ?? transcript.data?.segments ?? []).map((item) =>
        item.providerStreamNumber === streamNumber && item.providerSpeakerTag === speakerTag
          ? { ...item, speakerRole: role }
          : item));
      setPartial((current) => current?.streamNumber === streamNumber && current.speakerTag === speakerTag
        ? { ...current, speakerRole: role }
        : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível identificar esta voz.");
    } finally {
      setCorrectingSpeaker((current) => current === key ? null : current);
    }
  }

  if (appointment.isLoading || transcript.isLoading) return <LoadingBlock label="Abrindo a consulta…" />;
  if (appointment.isError || transcript.isError || !appointment.data) return <ErrorBlock message="Não foi possível abrir a consulta." retry={() => { void appointment.refetch(); void transcript.refetch(); }} />;
  const doctorName = auth?.name?.trim() || "Médico";
  const appointmentDate = formatAppointmentDate(appointment.data.startUtc);
  const plannedMinutes = Math.max(0, Math.round((new Date(appointment.data.endUtc).getTime() - new Date(appointment.data.startUtc).getTime()) / 60_000));
  const statusState = status === "Recording" && connection !== "degraded" ? "recording"
    : status === "Paused" ? "paused"
      : status === "Completed" ? "completed"
        : status === "Failed" ? "failed"
          : status === "idle" ? "idle" : "processing";
  const voiceNumberByKey = new Map(voices.map((voice, index) => [voice.key, index + 1]));
  const isDoctor = hasRole(auth, "Doctor");
  const unknownSegmentCount = segments.filter((item) => item.speakerRole === "Unknown").length;

  const displayNameFor = (role: TranscriptSpeakerRole, streamNumber: number, tag: number | null) => {
    if (role === "Doctor") return doctorName;
    if (role === "Patient") return appointment.data.patientName;
    if (tag === null) return "Voz não identificada";
    return `Voz ${voiceNumberByKey.get(speakerKey(streamNumber, tag)) ?? ""} · não identificada`;
  };

  return <main className={styles.page}>
    <header className={styles.contextHeader}>
      <div className={styles.contextNavigation}>
        <Link className={styles.backButton} to={`/app/pacientes/${appointment.data.patientId}`} aria-label={`Voltar para ${appointment.data.patientName}`}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
          <Link to="/app/pacientes">Pacientes</Link><span aria-hidden="true">›</span>
          <Link to={`/app/pacientes/${appointment.data.patientId}`}>{appointment.data.patientName}</Link><span aria-hidden="true">›</span>
          <strong aria-current="page">Consulta em andamento</strong>
        </nav>
      </div>
      <div className={styles.actions} aria-label="Ações da transcrição">
        {!session || status === "Failed" ? <Button onClick={() => void start()}><Mic aria-hidden="true" /> Iniciar gravação</Button> : null}
        {status === "Recording" ? <Button variant="secondary" onClick={() => void pause()}><Pause aria-hidden="true" /> Pausar</Button> : null}
        {status === "Paused" ? <Button variant="secondary" onClick={() => void resume()}><Play aria-hidden="true" /> Retomar</Button> : null}
        {session && ["Recording", "Paused"].includes(status) ? <Button onClick={() => void finish()}><Square aria-hidden="true" /> Finalizar consulta</Button> : null}
        {status === "Completed" ? <span className={styles.completedBadge}><Check aria-hidden="true" /> Consulta finalizada</span> : null}
      </div>
    </header>
    <div className={styles.contentGrid}>
      <section className={styles.transcriptPanel} aria-labelledby="transcript-title">
        <div className={styles.panelHeading}>
          <div><h1 id="transcript-title">Transcrição da consulta</h1><p>{appointmentTypeLabels[appointment.data.type]} · {appointmentDate}</p></div>
          <div className={styles.status} data-state={statusState} role="status" aria-live="polite">
            {statusState === "completed" ? <Check aria-hidden="true" /> : statusState === "failed" ? <AlertCircle aria-hidden="true" /> : <Circle fill="currentColor" aria-hidden="true" />}
            <strong>{statusCopy}</strong>{session ? <time>{formatTime(elapsed)}</time> : null}
            {statusState === "recording" ? <span className={styles.equalizer} aria-hidden="true">{[0, 1, 2, 3, 4].map((bar) => <i key={bar} />)}</span> : null}
          </div>
        </div>
        <div className={styles.legend} aria-label="Participantes da transcrição">
          <span><i data-role="doctor" />{doctorName} — médico</span>
          <span><i data-role="patient" />{appointment.data.patientName} — paciente</span>
          {voices.some((voice) => voice.role === "Unknown") ? <span><i data-role="unknown" />voz a identificar</span> : null}
        </div>
        {status === "Paused" ? <p className={styles.pauseNotice}><Pause aria-hidden="true" />Transcrição pausada — o áudio da consulta não está sendo capturado.</p> : null}
        {error ? <p className={styles.error} role="alert"><AlertCircle aria-hidden="true" />{error}</p> : null}
        <div className={styles.transcript} ref={transcriptRef} role="region" aria-label="Falas transcritas" onScroll={(event) => { const element = event.currentTarget; autoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
          {display.length === 0 ? <div className={styles.empty}><Mic aria-hidden="true" /><h2>A conversa aparecerá aqui</h2><p>Inicie a gravação quando médico e paciente estiverem prontos.</p></div> : display.map((item) => {
            const name = displayNameFor(item.speakerRole, item.providerStreamNumber, item.providerSpeakerTag);
            const voiceNumber = item.providerSpeakerTag === null ? null : voiceNumberByKey.get(speakerKey(item.providerStreamNumber, item.providerSpeakerTag));
            const avatarText = item.speakerRole === "Unknown" && voiceNumber ? `V${voiceNumber}` : initials(name);
            const itemEvidence = item.id === "partial"
              ? []
              : activeEvidence?.evidence.filter((evidence) => evidence.segmentId === item.id) ?? [];
            const evidenceRanges = mergeEvidenceRanges(item.text, itemEvidence);
            return <article
              className={item.id === "partial" ? styles.partial : styles.segment}
              data-role={item.speakerRole.toLowerCase()}
              data-segment-id={item.id === "partial" ? undefined : item.id}
              data-evidence-active={itemEvidence.length > 0 ? "true" : undefined}
              tabIndex={item.id === "partial" ? undefined : -1}
              ref={item.id === "partial" ? undefined : segmentRefs.get(item.id)}
              key={item.id}
            >
              <span className={styles.avatar} aria-hidden="true">{avatarText}</span>
              <div className={styles.segmentBody}><header><strong>{name}</strong><time>{formatTime(item.startTimeMs)}</time></header><p>{renderTranscriptText(item.text, evidenceRanges)}</p>
                {item.id === "partial" ? <small><span aria-hidden="true"><i /><i /><i /></span>Transcrevendo…</small> : null}</div>
            </article>;
          })}
        </div>
      </section>

      <aside className={styles.sideColumn} aria-label="Contexto da transcrição">
        {isDoctor ? <div className={styles.pointsSlot}>
          <ImportantPointsPanel
            appointmentId={appointmentId}
            sessionId={session?.id ?? null}
            unknownSegmentCount={unknownSegmentCount}
            onNavigateToEvidence={navigateToEvidence}
          />
        </div> : null}
        <section className={styles.voicePanel} aria-labelledby="voices-title">
          <div className={styles.sideHeading}><h2 id="voices-title">Identificação das vozes</h2><span>{voices.length}</span></div>
          <p className={styles.sideDescription}>Associe cada voz detectada ao participante correto. A alteração vale para todas as falas do mesmo bloco de gravação.</p>
          {voices.length === 0 ? <div className={styles.voiceEmpty}><strong>Nenhuma voz detectada ainda</strong><span>As vozes aparecerão aqui conforme a conversa for transcrita.</span></div> : <div className={styles.voiceList}>
            {voices.map((voice, index) => {
              const voiceName = displayNameFor(voice.role, voice.streamNumber, voice.speakerTag);
              return <div className={styles.voiceItem} data-role={voice.role.toLowerCase()} key={voice.key}>
                <div className={styles.voiceIdentity}><span className={styles.voiceAvatar} aria-hidden="true">{voice.role === "Unknown" ? `V${index + 1}` : initials(voiceName)}</span>
                  <span><strong>{voiceName}</strong><small>Voz {index + 1} · {voice.segmentCount} {voice.segmentCount === 1 ? "fala" : "falas"}</small></span></div>
                <div className={styles.roleChoices} aria-label={`Identificar voz ${index + 1}`}>
                  <button type="button" aria-label={`Identificar voz ${index + 1} como Médico`} aria-pressed={voice.role === "Doctor"} disabled={correctingSpeaker === voice.key}
                    onClick={() => voice.role === "Doctor" ? undefined : void correctSpeaker(voice.streamNumber, voice.speakerTag, "Doctor")}>Médico</button>
                  <button type="button" aria-label={`Identificar voz ${index + 1} como Paciente`} aria-pressed={voice.role === "Patient"} disabled={correctingSpeaker === voice.key}
                    onClick={() => voice.role === "Patient" ? undefined : void correctSpeaker(voice.streamNumber, voice.speakerTag, "Patient")}>Paciente</button>
                </div>
              </div>;
            })}
          </div>}
          <p className={styles.speakerNote}><AlertCircle aria-hidden="true" />A diarização separa as vozes, mas não identifica automaticamente quem é médico ou paciente.</p>
        </section>

        <section className={styles.detailsPanel} aria-labelledby="details-title">
          <h2 id="details-title">Dados da consulta</h2>
          <dl><dt>Paciente</dt><dd>{appointment.data.patientName}</dd>
            <dt>Tipo</dt><dd>{appointmentTypeLabels[appointment.data.type]}</dd>
            <dt>Início</dt><dd>{appointmentDate}</dd>
            <dt>Duração prevista</dt><dd>{plannedMinutes} min</dd></dl>
        </section>
      </aside>
    </div>
  </main>;
}
