import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type { PatientExamDetail, PatientExamRevision } from "../../../api/types";
import { ExamRevisionEditor } from "./ExamRevisionEditor";

const revision: PatientExamRevision = {
  id: "revision-1",
  number: 1,
  status: "Rascunho",
  aiSuggestedOutcome: "Alterado",
  clinicalOutcome: null,
  averageConfidence: 0.91,
  model: "model-1",
  correctionReason: null,
  createdByUserId: "user-1",
  createdAtUtc: "2026-08-09T10:00:00Z",
  lastEditedByUserId: null,
  updatedAtUtc: null,
  validatedByUserId: null,
  validatedAtUtc: null,
  metadata: { collectedAtLocal: "2026-08-09T09:30:00", issuedOn: "2026-08-09", requesterName: "Dra. Ana", requesterRegistration: "CRM 123" },
  structuredResults: [{ id: "result-1", order: 0, catalogCode: "HB", name: "Hemoglobina", numericValue: 10.2, textValue: null, unit: "g/dL", referenceText: "12–16", outOfRangeSuggestion: true, confidence: 0.92, referenceLowerBound: 12, referenceUpperBound: 16, referenceState: "baixo" }],
  narrativeSections: [{ id: "section-1", order: 0, title: "Conclusão", text: "Sem sinais agudos", confidence: null }],
  structuredFindings: [{ id: "finding-1", order: 0, key: "Ritmo", value: "Sinusal", confidence: 0.98 }],
  extractionIssues: [],
};

const capabilities: PatientExamDetail["capabilities"] = {
  canEditRequest: false,
  canCancelRequest: false,
  canAttachDocument: false,
  canReprocess: false,
  canDiscardFailedExam: false,
  canDiscardExam: false,
  canOpenCorrection: false,
  canEditRevision: true,
  canClassify: false,
  canValidate: true,
};

function detail(overrides: Partial<PatientExamDetail> = {}): PatientExamDetail {
  return {
    id: "exam-1",
    patientId: "patient-1",
    doctorUserId: "doctor-1",
    requestedByUserId: null,
    name: "Hemograma",
    category: "Laboratório",
    scheduledOn: null,
    status: "Em revisão",
    version: 4,
    error: null,
    createdAtUtc: "2026-08-09T10:00:00Z",
    updatedAtUtc: "2026-08-09T10:00:00Z",
    processedAtUtc: "2026-08-09T10:30:00Z",
    cancelledByUserId: null,
    cancelledAtUtc: null,
    document: null,
    activeRevision: null,
    draftRevision: revision,
    attemptsRemaining: 2,
    capabilities,
    ...overrides,
  };
}

const savedDetail = detail({ version: 5 });
const validatedDetail = detail({ status: "Validado", version: 6, draftRevision: null, activeRevision: { ...revision, status: "Validada", clinicalOutcome: "Sem alterações", validatedByUserId: "doctor-1", validatedAtUtc: "2026-08-09T12:00:00Z" } });

const baseProps: React.ComponentProps<typeof ExamRevisionEditor> = {
  exam: detail(),
  onClassify: vi.fn().mockResolvedValue(detail({ category: "Imagem", version: 5 })),
  onSaveDraft: vi.fn().mockResolvedValue(savedDetail),
  onValidate: vi.fn().mockResolvedValue(validatedDetail),
  onCompleted: vi.fn(),
  onReload: vi.fn(),
};

afterEach(() => vi.restoreAllMocks());

async function confirmAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Confirmar restantes" }));
}

async function openFirstNote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Conclusão" }));
}

async function openResultDetails(user: ReturnType<typeof userEvent.setup>, result = "Resultado 1") {
  const group = screen.getByRole("group", { name: result });
  const details = within(group).getByText("Campos complementares e ações").closest("details");
  if (!details?.open) await user.click(within(group).getByText("Campos complementares e ações"));
  return group;
}

test("não monta o editor sem capacidade médica ou rascunho autorizado", () => {
  const { rerender } = render(<ExamRevisionEditor {...baseProps} exam={detail({ capabilities: { ...capabilities, canEditRevision: false } })} />);
  expect(screen.queryByRole("form", { name: "Corrigir resultados do exame" })).not.toBeInTheDocument();
  rerender(<ExamRevisionEditor {...baseProps} exam={detail({ draftRevision: null })} />);
  expect(screen.queryByRole("form", { name: "Corrigir resultados do exame" })).not.toBeInTheDocument();
});

test("exibe descarte no cabeçalho fixo somente quando a capacidade foi concedida", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <ExamRevisionEditor
      {...baseProps}
      exam={detail({ capabilities: { ...capabilities, canDiscardExam: true } })}
      onDiscard={onDiscard}
    />,
  );

  const reviewActions = screen.getByRole("region", { name: "Ações da revisão" });
  expect(reviewActions.closest("header")).toHaveTextContent("Conferir dados extraídos");
  const discard = within(reviewActions).getByRole("button", { name: "Descartar exame" });
  expect(discard).toBeVisible();
  await user.click(discard);
  expect(within(reviewActions).getByRole("region", { name: "Confirmar descarte do exame" })).toBeInTheDocument();
  rerender(<ExamRevisionEditor {...baseProps} exam={detail()} onDiscard={onDiscard} />);
  expect(screen.queryByRole("button", { name: "Descartar exame" })).not.toBeInTheDocument();
});

test("prefill preserva resultados, narrativa e confiança ausente", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} />);
  expect(screen.getByLabelText("Resultado 1 — nome")).toHaveValue("Hemoglobina");
  await openFirstNote(user);
  expect(screen.getByLabelText("Seção 1 — texto")).toHaveValue("Sem sinais agudos");
  expect(screen.getByLabelText("Seção 1 — confiança")).toHaveValue("");
});

test("adiciona resultado e move foco para o primeiro controle novo", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} />);
  await user.click(screen.getByRole("button", { name: "Adicionar resultado" }));
  expect(screen.getByLabelText("Resultado 2 — nome")).toHaveFocus();
  const group = await openResultDetails(user, "Resultado 2");
  expect(within(group).getByLabelText("Estado de referência")).toBeEnabled();
  expect(within(group).getByLabelText("Estado de referência")).toHaveValue("indeterminado");
});

test("não oferece criação de notas e mantém a criação de achados", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} exam={detail({ category: "Imagem" })} />);
  expect(screen.queryByRole("button", { name: "Adicionar nota" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Adicionar achado" }));
  expect(screen.getByLabelText("Achado 2 — chave")).toHaveFocus();
});

test("narrativa clínica aparece na seção principal e entra na conferência", () => {
  render(<ExamRevisionEditor {...baseProps} />);

  expect(screen.getByRole("heading", { name: /Narrativas clínicas/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Marcar Conclusão como conferido" })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "2");
});

test("distingue resultado sem referência de faixa complexa e absoluta sem alterar a conferência", async () => {
  const user = userEvent.setup();
  const structuredResults: PatientExamRevision["structuredResults"] = [
    {
      id: "result-percent", order: 0, catalogCode: null, name: "Segmentados", numericValue: 51.4,
      textValue: "51,4", unit: "%", referenceText: null, outOfRangeSuggestion: null, confidence: 0.99,
      referenceLowerBound: null, referenceUpperBound: null, referenceState: "indeterminado",
    },
    {
      id: "result-complex", order: 1, catalogCode: null, name: "Marcador contextual", numericValue: 20,
      textValue: "20", unit: "U/L", referenceText: "Homens: inferior a 33; mulheres: 10 a 25",
      outOfRangeSuggestion: null, confidence: 0.98, referenceLowerBound: null, referenceUpperBound: null,
      referenceState: "indeterminado",
    },
    {
      id: "result-absolute", order: 2, catalogCode: null, name: "Segmentados absolutos", numericValue: 2850,
      textValue: "2.850", unit: "/mm3", referenceText: "1.526 - 5.020 /mm3", outOfRangeSuggestion: null,
      confidence: 0.99, referenceLowerBound: 1526, referenceUpperBound: 5020, referenceState: "normal",
    },
  ];
  render(
    <ExamRevisionEditor
      {...baseProps}
      exam={detail({ draftRevision: { ...revision, structuredResults, narrativeSections: [], structuredFindings: [] } })}
    />,
  );

  expect(within(screen.getByRole("group", { name: "Resultado 1" })).getByText("Sem referência informada")).toBeVisible();
  expect(within(screen.getByRole("group", { name: "Resultado 2" })).getByText("Indeterminado", { selector: "span" })).toBeVisible();
  const absolute = screen.getByRole("group", { name: "Resultado 3" });
  expect(within(absolute).getByText("Dentro da referência")).toBeVisible();
  expect(within(absolute).getByText("1.526 - 5.020 /mm3")).toBeVisible();
  const progress = screen.getByRole("progressbar", { name: "Progresso da conferência" });
  expect(progress).toHaveAttribute("aria-valuemax", "3");
  await confirmAll(user);
  expect(progress).toHaveAttribute("aria-valuenow", "3");
});

test("reordena mantendo o nome acessível estável e envia a ordem visual", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} />);
  await user.click(screen.getByRole("button", { name: "Adicionar resultado" }));
  await user.type(screen.getByLabelText("Resultado 2 — nome"), "Leucócitos");
  await user.type(screen.getByLabelText("Resultado 2 — valor"), "Normal");
  await user.click(screen.getByRole("button", { name: "Mover Resultado 2 para cima" }));
  const groups = screen.getAllByRole("group", { name: /Resultado \d/ });
  expect(within(groups[0]).getByLabelText("Resultado 2 — nome")).toHaveValue("Leucócitos");
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0].structuredResults.map((item: { name: string; order: number }) => [item.name, item.order])).toEqual([["Leucócitos", 0], ["Hemoglobina", 1]]);
});

test("remoção move foco para o item vizinho", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} exam={detail({ category: "Imagem" })} />);
  await user.click(screen.getByRole("button", { name: "Adicionar achado" }));
  await user.click(screen.getByRole("button", { name: "Remover Achado 1" }));
  expect(screen.getByLabelText("Achado 2 — chave")).toHaveFocus();
});

test("confiança baixa é contextual e não bloqueia o rascunho sem conclusão", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} />);
  const group = await openResultDetails(user);
  await user.clear(within(group).getByLabelText("Confiança"));
  await user.type(within(group).getByLabelText("Confiança"), "0.2");
  expect(screen.getByText("Revisar confiança")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0]).toEqual(expect.objectContaining({ clinicalOutcome: null }));
});

test("validação permanece bloqueada até a conferência e a conclusão clínica", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} />);
  const validate = screen.getByRole("button", { name: "Validar laudo" });
  expect(validate).toBeDisabled();
  await confirmAll(user);
  expect(validate).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Sem alterações");
  expect(validate).toBeEnabled();
});

test("explica pendências de extração sem códigos crus e preserva a validação médica", async () => {
  const user = userEvent.setup();
  const draftRevision = {
    ...revision,
    extractionIssues: [
      { id: "issue-1", structuredResultId: "result-1", page: 4, field: "name", reason: "GENERIC_RESULT_NAME" },
      { id: "issue-2", structuredResultId: null, page: null, field: "patientContext", reason: "PATIENT_CONTEXT_MISMATCH" },
      { id: "issue-3", structuredResultId: "result-1", page: 4, field: "referenceRange", reason: "REFERENCE_CONTEXT_MISSING" },
      { id: "issue-4", structuredResultId: "result-1", page: 4, field: "referenceRange", reason: "AMBIGUOUS_REFERENCE_CONTEXT" },
      { id: "issue-5", structuredResultId: "result-1", page: 4, field: "referenceRange", reason: "REFERENCE_CONTEXT_MISSING" },
      { id: "issue-6", structuredResultId: "result-1", page: 4, field: "numericValue", reason: "UNMAPPED_INTERNAL_REASON" },
    ],
  } satisfies PatientExamRevision;

  render(<ExamRevisionEditor {...baseProps} exam={detail({ draftRevision })} />);

  const warnings = screen.getByRole("region", { name: "Pontos para conferir no laudo" });
  expect(within(warnings).getAllByText("Não foi possível identificar o nome de um resultado. Compare com o laudo original.")).toHaveLength(1);
  expect(within(warnings).getAllByText("Os dados do paciente no laudo divergem do cadastro. Confira antes de validar.")).toHaveLength(1);
  expect(within(warnings).getAllByText("A referência exige um contexto clínico que não pôde ser determinado.")).toHaveLength(1);
  expect(warnings).not.toHaveTextContent("GENERIC_RESULT_NAME");
  expect(warnings).not.toHaveTextContent("UNMAPPED_INTERNAL_REASON");
  expect(screen.queryByRole("button", { name: /reprocessar|processar novamente/i })).not.toBeInTheDocument();

  const validate = screen.getByRole("button", { name: "Validar laudo" });
  expect(validate).toBeDisabled();
  await confirmAll(user);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Sem alterações");
  expect(validate).toBeEnabled();
});

test("validação permanece indisponível em revisão sem conteúdo", async () => {
  const user = userEvent.setup();
  const empty = { ...revision, structuredResults: [], narrativeSections: [], structuredFindings: [] };
  render(<ExamRevisionEditor {...baseProps} exam={detail({ draftRevision: empty })} />);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Inconclusivo");
  expect(screen.getByRole("button", { name: "Confirmar restantes" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Validar laudo" })).toBeDisabled();
});

test("notas auxiliares não entram na conferência e permanecem intactas no payload", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const onValidate = vi.fn().mockResolvedValue(validatedDetail);
  const auxiliarySection = { id: "section-1", order: 0, title: "Observações", text: "Jejum recomendado pelo laboratório", confidence: 0.88 };
  render(
    <ExamRevisionEditor
      {...baseProps}
      exam={detail({ draftRevision: { ...revision, narrativeSections: [auxiliarySection] } })}
      onSaveDraft={onSaveDraft}
      onValidate={onValidate}
    />,
  );

  expect(screen.queryByRole("heading", { name: /Narrativas clínicas/ })).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "1");
  expect(screen.queryByRole("button", { name: /Marcar Observações como conferido/ })).not.toBeInTheDocument();
  await user.click(screen.getByText("Conteúdo adicional do laudo"));
  expect(screen.getByText("Jejum recomendado pelo laboratório")).toBeVisible();
  expect(screen.queryByLabelText("Seção 1 — texto")).not.toBeInTheDocument();

  await confirmAll(user);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Sem alterações");
  await user.click(screen.getByRole("button", { name: "Validar laudo" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0].narrativeSections).toEqual([auxiliarySection]);
  expect(onValidate).toHaveBeenCalledOnce();
});

test("achados laboratoriais ficam somente para consulta e permanecem intactos no payload", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const onValidate = vi.fn().mockResolvedValue(validatedDetail);
  const laboratoryFinding = { id: "finding-1", order: 0, key: "Jejum", value: "12 horas", confidence: 0.81 };
  render(
    <ExamRevisionEditor
      {...baseProps}
      exam={detail({ draftRevision: { ...revision, narrativeSections: [], structuredFindings: [laboratoryFinding] } })}
      onSaveDraft={onSaveDraft}
      onValidate={onValidate}
    />,
  );

  expect(screen.queryByRole("heading", { name: /Achados estruturados/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Adicionar achado" })).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "1");
  await user.click(screen.getByText("Conteúdo adicional do laudo"));
  expect(screen.getByRole("heading", { name: "Jejum" })).toBeVisible();
  expect(screen.getByText("12 horas")).toBeVisible();
  expect(screen.queryByLabelText("Achado 1 — valor")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Marcar Jejum como conferido/ })).not.toBeInTheDocument();

  await confirmAll(user);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Sem alterações");
  await user.click(screen.getByRole("button", { name: "Validar laudo" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0].structuredFindings).toEqual([laboratoryFinding]);
  expect(onValidate).toHaveBeenCalledOnce();
});

test("imagem mantém achados editáveis e obrigatórios na conferência", () => {
  render(<ExamRevisionEditor {...baseProps} exam={detail({ category: "Imagem" })} />);

  expect(screen.getByRole("heading", { name: /Achados estruturados/ })).toBeInTheDocument();
  expect(screen.getByLabelText("Achado 1 — valor")).toHaveValue("Sinusal");
  expect(screen.getByRole("button", { name: "Marcar Ritmo como conferido" })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "3");
});

test("somente achado laboratorial não cria conteúdo clínico confirmável", async () => {
  const user = userEvent.setup();
  const findingOnly = {
    ...revision,
    structuredResults: [],
    narrativeSections: [],
  };
  render(<ExamRevisionEditor {...baseProps} exam={detail({ draftRevision: findingOnly })} />);

  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "0");
  expect(screen.getByRole("button", { name: "Confirmar restantes" })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Inconclusivo");
  expect(screen.getByRole("button", { name: "Validar laudo" })).toBeDisabled();
});

test("revisão contendo somente nota auxiliar permanece sem conteúdo clínico confirmável", async () => {
  const user = userEvent.setup();
  const auxiliaryOnly = {
    ...revision,
    structuredResults: [],
    narrativeSections: [{ id: "section-1", order: 0, title: "Observações", text: "Nota administrativa", confidence: null }],
    structuredFindings: [],
  };
  render(<ExamRevisionEditor {...baseProps} exam={detail({ draftRevision: auxiliaryOnly })} />);

  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuemax", "0");
  expect(screen.getByRole("button", { name: "Confirmar restantes" })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Inconclusivo");
  expect(screen.getByRole("button", { name: "Validar laudo" })).toBeDisabled();
});

test("correção exige motivo e informa que a versão ativa segue publicada", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} exam={detail({ activeRevision: { ...revision, status: "Validada", clinicalOutcome: "Alterado", validatedByUserId: "doctor-1", validatedAtUtc: "2026-08-09T11:00:00Z" } })} />);
  expect(screen.getByText("A versão validada atual permanece publicada até esta correção ser validada.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect(await screen.findByText("Explique o motivo da correção.")).toBeInTheDocument();
  expect(screen.getByLabelText("Motivo da correção")).toHaveFocus();
});

test("rascunho envia conteúdo normalizado, revisão e versão sem validar", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const onValidate = vi.fn();
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} onValidate={onValidate} />);
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ revisionId: "revision-1", expectedVersion: 4, clinicalOutcome: null })));
  expect(onValidate).not.toHaveBeenCalled();
});

test("rascunho preserva metadados, limites e estado clínico dos resultados existentes", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} />);

  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0]).toEqual(expect.objectContaining({
    metadata: revision.metadata,
    structuredResults: [expect.objectContaining({
      referenceLowerBound: 12,
      referenceUpperBound: 16,
      referenceState: "baixo",
    })],
  }));
});

test("permite revisar explicitamente o estado quando não há limites numéricos", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const resultWithoutBounds = {
    ...revision.structuredResults[0],
    referenceLowerBound: null,
    referenceUpperBound: null,
    referenceState: "indeterminado" as const,
  };
  render(
    <ExamRevisionEditor
      {...baseProps}
      exam={detail({ draftRevision: { ...revision, structuredResults: [resultWithoutBounds] } })}
      onSaveDraft={onSaveDraft}
    />,
  );

  const group = await openResultDetails(user);
  const state = within(group).getByLabelText("Estado de referência");
  expect(state).toBeEnabled();
  await user.selectOptions(state, "elevado");
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0].structuredResults[0]).toEqual(
    expect.objectContaining({
      referenceLowerBound: null,
      referenceUpperBound: null,
      referenceState: "elevado",
    }),
  );
});

test("mantém limites no payload ao revisar um valor que atravessa a faixa", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} />);

  const group = await openResultDetails(user);
  const state = within(group).getByLabelText("Estado de referência");
  expect(state).toBeDisabled();
  expect(screen.getByText("Recalculado ao salvar a partir dos limites numéricos.")).toBeVisible();
  await user.clear(screen.getByLabelText("Resultado 1 — valor"));
  await user.type(screen.getByLabelText("Resultado 1 — valor"), "17");
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
  expect(onSaveDraft.mock.calls[0][0].structuredResults[0]).toEqual(
    expect.objectContaining({
      numericValue: 17,
      referenceLowerBound: 12,
      referenceUpperBound: 16,
      referenceState: "baixo",
    }),
  );
});

test("salvar e validar usa a versão retornada pelo save e conclui", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const onValidate = vi.fn().mockResolvedValue(validatedDetail);
  const onCompleted = vi.fn();
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} onValidate={onValidate} onCompleted={onCompleted} />);
  await confirmAll(user);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Sem alterações");
  await user.click(screen.getByRole("button", { name: "Validar laudo" }));
  await waitFor(() => expect(onValidate).toHaveBeenCalledWith({ revisionId: "revision-1", clinicalOutcome: "Sem alterações", expectedVersion: 5 }));
  expect(onCompleted).toHaveBeenCalledWith(validatedDetail);
});

test("Inconclusivo valida com sucesso e preserva o outcome exato", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockResolvedValue(savedDetail);
  const inconclusive = detail({
    status: "Validado",
    version: 6,
    draftRevision: null,
    activeRevision: { ...revision, status: "Validada", clinicalOutcome: "Inconclusivo", validatedByUserId: "doctor-1", validatedAtUtc: "2026-08-09T12:00:00Z" },
  });
  const onValidate = vi.fn().mockResolvedValue(inconclusive);
  const onCompleted = vi.fn();
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} onValidate={onValidate} onCompleted={onCompleted} />);

  await confirmAll(user);
  await user.selectOptions(screen.getByLabelText("Conclusão clínica"), "Inconclusivo");
  await user.click(screen.getByRole("button", { name: "Validar laudo" }));

  await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ clinicalOutcome: "Inconclusivo" })));
  expect(onValidate).toHaveBeenCalledWith({ revisionId: "revision-1", clinicalOutcome: "Inconclusivo", expectedVersion: 5 });
  expect(onCompleted).toHaveBeenCalledWith(inconclusive);
});

test("exame não classificado exige categoria clínica no editor antes de validar", async () => {
  const user = userEvent.setup();
  const classified = detail({
    category: "Imagem",
    version: 5,
    capabilities: { ...capabilities, canClassify: false, canValidate: true },
  });
  const onClassify = vi.fn().mockResolvedValue(classified);
  const onCompleted = vi.fn();
  render(<ExamRevisionEditor
    {...baseProps}
    exam={detail({
      category: "Não classificado",
      document: { fileName: "laudo.pdf", contentType: "application/pdf", sizeBytes: 100, source: "Paciente", createdAtUtc: "2026-08-09T10:00:00Z", processingAttempts: 1 },
      capabilities: { ...capabilities, canClassify: true, canValidate: false },
    })}
    onClassify={onClassify}
    onCompleted={onCompleted}
  />);

  expect(screen.queryByRole("button", { name: "Validar laudo" })).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText("Resultado 1 — nome"));
  await user.type(screen.getByLabelText("Resultado 1 — nome"), "Hemoglobina local");
  await user.selectOptions(screen.getByLabelText("Categoria clínica do exame"), "Imagem");
  await user.click(screen.getByRole("button", { name: "Classificar exame" }));

  await waitFor(() => expect(onClassify).toHaveBeenCalledWith({ category: "Imagem", expectedVersion: 4 }));
  expect(screen.getByLabelText("Resultado 1 — nome")).toHaveValue("Hemoglobina local");
  expect(onCompleted).toHaveBeenCalledWith(classified);
});

test("409 da classificação preserva categoria e conteúdo local", async () => {
  const user = userEvent.setup();
  const onClassify = vi.fn().mockRejectedValue(new ApiError("Conflito", 409, { currentVersion: 8 }));
  const onReload = vi.fn();
  render(<ExamRevisionEditor
    {...baseProps}
    exam={detail({
      category: "Não classificado",
      document: { fileName: "laudo.pdf", contentType: "application/pdf", sizeBytes: 100, source: "Paciente", createdAtUtc: "2026-08-09T10:00:00Z", processingAttempts: 1 },
      capabilities: { ...capabilities, canClassify: true, canValidate: false },
    })}
    onClassify={onClassify}
    onReload={onReload}
  />);

  await openFirstNote(user);
  await user.clear(screen.getByLabelText("Seção 1 — texto"));
  await user.type(screen.getByLabelText("Seção 1 — texto"), "Narrativa local");
  await user.selectOptions(screen.getByLabelText("Categoria clínica do exame"), "Cardiologia");
  await user.click(screen.getByRole("button", { name: "Classificar exame" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Seus campos foram preservados");
  expect(screen.getByLabelText("Categoria clínica do exame")).toHaveValue("Cardiologia");
  expect(screen.getByLabelText("Seção 1 — texto")).toHaveValue("Narrativa local");
  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  expect(onReload).toHaveBeenCalledOnce();
});

test("409 preserva todas as edições locais e oferece recarregar", async () => {
  const user = userEvent.setup();
  const onSaveDraft = vi.fn().mockRejectedValue(new ApiError("Conflito", 409, { currentVersion: 8 }));
  const onReload = vi.fn();
  render(<ExamRevisionEditor {...baseProps} onSaveDraft={onSaveDraft} onReload={onReload} />);
  await openFirstNote(user);
  await user.clear(screen.getByLabelText("Resultado 1 — nome"));
  await user.type(screen.getByLabelText("Resultado 1 — nome"), "Hemoglobina corrigida");
  await user.clear(screen.getByLabelText("Seção 1 — texto"));
  await user.type(screen.getByLabelText("Seção 1 — texto"), "Texto corrigido");
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Seus campos foram preservados");
  expect(screen.getByLabelText("Resultado 1 — nome")).toHaveValue("Hemoglobina corrigida");
  expect(screen.getByLabelText("Seção 1 — texto")).toHaveValue("Texto corrigido");
  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  expect(onReload).toHaveBeenCalledOnce();
});

test("rascunho permanece somente em memória do formulário", async () => {
  const user = userEvent.setup();
  const local = vi.spyOn(Storage.prototype, "setItem");
  render(<ExamRevisionEditor {...baseProps} />);
  await user.type(screen.getByLabelText("Resultado 1 — nome"), " editado");
  fireEvent.blur(screen.getByLabelText("Resultado 1 — nome"));
  expect(local).not.toHaveBeenCalled();
});

test("editar um item já conferido reabre a pendência", async () => {
  const user = userEvent.setup();
  render(<ExamRevisionEditor {...baseProps} />);
  await confirmAll(user);

  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuenow", "2");
  await user.clear(screen.getByLabelText("Resultado 1 — valor"));
  await user.type(screen.getByLabelText("Resultado 1 — valor"), "11,4");

  expect(screen.getByRole("progressbar", { name: "Progresso da conferência" })).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByRole("button", { name: "Validar laudo" })).toBeDisabled();
});

test("carrega o PDF autenticado e revoga a URL temporária ao desmontar", async () => {
  const createObjectURL = vi.fn(() => "blob:laudo-sintetico");
  const revokeObjectURL = vi.fn();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  const loadDocument = vi.fn().mockResolvedValue(new Blob(["%PDF-1.7\nfixture"], { type: "application/pdf" }));

  try {
    const rendered = render(<ExamRevisionEditor {...baseProps} exam={detail({ document: { fileName: "laudo.pdf", contentType: "application/pdf", sizeBytes: 17, source: "Paciente", createdAtUtc: "2026-08-09T10:00:00Z", processingAttempts: 1 } })} loadDocument={loadDocument} />);
    expect(await screen.findByTitle("Visualização do laudo original")).toHaveAttribute("src", "blob:laudo-sintetico");
    expect(screen.getByRole("link", { name: /Abrir em nova aba/ })).toHaveAttribute("href", "blob:laudo-sintetico");
    expect(loadDocument).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:laudo-sintetico");
  } finally {
    if (originalCreateObjectURL) Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    else Reflect.deleteProperty(URL, "createObjectURL");
    if (originalRevokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
    else Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});
