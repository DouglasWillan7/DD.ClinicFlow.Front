import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ConsultationTranscriptionPage } from "./ConsultationTranscriptionPage";

const { authState, requestMock, hubMock } = vi.hoisted(() => ({
  authState: {
    session: {
      name: "Dra. Ana Martins",
      userClinicId: "uc-doctor",
      clinicRole: "Doctor" as "Doctor" | "Secretary",
      isAdmin: false,
      roles: ["Doctor"] as ("Admin" | "Secretary" | "Doctor")[],
      tokens: { accessToken: "test-token" },
    },
  },
  requestMock: vi.fn(),
  hubMock: {
    on: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    invoke: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: class {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return hubMock; }
  },
  LogLevel: { None: 0 },
}));

vi.mock("./MicrophoneCaptureService", () => ({
  MicrophoneCaptureService: class {
    start = vi.fn(() => Promise.resolve());
    pause = vi.fn(() => Promise.resolve());
    resume = vi.fn(() => Promise.resolve());
    stop = vi.fn(() => Promise.resolve());
  },
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    request: requestMock,
    session: authState.session,
  }),
}));

const appointmentId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";

const importantPoint = {
  id: "66666666-6666-4666-8666-666666666666",
  category: "Symptom",
  generatedText: "Paciente relata dor.",
  reviewedText: null,
  displayText: "Paciente relata dor.",
  status: "Draft",
  version: 1,
  firstEvidenceStartTimeMs: 2_000,
  evidence: [{
    segmentId: "two",
    quote: "dor",
    quoteStart: 14,
    quoteLength: 3,
    startTimeMs: 2_000,
  }],
};

let transcriptPayload: unknown;
let pointsPayload: {
  sessionId: string | null;
  processingStatus: string;
  waitingForSpeakerCount: number;
  updatedAtUtc: string | null;
  points: typeof importantPoint[];
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}>
    <ConsultationTranscriptionPage appointmentId={appointmentId} />
  </QueryClientProvider>);
  return { ...rendered, client };
}

function emitHubEvent(name: string, payload: unknown) {
  const handler = hubMock.on.mock.calls.find(([eventName]) => eventName === name)?.[1];
  expect(handler).toBeTypeOf("function");
  act(() => handler(payload));
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  authState.session = {
    name: "Dra. Ana Martins",
    userClinicId: "uc-doctor",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    tokens: { accessToken: "test-token" },
  };
  transcriptPayload = {
    session: { id: sessionId, appointmentId, startedAtUtc: "2026-08-12T12:00:00Z", endedAtUtc: "2026-08-12T12:10:00Z",
      status: "Completed", lastAudioSequence: 100, isDegraded: false },
    segments: [
      { id: "one", sequence: 1, providerStreamNumber: 1, providerSpeakerTag: 0, speakerRole: "Unknown", startTimeMs: 0, endTimeMs: 1_000, text: "Como você está?" },
      { id: "two", sequence: 2, providerStreamNumber: 1, providerSpeakerTag: 0, speakerRole: "Unknown", startTimeMs: 2_000, endTimeMs: 3_000, text: "Sentiu alguma dor?" },
      { id: "no-tag", sequence: 3, providerStreamNumber: 1, providerSpeakerTag: null, speakerRole: "Unknown", startTimeMs: 4_000, endTimeMs: 5_000, text: "Trecho sem identificação técnica." },
    ],
  };
  pointsPayload = {
    sessionId,
    processingStatus: "Available",
    waitingForSpeakerCount: 0,
    updatedAtUtc: "2026-08-13T12:00:00Z",
    points: [importantPoint],
  };
  requestMock.mockReset();
  hubMock.on.mockClear(); hubMock.start.mockClear(); hubMock.invoke.mockClear(); hubMock.stop.mockClear();
  requestMock.mockImplementation((path: string) => {
    if (path === `/appointments/${appointmentId}`) return Promise.resolve({
      id: appointmentId, patientId: "33333333-3333-4333-8333-333333333333", patientName: "Marina Oliveira",
      doctorUserId: "11111111-1111-4111-8111-111111111111", startUtc: "2026-08-12T12:00:00Z",
      endUtc: "2026-08-12T13:00:00Z", type: "InPerson", status: "Completed", notes: null,
      actualStartUtc: "2026-08-12T12:04:00Z", actualEndUtc: "2026-08-12T12:42:00Z",
      createdAtUtc: "2026-08-10T12:00:00Z",
    });
    if (path === `/consultations/${appointmentId}/transcription`) return Promise.resolve(transcriptPayload);
    if (path === `/consultations/${appointmentId}/important-points`) return Promise.resolve(pointsPayload);
    if (path === `/transcription-sessions/${sessionId}/speaker`) return Promise.resolve(undefined);
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
});

test("identifica uma voz e atualiza todas as falas do mesmo stream", async () => {
  const user = userEvent.setup();
  renderPage();

  const actions = await screen.findAllByRole("button", { name: "Identificar voz 1 como Médico" });
  expect(actions).toHaveLength(1);
  expect(screen.getAllByText(/não identificada/)).toHaveLength(4);
  await user.click(actions[0]);

  await waitFor(() => expect(screen.getAllByText("Voz não identificada")).toHaveLength(1));
  expect(screen.getAllByText("Dra. Ana Martins")).toHaveLength(3);
  expect(requestMock).toHaveBeenCalledWith(`/transcription-sessions/${sessionId}/speaker`, {
    method: "PUT",
    body: JSON.stringify({ providerStreamNumber: 1, providerSpeakerTag: 0, role: "Doctor" }),
  });
});

test("renderiza Pontos, Vozes e Dados nesta ordem para Doctor", async () => {
  renderPage();

  const points = (await screen.findByRole("heading", { name: "Pontos importantes" })).closest("section")!;
  const voices = screen.getByRole("heading", { name: "Identificação das vozes" }).closest("section")!;
  const details = screen.getByRole("heading", { name: "Dados da consulta" }).closest("section")!;
  expect(points.compareDocumentPosition(voices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(voices.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("exibe horários agendados e efetivos como informações distintas", async () => {
  renderPage();

  const details = (await screen.findByRole("heading", {
    name: "Dados da consulta",
  })).closest("section")!;
  expect(details).toHaveTextContent("Início agendado");
  expect(details).toHaveTextContent("Início efetivo");
  expect(details).toHaveTextContent("Término efetivo");
  expect(details).toHaveTextContent("38 min");
});

test("AccessRequired bloqueia a consulta antes de buscar dados clínicos", async () => {
  requestMock.mockImplementation((path: string) => {
    if (path === `/appointments/${appointmentId}`) {
      return Promise.resolve({
        id: appointmentId,
        patientId: "33333333-3333-4333-8333-333333333333",
        patientName: "Marina Oliveira",
        doctorUserId: "11111111-1111-4111-8111-111111111111",
        startUtc: "2026-08-12T12:00:00Z",
        endUtc: "2026-08-12T13:00:00Z",
        type: "InPerson",
        status: "AccessRequired",
        notes: null,
        createdAtUtc: "2026-08-10T12:00:00Z",
      });
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Acesso aos dados necessário" }),
  ).toBeVisible();
  expect(screen.getByText(/não pode ser iniciada/)).toBeVisible();
  expect(requestMock).not.toHaveBeenCalledWith(
    `/consultations/${appointmentId}/transcription`,
  );
  expect(hubMock.start).not.toHaveBeenCalled();
});

test("inicia o lifecycle antes da transcrição quando o acesso está ativo", async () => {
  transcriptPayload = { session: null, segments: [] };
  const confirmed = {
    id: appointmentId,
    patientId: "33333333-3333-4333-8333-333333333333",
    patientName: "Marina Oliveira",
    doctorUserId: "11111111-1111-4111-8111-111111111111",
    startUtc: "2026-08-12T12:00:00Z",
    endUtc: "2026-08-12T13:00:00Z",
    type: "InPerson",
    status: "Confirmed",
    notes: null,
    createdAtUtc: "2026-08-10T12:00:00Z",
  };
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/appointments/${appointmentId}`) return Promise.resolve(confirmed);
    if (path === `/consultations/${appointmentId}/transcription`) {
      return Promise.resolve(transcriptPayload);
    }
    if (path === `/consultations/${appointmentId}/important-points`) {
      return Promise.resolve({ ...pointsPayload, sessionId: null, points: [] });
    }
    if (path === `/appointments/${appointmentId}/start` && init?.method === "POST") {
      return Promise.resolve({
        ...confirmed,
        status: "InProgress",
        actualStartUtc: "2026-08-12T12:04:00Z",
      });
    }
    if (
      path === `/consultations/${appointmentId}/transcription/start` &&
      init?.method === "POST"
    ) {
      return Promise.resolve({
        id: sessionId,
        appointmentId,
        startedAtUtc: "2026-08-12T12:04:00Z",
        endedAtUtc: null,
        status: "Recording",
        lastAudioSequence: 0,
        isDegraded: false,
      });
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Iniciar consulta" }),
  );

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      `/consultations/${appointmentId}/transcription/start`,
      { method: "POST" },
    ),
  );
  const lifecycleCall = requestMock.mock.calls.findIndex(
    ([path]) => path === `/appointments/${appointmentId}/start`,
  );
  const transcriptionCall = requestMock.mock.calls.findIndex(
    ([path]) => path === `/consultations/${appointmentId}/transcription/start`,
  );
  expect(lifecycleCall).toBeGreaterThanOrEqual(0);
  expect(transcriptionCall).toBeGreaterThan(lifecycleCall);
});

test("não inicia a transcrição quando o lifecycle detecta perda de acesso", async () => {
  transcriptPayload = { session: null, segments: [] };
  const confirmed = {
    id: appointmentId,
    patientId: "33333333-3333-4333-8333-333333333333",
    patientName: "Marina Oliveira",
    doctorUserId: "11111111-1111-4111-8111-111111111111",
    startUtc: "2026-08-12T12:00:00Z",
    endUtc: "2026-08-12T13:00:00Z",
    type: "InPerson",
    status: "Confirmed",
    notes: null,
    createdAtUtc: "2026-08-10T12:00:00Z",
  };
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/appointments/${appointmentId}`) return Promise.resolve(confirmed);
    if (path === `/consultations/${appointmentId}/transcription`) {
      return Promise.resolve(transcriptPayload);
    }
    if (path === `/consultations/${appointmentId}/important-points`) {
      return Promise.resolve({ ...pointsPayload, sessionId: null, points: [] });
    }
    if (path === `/appointments/${appointmentId}/start` && init?.method === "POST") {
      return Promise.resolve({ ...confirmed, status: "AccessRequired" });
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Iniciar consulta" }),
  );

  expect(
    await screen.findByRole("heading", { name: "Acesso aos dados necessário" }),
  ).toBeVisible();
  expect(requestMock).not.toHaveBeenCalledWith(
    `/consultations/${appointmentId}/transcription/start`,
    { method: "POST" },
  );
});

test("finaliza o lifecycle depois de drenar a transcrição", async () => {
  const inProgress = {
    id: appointmentId,
    patientId: "33333333-3333-4333-8333-333333333333",
    patientName: "Marina Oliveira",
    doctorUserId: "11111111-1111-4111-8111-111111111111",
    startUtc: "2026-08-12T12:00:00Z",
    endUtc: "2026-08-12T13:00:00Z",
    type: "InPerson",
    status: "InProgress",
    notes: null,
    actualStartUtc: "2026-08-12T12:04:00Z",
    actualEndUtc: null,
    createdAtUtc: "2026-08-10T12:00:00Z",
  };
  transcriptPayload = {
    session: {
      id: sessionId,
      appointmentId,
      startedAtUtc: "2026-08-12T12:04:00Z",
      endedAtUtc: null,
      status: "Recording",
      lastAudioSequence: 10,
      isDegraded: false,
    },
    segments: [],
  };
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/appointments/${appointmentId}`) return Promise.resolve(inProgress);
    if (path === `/consultations/${appointmentId}/transcription`) {
      return Promise.resolve(transcriptPayload);
    }
    if (path === `/consultations/${appointmentId}/important-points`) {
      return Promise.resolve({ ...pointsPayload, points: [] });
    }
    if (path === `/transcription-sessions/${sessionId}/finish` && init?.method === "POST") {
      return Promise.resolve(undefined);
    }
    if (path === `/appointments/${appointmentId}/complete` && init?.method === "POST") {
      return Promise.resolve({
        ...inProgress,
        status: "Completed",
        actualEndUtc: "2026-08-12T12:42:00Z",
      });
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Finalizar consulta" }),
  );

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      `/appointments/${appointmentId}/complete`,
      { method: "POST" },
    ),
  );
  const finishCall = requestMock.mock.calls.findIndex(
    ([path]) => path === `/transcription-sessions/${sessionId}/finish`,
  );
  const completeCall = requestMock.mock.calls.findIndex(
    ([path]) => path === `/appointments/${appointmentId}/complete`,
  );
  expect(completeCall).toBeGreaterThan(finishCall);
  expect(await screen.findByText("Consulta finalizada")).toBeVisible();
});

test("não consulta nem renderiza pontos clínicos para Secretary", async () => {
  authState.session = {
    ...authState.session,
    userClinicId: "uc-secretary",
    clinicRole: "Secretary",
    roles: ["Secretary"],
  };
  renderPage();

  expect(await screen.findByRole("heading", { name: "Transcrição da consulta" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Pontos importantes" })).not.toBeInTheDocument();
  expect(requestMock).not.toHaveBeenCalledWith(`/consultations/${appointmentId}/important-points`);
});

test("usa segmentId real no evento final e não duplica o mesmo segmento", async () => {
  renderPage();
  await screen.findByRole("heading", { name: "Pontos importantes" });
  const event = {
    sessionId,
    segmentId: "live-segment-id",
    sequence: 4,
    streamNumber: 1,
    speakerTag: 0,
    speakerRole: "Doctor",
    startTimeMs: 6_000,
    endTimeMs: 7_000,
    text: "Novo trecho confirmado.",
    isFinal: true,
  };

  emitHubEvent("TranscriptionFinal", event);
  emitHubEvent("TranscriptionFinal", event);

  const liveSegments = screen.getAllByText("Novo trecho confirmado.");
  expect(liveSegments).toHaveLength(1);
  expect(liveSegments[0].closest("article")).toHaveAttribute("data-segment-id", "live-segment-id");
});

test("refaz a consulta REST quando um evento final não traz segmentId", async () => {
  renderPage();
  await screen.findByRole("heading", { name: "Pontos importantes" });
  const before = requestMock.mock.calls.filter(([path]) => path === `/consultations/${appointmentId}/transcription`).length;

  emitHubEvent("TranscriptionFinal", {
    sessionId,
    segmentId: null,
    sequence: 4,
    streamNumber: 1,
    speakerTag: 0,
    speakerRole: "Doctor",
    startTimeMs: 6_000,
    endTimeMs: 7_000,
    text: "Trecho sem identidade persistida.",
    isFinal: true,
  });

  await waitFor(() => expect(requestMock.mock.calls.filter(
    ([path]) => path === `/consultations/${appointmentId}/transcription`,
  )).toHaveLength(before + 1));
  expect(screen.queryByText("Trecho sem identidade persistida.")).not.toBeInTheDocument();
});

test("leva foco ao segmento, rola somente a transcrição e marca o literal", async () => {
  const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  const user = userEvent.setup();
  renderPage();

  const evidenceButton = await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ });
  const transcriptRegion = screen.getByRole("region", { name: "Falas transcritas" });
  const segment = screen.getByText("Sentiu alguma dor?").closest("article")!;
  const transcriptScroll = vi.mocked(transcriptRegion.scrollTo);
  transcriptScroll.mockClear();
  await user.click(evidenceButton);

  expect(transcriptScroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
  expect(windowScroll).not.toHaveBeenCalled();
  expect(segment).toHaveFocus();
  expect(segment.querySelector("mark")?.textContent).toBe("dor");
  expect(segment.textContent).toContain("Sentiu alguma dor?");
  windowScroll.mockRestore();
});

test("remove o destaque literal depois de 1,5 segundo", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ }));
  expect(screen.getByText("dor", { selector: "mark" })).toBeVisible();

  await waitFor(() => expect(screen.queryByText("dor", { selector: "mark" })).not.toBeInTheDocument(), {
    timeout: 1_700,
  });
});

test("evita scroll suave quando o sistema prefere movimento reduzido", async () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const user = userEvent.setup();
  renderPage();

  const transcriptRegion = await screen.findByRole("region", { name: "Falas transcritas" });
  await user.click(await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ }));
  expect(transcriptRegion.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "auto" }));
});

test("invalida e refaz pontos pelo evento importante sem duplicar cards", async () => {
  renderPage();
  expect(await screen.findAllByRole("button", { name: /Ir ao trecho de Sintoma/ })).toHaveLength(1);
  const before = requestMock.mock.calls.filter(
    ([path]) => path === `/consultations/${appointmentId}/important-points`,
  ).length;

  emitHubEvent("importantPointsUpdated", { appointmentId, sessionId, revision: 2 });

  await waitFor(() => expect(requestMock.mock.calls.filter(
    ([path]) => path === `/consultations/${appointmentId}/important-points`,
  )).toHaveLength(before + 1));
  expect(screen.getAllByRole("button", { name: /Ir ao trecho de Sintoma/ })).toHaveLength(1);
});

test("ignora invalidação pertencente a outra consulta", async () => {
  renderPage();
  await screen.findByRole("heading", { name: "Pontos importantes" });
  const before = requestMock.mock.calls.filter(
    ([path]) => path === `/consultations/${appointmentId}/important-points`,
  ).length;

  emitHubEvent("importantPointsUpdated", { appointmentId: "another", sessionId, revision: 2 });
  await act(async () => Promise.resolve());

  expect(requestMock.mock.calls.filter(
    ([path]) => path === `/consultations/${appointmentId}/important-points`,
  )).toHaveLength(before);
});

test("mantém transcript e vozes disponíveis quando o provider de pontos falha", async () => {
  pointsPayload = {
    sessionId,
    processingStatus: "Unavailable",
    waitingForSpeakerCount: 0,
    updatedAtUtc: null,
    points: [importantPoint],
  };
  renderPage();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Os pontos importantes estão temporariamente indisponíveis.",
  );
  expect(screen.getByRole("region", { name: "Falas transcritas" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Identificação das vozes" })).toBeVisible();
});
