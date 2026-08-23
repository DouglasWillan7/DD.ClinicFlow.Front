import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneCaptureService } from "./MicrophoneCaptureService";

describe("MicrophoneCaptureService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("traduz permission denied sem expor erro do navegador", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) } });
    const service = new MicrophoneCaptureService("session", () => "token");
    await expect(service.start()).rejects.toThrow("Permissão do microfone negada");
  });

  it("stop é idempotente antes da captura", async () => {
    const state = vi.fn(); const service = new MicrophoneCaptureService("session", () => "token", { onConnectionState: state });
    await service.stop(); await service.stop();
    expect(state).toHaveBeenLastCalledWith("closed");
  });
});
