import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../../api/client";
import type {
  ConsultationImportantPoint,
  ConsultationImportantPointsSnapshot,
  ConsultationPointCategory,
  ConsultationPointStatus,
} from "./importantPoints";
import { ImportantPointsPanel } from "./ImportantPointsPanel";

const { authState, requestMock } = vi.hoisted(() => ({
  authState: {
    session: {
      userClinicId: "uc-doctor",
      clinicRole: "Doctor" as const,
      isAdmin: false,
      roles: ["Doctor"],
      tokens: { accessToken: "test-token" },
    },
  },
  requestMock: vi.fn(),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: authState.session }),
}));

const appointmentId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";

function point(
  overrides: Partial<ConsultationImportantPoint> = {},
): ConsultationImportantPoint {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    category: "Symptom",
    generatedText: "Paciente relata dor epigástrica após as refeições.",
    reviewedText: null,
    displayText: "Paciente relata dor epigástrica após as refeições.",
    status: "Draft",
    version: 1,
    firstEvidenceStartTimeMs: 72_000,
    evidence: [{
      segmentId: "77777777-7777-4777-8777-777777777777",
      quote: "dor epigástrica",
      quoteStart: 16,
      quoteLength: 15,
      startTimeMs: 72_000,
    }],
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ConsultationImportantPointsSnapshot> = {},
): ConsultationImportantPointsSnapshot {
  return {
    sessionId,
    processingStatus: "Available",
    waitingForSpeakerCount: 0,
    updatedAtUtc: "2026-08-13T12:00:00Z",
    points: [],
    ...overrides,
  };
}

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPanel(options: {
  unknownSegmentCount?: number;
  onNavigateToEvidence?: (selected: ConsultationImportantPoint) => void;
} = {}) {
  return render(
    <ImportantPointsPanel
      appointmentId={appointmentId}
      sessionId={sessionId}
      unknownSegmentCount={options.unknownSegmentCount ?? 0}
      onNavigateToEvidence={options.onNavigateToEvidence ?? vi.fn()}
    />,
    { wrapper: Wrapper },
  );
}

beforeEach(() => {
  authState.session = {
    userClinicId: "uc-doctor",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    tokens: { accessToken: "test-token" },
  };
  requestMock.mockReset();
  requestMock.mockResolvedValue(snapshot());
});

test("não renderiza o painel clínico para usuário sem papel Doctor", () => {
  authState.session = {
    userClinicId: "uc-secretary",
    clinicRole: "Secretary",
    isAdmin: false,
    roles: ["Secretary"],
    tokens: { accessToken: "test-token" },
  };
  renderPanel();

  expect(screen.queryByRole("heading", { name: "Pontos importantes" })).not.toBeInTheDocument();
  expect(requestMock).not.toHaveBeenCalled();
});

test("mostra carregamento sem bloquear o restante da consulta", () => {
  requestMock.mockReturnValue(new Promise(() => undefined));
  renderPanel();

  expect(screen.getByRole("status", { name: "Carregando pontos importantes" })).toBeVisible();
  expect(screen.getByText(/Revise antes de salvar no prontuário/)).toBeVisible();
});

test("mostra erro recuperável e permite tentar a consulta novamente", async () => {
  requestMock.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup();
  renderPanel();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar os pontos importantes.",
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
});

test("mostra o vazio instrutivo aprovado", async () => {
  renderPanel();

  expect(await screen.findByText("Nenhum ponto extraído ainda")).toBeVisible();
  expect(screen.getByText("Os destaques aparecem aqui conforme a conversa avança.")).toBeVisible();
});

test("orienta identificar vozes quando existem segmentos aguardando papel", async () => {
  requestMock.mockResolvedValue(snapshot({ waitingForSpeakerCount: 1 }));
  renderPanel({ unknownSegmentCount: 2 });

  expect(await screen.findByText("Identifique as vozes para gerar os pontos importantes.")).toBeVisible();
});

test("considera segmentos desconhecidos ao vivo antes do próximo snapshot", async () => {
  renderPanel({ unknownSegmentCount: 1 });

  expect(await screen.findByText("Identifique as vozes para gerar os pontos importantes.")).toBeVisible();
});

describe("conteúdo dos pontos", () => {
  test.each([
    ["Symptom", "Sintoma"],
    ["Alert", "Alerta"],
    ["Medication", "Medicação"],
    ["Habit", "Hábito"],
    ["Conduct", "Conduta"],
    ["Exam", "Exame"],
    ["Guidance", "Orientação"],
  ] as [ConsultationPointCategory, string][])("mostra %s como %s", async (category, label) => {
    requestMock.mockResolvedValue(snapshot({ points: [point({ category })] }));
    renderPanel();
    expect(await screen.findByText(label)).toBeVisible();
  });

  test.each([
    ["Draft", "Revisão pendente"],
    ["Accepted", "Aceito"],
    ["Rejected", "Rejeitado"],
    ["Saved", "Salvo"],
  ] as [ConsultationPointStatus, string][])("mostra %s como %s", async (status, label) => {
    requestMock.mockResolvedValue(snapshot({ points: [point({ status })] }));
    renderPanel();
    expect(await screen.findByText(label)).toBeVisible();
  });

  test("mostra contador, timestamp tabular e texto revisável sem confiança", async () => {
    requestMock.mockResolvedValue(snapshot({ points: [point({
      reviewedText: "Dor epigástrica após as refeições.",
      displayText: "Dor epigástrica após as refeições.",
    })] }));
    renderPanel();

    expect(await screen.findByLabelText("1 ponto importante")).toBeVisible();
    expect(screen.getByText("01:12")).toBeVisible();
    expect(screen.getByText("Dor epigástrica após as refeições.")).toBeVisible();
    expect(screen.queryByText(/confiança/i)).not.toBeInTheDocument();
  });

  test("preserva conteúdo longo dentro do controle com nome acessível", async () => {
    const longText = "Relato clínico detalhado ".repeat(30).trim();
    requestMock.mockResolvedValue(snapshot({ points: [point({ displayText: longText })] }));
    renderPanel();

    expect(await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ })).toHaveTextContent(longText);
  });
});

test("ativa a evidência por clique", async () => {
  const onNavigate = vi.fn();
  const selected = point();
  requestMock.mockResolvedValue(snapshot({ points: [selected] }));
  const user = userEvent.setup();
  renderPanel({ onNavigateToEvidence: onNavigate });

  await user.click(await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ }));
  expect(onNavigate).toHaveBeenCalledWith(selected);
});

test.each(["{Enter}", " "])("ativa a evidência pelo teclado %s", async (key) => {
  const onNavigate = vi.fn();
  const selected = point();
  requestMock.mockResolvedValue(snapshot({ points: [selected] }));
  const user = userEvent.setup();
  renderPanel({ onNavigateToEvidence: onNavigate });

  const target = await screen.findByRole("button", { name: /Ir ao trecho de Sintoma/ });
  target.focus();
  await user.keyboard(key);
  expect(onNavigate).toHaveBeenCalledWith(selected);
});

test.each(["Pending", "Processing"] as const)(
  "mantém pontos existentes utilizáveis enquanto o processamento está %s",
  async (processingStatus) => {
    requestMock.mockResolvedValue(snapshot({ processingStatus, points: [point()] }));
    renderPanel();

    const processing = await screen.findByText("Analisando novos trechos da conversa…");
    expect(processing.closest("[role=status]")).toHaveTextContent("Analisando novos trechos da conversa…");
    expect(screen.getByRole("button", { name: /Ir ao trecho de Sintoma/ })).toBeEnabled();
  },
);

test("mostra indisponibilidade recuperável sem esconder pontos ou aviso", async () => {
  requestMock.mockResolvedValue(snapshot({ processingStatus: "Unavailable", points: [point()] }));
  renderPanel();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Os pontos importantes estão temporariamente indisponíveis.",
  );
  expect(screen.getByRole("button", { name: /Ir ao trecho de Sintoma/ })).toBeEnabled();
  expect(screen.getByText(/Pontos gerados por IA a partir do áudio/)).toBeVisible();
});

describe("revisão clínica", () => {
  test("oferece aceitar, editar e rejeitar para um rascunho", async () => {
    requestMock.mockResolvedValue(snapshot({ points: [point()] }));
    renderPanel();

    expect(await screen.findByRole("button", { name: "Aceitar ponto" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar ponto" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rejeitar ponto" })).toBeEnabled();
  });

  test("mantém somente a edição como revisão disponível para um ponto aceito", async () => {
    requestMock.mockResolvedValue(snapshot({ points: [point({ status: "Accepted" })] }));
    renderPanel();

    expect(await screen.findByRole("button", { name: "Editar ponto" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Aceitar ponto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar ponto" })).not.toBeInTheDocument();
  });

  test.each(["Rejected", "Saved"] as const)("mantém %s sem controles de revisão", async (status) => {
    requestMock.mockResolvedValue(snapshot({ points: [point({ status })] }));
    renderPanel();

    expect(await screen.findByText(status === "Saved" ? "Salvo" : "Rejeitado")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Aceitar ponto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar ponto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar ponto" })).not.toBeInTheDocument();
  });

  test.each([
    ["Accept", "Aceitar ponto", "Accepted"],
    ["Reject", "Rejeitar ponto", "Rejected"],
  ] as const)("envia %s com a versão e reconstrói o estado devolvido", async (action, buttonName, nextStatus) => {
    requestMock.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Promise.resolve(point({ status: nextStatus, version: 2 }));
      return Promise.resolve(snapshot({ points: [point()] }));
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: buttonName }));
    expect(await screen.findByText(nextStatus === "Accepted" ? "Aceito" : "Rejeitado")).toBeVisible();
    expect(requestMock).toHaveBeenCalledWith(
      "/consultation-important-points/66666666-6666-4666-8666-666666666666/review",
      {
        method: "PUT",
        body: JSON.stringify({ action, text: null, expectedVersion: 1 }),
      },
    );
  });

  test("abre edição inline rotulada com o texto revisável", async () => {
    requestMock.mockResolvedValue(snapshot({ points: [point()] }));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Editar ponto" }));
    expect(screen.getByRole("textbox", { name: "Texto revisado do ponto" })).toHaveValue(
      "Paciente relata dor epigástrica após as refeições.",
    );
    expect(screen.getByRole("button", { name: "Cancelar edição" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirmar edição" })).toBeEnabled();
  });

  test("cancela a edição sem enviar mutação", async () => {
    requestMock.mockResolvedValue(snapshot({ points: [point()] }));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Editar ponto" }));
    await user.clear(screen.getByRole("textbox", { name: "Texto revisado do ponto" }));
    await user.type(screen.getByRole("textbox", { name: "Texto revisado do ponto" }), "Texto temporário");
    await user.click(screen.getByRole("button", { name: "Cancelar edição" }));

    expect(screen.queryByRole("textbox", { name: "Texto revisado do ponto" })).not.toBeInTheDocument();
    expect(screen.getByText("Paciente relata dor epigástrica após as refeições.")).toBeVisible();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["   ", "Digite entre 1 e 500 caracteres."],
    ["a".repeat(501), "Digite entre 1 e 500 caracteres."],
  ])("valida o texto editado sem enviar %s", async (text, message) => {
    requestMock.mockResolvedValue(snapshot({ points: [point()] }));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Editar ponto" }));
    const textarea = screen.getByRole("textbox", { name: "Texto revisado do ponto" });
    await user.clear(textarea);
    await user.type(textarea, text);
    await user.click(screen.getByRole("button", { name: "Confirmar edição" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(textarea).toHaveValue(text);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  test("confirma a edição com versão e retorna o ponto aceito para revisão pendente", async () => {
    const edited = point({
      status: "Draft",
      reviewedText: "Dor após refeições.",
      displayText: "Dor após refeições.",
      version: 2,
    });
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      Promise.resolve(init?.method === "PUT" ? edited : snapshot({ points: [point({ status: "Accepted" })] })));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Editar ponto" }));
    const textarea = screen.getByRole("textbox", { name: "Texto revisado do ponto" });
    await user.clear(textarea);
    await user.type(textarea, "Dor após refeições.");
    await user.click(screen.getByRole("button", { name: "Confirmar edição" }));

    expect(await screen.findByText("Revisão pendente")).toBeVisible();
    expect(screen.getByText("Dor após refeições.")).toBeVisible();
    expect(requestMock).toHaveBeenCalledWith(
      "/consultation-important-points/66666666-6666-4666-8666-666666666666/review",
      {
        method: "PUT",
        body: JSON.stringify({ action: "Edit", text: "Dor após refeições.", expectedVersion: 1 }),
      },
    );
  });

  test("preserva o texto digitado após falha recuperável", async () => {
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(snapshot({ points: [point()] })));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Editar ponto" }));
    const textarea = screen.getByRole("textbox", { name: "Texto revisado do ponto" });
    await user.clear(textarea);
    await user.type(textarea, "Texto revisado preservado");
    await user.click(screen.getByRole("button", { name: "Confirmar edição" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível atualizar este ponto.");
    expect(textarea).toHaveValue("Texto revisado preservado");
  });

  test("substitui o ponto pelo currentPoint em conflito e pede nova revisão", async () => {
    const currentPoint = point({ status: "Accepted", version: 2 });
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? Promise.reject(new ApiError("Conflito", 409, { currentPoint } as never))
        : Promise.resolve(snapshot({ points: [point()] })));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Aceitar ponto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este ponto foi atualizado em outra sessão. Revise o estado atual antes de tentar novamente.",
    );
    expect(screen.getByText("Aceito")).toBeVisible();
  });

  test("desabilita ações enquanto a revisão está em andamento", async () => {
    let finishReview!: (value: ConsultationImportantPoint) => void;
    const pendingReview = new Promise<ConsultationImportantPoint>((resolve) => { finishReview = resolve; });
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      init?.method === "PUT" ? pendingReview : Promise.resolve(snapshot({ points: [point()] })));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Aceitar ponto" }));
    expect(screen.getByRole("button", { name: "Aceitar ponto" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar ponto" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rejeitar ponto" })).toBeDisabled();
    finishReview(point({ status: "Accepted", version: 2 }));
    expect(await screen.findByText("Aceito")).toBeVisible();
  });
});

describe("salvamento explícito", () => {
  test("envia um UUID e converte somente o ponto aceito devolvido em salvo", async () => {
    const accepted = point({ status: "Accepted" });
    const draft = point({ id: "draft", status: "Draft", displayText: "Ponto ainda em revisão." });
    const rejected = point({ id: "rejected", status: "Rejected", displayText: "Ponto rejeitado." });
    requestMock.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve([{ ...accepted, status: "Saved", version: 2 }]);
      return Promise.resolve(snapshot({ points: [accepted, draft, rejected] }));
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Salvar pontos no prontuário" }));
    expect(await screen.findByText("Pontos salvos no prontuário do paciente.")).toBeVisible();
    expect(screen.getByText("Ponto ainda em revisão.")).toBeVisible();
    expect(screen.getByText("Ponto rejeitado.")).toBeVisible();
    const saveCall = requestMock.mock.calls.find(([, init]) => init?.method === "POST");
    const saveRequestId = JSON.parse(String(saveCall?.[1]?.body)).saveRequestId;
    expect(saveRequestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("repete o mesmo UUID após falha recuperável", async () => {
    let attempt = 0;
    requestMock.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error("offline"))
          : Promise.resolve([point({ status: "Saved", version: 2 })]);
      }
      return Promise.resolve(snapshot({ points: [point({ status: "Accepted" })] }));
    });
    const user = userEvent.setup();
    renderPanel();

    const save = await screen.findByRole("button", { name: "Salvar pontos no prontuário" });
    await user.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar os pontos.");
    await user.click(save);
    expect(await screen.findByText("Pontos salvos no prontuário do paciente.")).toBeVisible();

    const bodies = requestMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).saveRequestId);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  test("mostra a orientação exata quando não existe ponto aceito", async () => {
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError("Nenhum ponto aceito.", 409, {
          detail: "Aceite ao menos um ponto antes de salvar.",
        }))
        : Promise.resolve(snapshot({ points: [point()] })));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Salvar pontos no prontuário" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Aceite ao menos um ponto antes de salvar.",
    );
  });

  test("desabilita o salvamento e preserva o aviso durante a tentativa", async () => {
    requestMock.mockImplementation((_path: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise(() => undefined)
        : Promise.resolve(snapshot({ points: [point({ status: "Accepted" })] })));
    const user = userEvent.setup();
    renderPanel();

    const save = await screen.findByRole("button", { name: "Salvar pontos no prontuário" });
    await user.click(save);
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Pontos gerados por IA a partir do áudio/)).toBeVisible();
  });
});
