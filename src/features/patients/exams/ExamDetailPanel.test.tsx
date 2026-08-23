import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type { ClinicalExamReport, PatientExamDetail, PatientExamRevision } from "../../../api/types";
import { ExamDetailPanel } from "./ExamDetailPanel";

const capabilities: PatientExamDetail["capabilities"] = {
  canEditRequest: false,
  canCancelRequest: false,
  canAttachDocument: false,
  canReprocess: false,
  canDiscardFailedExam: false,
  canDiscardExam: false,
  canOpenCorrection: false,
  canEditRevision: false,
  canClassify: false,
  canValidate: false,
};

const revision: PatientExamRevision = {
  id: "revision-1",
  number: 2,
  status: "Rascunho",
  aiSuggestedOutcome: "Alterado",
  clinicalOutcome: null,
  averageConfidence: 0.91,
  model: "model-1",
  correctionReason: null,
  createdByUserId: "user-1",
  createdAtUtc: "2026-08-09T12:00:00Z",
  lastEditedByUserId: null,
  updatedAtUtc: null,
  validatedByUserId: null,
  validatedAtUtc: null,
  structuredResults: [{
    id: "result-1",
    order: 0,
    catalogCode: "HB",
    name: "Hemoglobina",
    numericValue: 10.2,
    textValue: null,
    unit: "g/dL",
    referenceText: "12–16 g/dL",
    outOfRangeSuggestion: true,
    confidence: 0.92,
    referenceLowerBound: null,
    referenceUpperBound: null,
    referenceState: "indeterminado",
  }],
  narrativeSections: [{
    id: "section-1",
    order: 0,
    title: "Conclusão radiológica",
    text: "Imagem sem sinais agudos.",
    confidence: null,
  }],
  structuredFindings: [{
    id: "finding-1",
    order: 0,
    key: "Ritmo",
    value: "Sinusal",
    confidence: 0.98,
  }],
  extractionIssues: [],
};

function detail(overrides: Partial<PatientExamDetail> = {}): PatientExamDetail {
  return {
    id: "exam-1",
    patientId: "patient-1",
    doctorUserId: "doctor-1",
    requestedByUserId: "doctor-1",
    name: "Hemograma completo",
    category: "Laboratório",
    scheduledOn: "2026-08-15",
    status: "Solicitado",
    version: 4,
    error: null,
    createdAtUtc: "2026-08-09T10:00:00Z",
    updatedAtUtc: "2026-08-09T10:00:00Z",
    processedAtUtc: null,
    cancelledByUserId: null,
    cancelledAtUtc: null,
    document: null,
    activeRevision: null,
    draftRevision: null,
    attemptsRemaining: 0,
    capabilities,
    ...overrides,
  };
}

const document = {
  fileName: "hemograma.pdf",
  contentType: "application/pdf" as const,
  sizeBytes: 2_048,
  source: "Clínica" as const,
  createdAtUtc: "2026-08-09T10:00:00Z",
  processingAttempts: 1,
};

const clinicalReport: ClinicalExamReport = {
  id: "exam-1",
  patientId: "patient-1",
  name: "Hemograma completo",
  category: "Laboratório",
  clinicalOutcome: "Sem alterações",
  version: 2,
  metadata: {
    collectedAtLocal: "2026-08-09T08:00:00",
    issuedOn: "2026-08-09",
    validatedAtUtc: "2026-08-09T14:30:00Z",
    requesterName: "Dra. Ana",
    requesterRegistration: "CRM-SP 123",
    validatorName: "Dr. Bruno",
  },
  document: { fileName: "hemograma.pdf", sizeBytes: 2_048, source: "Clínica", pageCount: 2 },
  findings: [],
  structuredFindings: [],
  results: [{
    id: "result-1",
    catalogCode: "HB",
    name: "Hemoglobina",
    subtitle: null,
    numericValue: 14.2,
    valueText: "14,2",
    unit: "g/dL",
    referenceText: "12–16 g/dL",
    detailedReferenceText: null,
    referenceState: "normal",
    confidence: 0.98,
    deltaPercent: null,
    history: [],
  }],
  notes: [],
  capabilities: { canOpenDocument: true, canViewHistory: true, canOpenCorrection: true },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("solicitado apresenta previsão, solicitante e somente ações permitidas", () => {
  const onEditRequest = vi.fn();
  const onAttachDocument = vi.fn();
  render(<ExamDetailPanel exam={detail({ capabilities: { ...capabilities, canEditRequest: true, canAttachDocument: true } })} requesterLabel="Dra. Ana" onEditRequest={onEditRequest} onAttachDocument={onAttachDocument} />);
  expect(screen.getByText("15/08/2026")).toBeInTheDocument();
  expect(screen.getByText("Dra. Ana")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar solicitação" }));
  fireEvent.click(screen.getByRole("button", { name: "Anexar laudo" }));
  expect([onEditRequest.mock.calls.length, onAttachDocument.mock.calls.length]).toEqual([1, 1]);
});

test("oculta manutenção clínica quando a capacidade não foi concedida", () => {
  render(<ExamDetailPanel exam={detail()} requesterLabel={null} />);
  expect(screen.getByText("Solicitante não informado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar solicitação" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Anexar laudo" })).not.toBeInTheDocument();
});

test("pendente usa skeleton estrutural e descreve a etapa", () => {
  render(<ExamDetailPanel exam={detail({ status: "Pendente", document })} />);
  expect(screen.getByRole("status")).toHaveTextContent("Laudo recebido. Aguardando o início da extração.");
  expect(screen.getByTestId("exam-detail-skeleton")).toBeInTheDocument();
});

test("processando diferencia a etapa ativa", () => {
  render(<ExamDetailPanel exam={detail({ status: "Processando", document })} />);
  expect(screen.getByRole("status")).toHaveTextContent("Extraindo resultados do laudo original.");
});

test("falha mostra erro sanitizado, tentativas e reprocessa quando permitido", () => {
  const onRetry = vi.fn();
  render(<ExamDetailPanel exam={detail({ status: "Falhou", document, error: "O documento não pôde ser lido.", attemptsRemaining: 2, capabilities: { ...capabilities, canReprocess: true } })} onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("O documento não pôde ser lido.");
  expect(screen.getByText("2 tentativas restantes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar processar novamente" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

test("falha esgotada orienta outro PDF e não oferece nova tentativa", () => {
  render(<ExamDetailPanel exam={detail({ status: "Falhou", document, attemptsRemaining: 0, capabilities: { ...capabilities, canReprocess: true } })} />);
  expect(screen.getByText("Nenhuma tentativa restante. Envie outro PDF para continuar.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tentar processar novamente" })).not.toBeInTheDocument();
});

test("falha delega descarte para a recuperação inline real", async () => {
  const onDiscard = vi.fn().mockResolvedValue(undefined);
  render(
    <ExamDetailPanel
      exam={detail({
        status: "Falhou",
        document,
        capabilities: { ...capabilities, canDiscardFailedExam: true },
      })}
      onDiscard={onDiscard}
      onReload={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Descartar laudo" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));
  await waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
});

test("troca de exame isola rejeição tardia de descarte pendente", async () => {
  let rejectDiscard: (reason: unknown) => void = () => undefined;
  const onDiscard = vi.fn(() => new Promise<void>((_resolve, reject) => {
    rejectDiscard = reject;
  }));
  const firstExam = detail({
    id: "failed-a",
    status: "Falhou",
    document,
    capabilities: { ...capabilities, canDiscardFailedExam: true },
  });
  const secondExam = detail({
    id: "failed-b",
    name: "Exame B",
    status: "Falhou",
    document,
    capabilities: { ...capabilities, canDiscardFailedExam: true },
  });
  const { rerender } = render(
    <ExamDetailPanel exam={firstExam} onDiscard={onDiscard} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Descartar laudo" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));
  expect(screen.getByRole("button", { name: "Descartar e enviar novamente" })).toBeDisabled();

  rerender(<ExamDetailPanel exam={secondExam} onDiscard={vi.fn()} />);

  expect(screen.getByRole("heading", { name: "Exame B" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Descartar laudo" })).toBeEnabled();
  await act(async () => {
    rejectDiscard(new ApiError("Conflito tardio", 409, { currentVersion: 8 }));
    await Promise.resolve();
  });
  expect(screen.queryByText(/Este exame foi atualizado por outra pessoa/)).not.toBeInTheDocument();
});

test("revisão identifica a conclusão automática como sugestão da IA", () => {
  render(<ExamDetailPanel exam={detail({ status: "Em revisão", document, draftRevision: revision, capabilities: { ...capabilities, canEditRevision: true } })} />);
  expect(screen.getByText("Sugestão da IA")).toBeInTheDocument();
  expect(screen.getByText("Alterado")).toBeInTheDocument();
  expect(screen.queryByText("Conclusão confirmada")).not.toBeInTheDocument();
});

test("revisão oferece descarte somente com capacidade e delega a confirmação", async () => {
  const onDiscard = vi.fn().mockResolvedValue(undefined);
  render(
    <ExamDetailPanel
      exam={detail({
        status: "Em revisão",
        document,
        draftRevision: revision,
        capabilities: { ...capabilities, canEditRevision: true, canDiscardExam: true },
      })}
      onDiscard={onDiscard}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Descartar exame" }));
  expect(screen.getByRole("region", { name: "Confirmar descarte do exame" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Descartar exame" })[0]);
  await waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
});

test("troca de revisão fecha a confirmação antiga e nunca descarta o exame anterior", async () => {
  const onFirstDiscard = vi.fn().mockResolvedValue(undefined);
  const onSecondDiscard = vi.fn().mockResolvedValue(undefined);
  const firstExam = detail({
    id: "review-a",
    name: "Revisão A",
    status: "Em revisão",
    document,
    draftRevision: revision,
    capabilities: { ...capabilities, canEditRevision: true, canDiscardExam: true },
  });
  const secondExam = detail({
    id: "review-b",
    name: "Revisão B",
    status: "Em revisão",
    document,
    draftRevision: { ...revision, id: "revision-2" },
    capabilities: { ...capabilities, canEditRevision: true, canDiscardExam: true },
  });
  const { rerender } = render(
    <ExamDetailPanel exam={firstExam} onDiscard={onFirstDiscard} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Descartar exame" }));
  expect(screen.getByRole("region", { name: "Confirmar descarte do exame" })).toBeInTheDocument();

  rerender(<ExamDetailPanel exam={secondExam} onDiscard={onSecondDiscard} />);

  expect(screen.getByRole("heading", { name: "Revisão B" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Confirmar descarte do exame" })).not.toBeInTheDocument();
  expect(onFirstDiscard).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Descartar exame" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Descartar exame" })[0]);
  await waitFor(() => expect(onSecondDiscard).toHaveBeenCalledOnce());
  expect(onFirstDiscard).not.toHaveBeenCalled();
});

test("revisão não mostra descarte sem a capacidade concedida", () => {
  render(
    <ExamDetailPanel
      exam={detail({ status: "Em revisão", document, draftRevision: revision })}
      onDiscard={vi.fn()}
    />,
  );

  expect(screen.queryByRole("button", { name: "Descartar exame" })).not.toBeInTheDocument();
});

test("conteúdo misto mantém resultados, narrativa e achados no mesmo detalhe", () => {
  render(<ExamDetailPanel exam={detail({ status: "Em revisão", document, draftRevision: revision, capabilities: { ...capabilities, canEditRevision: true } })} />);
  expect(screen.getByRole("table", { name: "Resultados estruturados" })).toBeInTheDocument();
  expect(screen.getByText("Hemoglobina")).toBeInTheDocument();
  expect(screen.getByText("10,2 g/dL")).toBeInTheDocument();
  expect(screen.getByText("12–16 g/dL")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Conclusão radiológica" })).toBeInTheDocument();
  expect(screen.getByText("Imagem sem sinais agudos.")).toBeInTheDocument();
  expect(screen.getByText("Ritmo").nextElementSibling).toHaveTextContent("Sinusal");
});

test("destaca confiança baixa com texto e não fabrica a ausente", () => {
  render(<ExamDetailPanel exam={detail({ status: "Em revisão", document, draftRevision: revision, capabilities: { ...capabilities, canEditRevision: true } })} />);
  expect(screen.getByText("92%").closest("tr")).toHaveTextContent("Prioridade de revisão");
  expect(screen.getByText("Confiança não informada")).toBeInTheDocument();
});

test("resultado fora da referência usa texto além de cor", () => {
  render(<ExamDetailPanel exam={detail({ status: "Em revisão", document, draftRevision: revision, capabilities: { ...capabilities, canEditRevision: true } })} />);
  expect(screen.getByText("Fora da referência sugerida")).toBeInTheDocument();
});

test("validado delega o relatório clínico e preserva histórico e correção", () => {
  const onShowHistory = vi.fn();
  const onOpenCorrection = vi.fn();
  const activeRevision = { ...revision, status: "Validada" as const, clinicalOutcome: "Sem alterações" as const, validatedByUserId: "doctor-2", validatedAtUtc: "2026-08-09T14:30:00Z" };
  render(<ExamDetailPanel exam={detail({ status: "Validado", document, activeRevision, capabilities: { ...capabilities, canOpenCorrection: true } })} report={clinicalReport} onShowHistory={onShowHistory} onOpenCorrection={onOpenCorrection} />);
  expect(screen.getByRole("table", { name: "Todos os resultados" })).toBeInTheDocument();
  expect(screen.getByText("Sem alterações")).toBeInTheDocument();
  expect(screen.getByText("Dr. Bruno")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver histórico de versões" }));
  fireEvent.click(screen.getByRole("button", { name: "Corrigir valores" }));
  expect(onShowHistory).toHaveBeenCalledOnce();
  expect(onOpenCorrection).toHaveBeenCalledOnce();
});

test("não expõe rascunho nem comando de correção sem capacidade clínica", () => {
  const activeRevision = { ...revision, status: "Validada" as const, clinicalOutcome: "Alterado" as const, validatedByUserId: "doctor-2", validatedAtUtc: "2026-08-09T14:30:00Z" };
  render(<ExamDetailPanel exam={detail({ status: "Validado", document, activeRevision, draftRevision: revision })} report={{ ...clinicalReport, capabilities: { ...clinicalReport.capabilities, canOpenCorrection: false } }} />);
  expect(screen.queryByText("Correção em rascunho")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Corrigir valores" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Continuar correção" })).not.toBeInTheDocument();
});

test("processando mantém a aba do clique e a direciona ao blob autenticado", async () => {
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:exam-1");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  let revokeCallback = () => undefined;
  const realSetTimeout = window.setTimeout.bind(window);
  const setTimeoutSpy = vi.spyOn(window, "setTimeout").mockImplementation((handler, timeout, ...args) => {
    if (timeout === 60_000 && typeof handler === "function") {
      revokeCallback = () => handler();
      return 1;
    }
    return realSetTimeout(handler, timeout, ...args);
  });
  let resolveDocument: (blob: Blob) => void = () => undefined;
  const loadDocument = vi.fn(() => new Promise<Blob>((resolve) => {
    resolveDocument = resolve;
  }));
  render(<ExamDetailPanel exam={detail({ status: "Processando", document })} loadDocument={loadDocument} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir laudo original em nova aba" }));

  expect(open).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(tab.opener).toBeNull();
  expect(tab.location.href).toBe("");
  expect(loadDocument).toHaveBeenCalledOnce();

  resolveDocument(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
  await waitFor(() => expect(tab.location.href).toBe("blob:exam-1"));
  expect(open).toHaveBeenCalledOnce();
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
  revokeCallback();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:exam-1");
});

test("popup bloqueado informa indisponibilidade sem solicitar o documento", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  const loadDocument = vi.fn().mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
  render(<ExamDetailPanel exam={detail({ status: "Pendente", document })} loadDocument={loadDocument} />);

  fireEvent.click(screen.getByRole("button", { name: "Abrir laudo original em nova aba" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("O laudo original está indisponível no momento.");
  expect(loadDocument).not.toHaveBeenCalled();
});

test("falha do blob fecha a aba provisória e informa indisponibilidade regionalmente", async () => {
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  const loadDocument = vi.fn().mockRejectedValue(new Error("storage key missing"));
  render(<ExamDetailPanel exam={detail({ status: "Falhou", document })} loadDocument={loadDocument} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir laudo original em nova aba" }));
  const regionalError = await screen.findByText("O laudo original está indisponível no momento.");
  expect(regionalError.closest("[role='alert']")).toBeInTheDocument();
  expect(tab.close).toHaveBeenCalledOnce();
  expect(screen.queryByText("storage key missing")).not.toBeInTheDocument();
});

test("documento ausente fora da solicitação mantém o detalhe e marca o original indisponível", () => {
  render(<ExamDetailPanel exam={detail({ status: "Falhou", error: "Falha na extração" })} />);
  expect(screen.getByRole("region", { name: "Documento original" })).toHaveTextContent("Original indisponível");
  expect(screen.getByRole("heading", { name: "Hemograma completo" })).toBeInTheDocument();
});

test("células estruturadas carregam rótulos equivalentes para o layout abaixo de 640px", () => {
  render(<ExamDetailPanel exam={detail({ status: "Em revisão", document, draftRevision: revision, capabilities: { ...capabilities, canEditRevision: true } })} />);
  expect(screen.getByText("Hemoglobina").closest("td")).toHaveAttribute("data-label", "Resultado");
  expect(screen.getByText("10,2 g/dL").closest("td")).toHaveAttribute("data-label", "Valor");
  expect(screen.getByText("12–16 g/dL").closest("td")).toHaveAttribute("data-label", "Referência");
});
