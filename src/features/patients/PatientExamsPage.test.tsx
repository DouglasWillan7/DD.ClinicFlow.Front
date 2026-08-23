import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { Patient } from "../../api/types";
import { PatientExamsPage } from "./PatientExamsPage";
import { clinicalReportKeys } from "./exams/clinicalReportQueries";
import {
  examKeys,
  normalizePatientExamDetail,
  type PatientExamDetailTransport,
} from "./exams/examQueries";

const { requestMock, requestBlobMock, realtimeViewMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  requestBlobMock: vi.fn(),
  realtimeViewMock: vi.fn(() => "connected"),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, requestBlob: requestBlobMock }),
}));
vi.mock("./exams/ExamRealtimeProvider", () => ({
  useExamRealtimeView: realtimeViewMock,
}));

const patient: Patient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cpf: "52998224725",
  medicalRecordNumber: 48213,
  bloodType: null,
  sexForClinicalUse: null,
  name: "Rita de Cássia Alves",
  phone: "+5511988776655",
  birthDate: "1984-03-12",
  notes: null,
  doctorUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  isActive: true,
  whatsappConsentAtUtc: null,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

const summaries = [
  { id: "11111111-1111-4111-8111-111111111111", patientId: patient.id, name: "Perfil lipídico", category: "Laboratorio", scheduledOn: null, status: "EmRevisao", version: 2, hasDocument: true, averageConfidence: 0.92, createdAtUtc: "2026-08-09T10:00:00Z", updatedAtUtc: "2026-08-09T11:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", patientId: patient.id, name: "Hemograma", category: "Laboratorio", scheduledOn: "2026-08-15", status: "Solicitado", version: 1, hasDocument: false, averageConfidence: null, createdAtUtc: "2026-08-09T09:00:00Z", updatedAtUtc: "2026-08-09T09:00:00Z" },
];

const capabilities = { canEditRequest: false, canCancelRequest: false, canAttachDocument: false, canReprocess: false, canDiscardFailedExam: false, canDiscardExam: false, canOpenCorrection: false, canEditRevision: true, canClassify: false, canValidate: true };

function rawDetail(id = summaries[0].id, overrides: Record<string, unknown> = {}) {
  return {
    id,
    patientId: patient.id,
    doctorUserId: patient.doctorUserId,
    requestedByUserId: patient.doctorUserId,
    name: id === summaries[1].id ? "Hemograma" : "Perfil lipídico",
    category: "Laboratorio",
    scheduledOn: null,
    status: "EmRevisao",
    version: 2,
    error: null,
    createdAtUtc: "2026-08-09T10:00:00Z",
    updatedAtUtc: "2026-08-09T11:00:00Z",
    processedAtUtc: "2026-08-09T11:00:00Z",
    cancelledByUserId: null,
    cancelledAtUtc: null,
    document: { fileName: "perfil.pdf", contentType: "application/pdf", sizeBytes: 2048, source: "Clinica", createdAtUtc: "2026-08-09T10:00:00Z", processingAttempts: 1 },
    activeRevision: null,
    draftRevision: { id: "revision-1", number: 1, status: "Rascunho", aiSuggestedOutcome: "Alterado", clinicalOutcome: null, averageConfidence: 0.92, model: "model", correctionReason: null, createdByUserId: patient.doctorUserId, createdAtUtc: "2026-08-09T10:00:00Z", lastEditedByUserId: null, updatedAtUtc: null, validatedByUserId: null, validatedAtUtc: null, structuredResults: [{ id: "result-1", order: 0, catalogCode: "LDL", name: "LDL", numericValue: 160, textValue: null, unit: "mg/dL", referenceText: "< 130", outOfRangeSuggestion: true, confidence: 0.92 }], narrativeSections: [], structuredFindings: [] },
    attemptsRemaining: 2,
    capabilities,
    ...overrides,
  };
}

function rawClinicalReport(overrides: Record<string, unknown> = {}) {
  return {
    id: summaries[0].id,
    patientId: patient.id,
    name: "Perfil lipídico",
    category: "Laboratório",
    clinicalOutcome: "Alterado",
    version: 2,
    metadata: {
      collectedAtLocal: "2026-08-09T08:00:00",
      issuedOn: "2026-08-09",
      validatedAtUtc: "2026-08-09T14:30:00Z",
      requesterName: "Dra. Ana",
      requesterRegistration: "CRM-SP 123",
      validatorName: "Dr. Bruno",
    },
    document: { fileName: "perfil.pdf", sizeBytes: 2_048, source: "Clínica", pageCount: 2 },
    findings: [{ resultId: "result-1", name: "LDL", valueText: "160", unit: "mg/dL", referenceText: "< 130 mg/dL", referenceState: "elevado", deltaPercent: 20 }],
    structuredFindings: [],
    results: [{ id: "result-1", catalogCode: "LDL", name: "LDL", subtitle: null, numericValue: 160, valueText: "160", unit: "mg/dL", referenceText: "< 130 mg/dL", detailedReferenceText: null, referenceState: "elevado", confidence: 0.97, deltaPercent: 20, history: [] }],
    notes: [],
    capabilities: { canOpenDocument: true, canViewHistory: true, canOpenCorrection: true },
    ...overrides,
  };
}

function pagePayload(overrides: Record<string, unknown> = {}) {
  return { items: summaries, nextCursor: null, capabilities: { canRequest: true, canAttachDocument: true }, ...overrides };
}

function defaultRequest(path: string, init?: RequestInit) {
  if (path === `/patients/${patient.id}`) return Promise.resolve(patient);
  if (path.startsWith(`/exams/patients/${patient.id}`) && (!init || init.method === undefined)) return Promise.resolve(pagePayload());
  if (path.startsWith("/exams/") && (!init || init.method === undefined)) return Promise.resolve(rawDetail(path.split("/")[2]));
  return Promise.reject(new Error(`rota inesperada: ${path} ${init?.method ?? "GET"}`));
}

function renderPage(
  url = `/app/pacientes/${patient.id}/exames`,
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  window.history.replaceState({}, "", url);
  return { client, ...render(<QueryClientProvider client={client}><PatientExamsPage patientId={patient.id} /></QueryClientProvider>) };
}

beforeEach(() => {
  requestMock.mockReset();
  requestBlobMock.mockReset();
  realtimeViewMock.mockClear();
  requestMock.mockImplementation(defaultRequest);
  requestBlobMock.mockResolvedValue(new Blob(["%PDF-1.7\nfixture"], { type: "application/pdf" }));
});

test("carregamento inicial preserva skeletons distintos de lista e detalhe", () => {
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/patients/${patient.id}`) return new Promise(() => undefined);
    return defaultRequest(path, init);
  });
  renderPage();

  expect(screen.getByRole("status")).toHaveTextContent("Carregando paciente e exames");
  expect(screen.getByTestId("exam-list-initial-skeleton")).toBeInTheDocument();
  expect(screen.getByTestId("exam-detail-initial-skeleton")).toBeInTheDocument();
});

test("deep link de revisão abre o workspace focado e o documento autenticado", async () => {
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);
  expect(await screen.findByRole("heading", { name: "Conferir dados extraídos" })).toBeInTheDocument();
  expect(screen.getByText("Em revisão")).toBeInTheDocument();
  expect(screen.getByLabelText("Resultado 1 — nome")).toHaveValue("LDL");
  expect(requestMock).toHaveBeenCalledWith(`/patients/${patient.id}`);
  expect(requestMock).toHaveBeenCalledWith(`/exams/${summaries[0].id}`);
  expect(requestBlobMock).toHaveBeenCalledWith(`/exams/${summaries[0].id}/document`);
  expect(requestMock).not.toHaveBeenCalledWith(`/exams/${summaries[0].id}/report`);
});

test("deep link validado consulta e renderiza somente o relatório clínico", async () => {
  const activeRevision = {
    ...rawDetail().draftRevision,
    status: "Validada",
    clinicalOutcome: "Alterado",
    validatedByUserId: patient.doctorUserId,
    validatedAtUtc: "2026-08-09T14:30:00Z",
  };
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      return Promise.resolve(rawDetail(summaries[0].id, {
        status: "Validado",
        activeRevision,
        draftRevision: null,
        capabilities: { ...capabilities, canOpenCorrection: true },
      }));
    }
    if (path === `/exams/${summaries[0].id}/report` && !init?.method) {
      return Promise.resolve(rawClinicalReport());
    }
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}&origem=visao-geral`);

  expect(await screen.findByRole("table", { name: "Todos os resultados" })).toBeInTheDocument();
  expect(requestMock).toHaveBeenCalledWith(`/exams/${summaries[0].id}/report`);
  expect(screen.queryByText("Conclusão confirmada")).not.toBeInTheDocument();
  expect(screen.queryByText("Sugestão da IA")).not.toBeInTheDocument();
  expect(window.location.search).toBe(`?exame=${summaries[0].id}&origem=visao-geral`);
});

test("seleção validada inicia detalhe e relatório em paralelo a partir da lista", async () => {
  let resolveDetail: (value: PatientExamDetailTransport) => void = () => undefined;
  const detailPromise = new Promise<PatientExamDetailTransport>((resolve) => {
    resolveDetail = resolve;
  });
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({
        items: [{ ...summaries[0], status: "Validado" }, summaries[1]],
      }));
    }
    if (path === `/exams/${summaries[0].id}` && !init?.method) return detailPromise;
    if (path === `/exams/${summaries[0].id}/report` && !init?.method) return Promise.resolve(rawClinicalReport());
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(`/exams/${summaries[0].id}/report`));
  resolveDetail(rawDetail(summaries[0].id, {
    status: "Validado",
    activeRevision: { ...rawDetail().draftRevision, status: "Validada" },
    draftRevision: null,
  }) as PatientExamDetailTransport);
  expect(await screen.findByRole("table", { name: "Todos os resultados" })).toBeInTheDocument();
});

test("primeira validação atualiza laudo e resumo já em cache sem remount ou foco", async () => {
  const user = userEvent.setup();
  const cachedReport = rawClinicalReport();
  const updatedReport = rawClinicalReport({
    version: 3,
    findings: [{ ...cachedReport.findings[0], valueText: "175" }],
    results: [{ ...cachedReport.results[0], numericValue: 175, valueText: "175" }],
  });
  let currentSummary = {
    latestReport: cachedReport,
    totalFindingCount: 1,
    structuredFindings: [],
    findings: cachedReport.findings,
    trends: [],
    latestCollectionDate: "2026-08-09T08:00:00",
    capabilities,
  };
  const updatedSummary = {
    ...currentSummary,
    latestReport: updatedReport,
    findings: updatedReport.findings,
  };
  const validatedDetailPayload = rawDetail(summaries[0].id, {
    status: "Validado",
    version: 4,
    activeRevision: {
      ...rawDetail().draftRevision,
      status: "Validada",
      clinicalOutcome: "Alterado",
      validatedByUserId: patient.doctorUserId,
      validatedAtUtc: "2026-08-09T14:30:00Z",
    },
    draftRevision: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  await client.prefetchQuery({ queryKey: clinicalReportKeys.report(summaries[0].id), queryFn: async () => cachedReport });
  await client.prefetchQuery({ queryKey: clinicalReportKeys.summary(patient.id), queryFn: async () => currentSummary });

  let validated = false;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      if (!validated) return Promise.resolve(rawDetail());
      return Promise.resolve(rawDetail(summaries[0].id, {
        status: "Validado",
        version: 3,
        activeRevision: {
          ...rawDetail().draftRevision,
          status: "Validada",
          clinicalOutcome: "Alterado",
          validatedByUserId: patient.doctorUserId,
          validatedAtUtc: "2026-08-09T14:30:00Z",
        },
        draftRevision: null,
      }));
    }
    if (path === `/exams/${summaries[0].id}/revision` && init?.method === "PUT") {
      return Promise.resolve(rawDetail(summaries[0].id, { version: 3 }));
    }
    if (path === `/exams/${summaries[0].id}/validate` && init?.method === "POST") {
      validated = true;
      currentSummary = updatedSummary;
      return Promise.resolve(validatedDetailPayload);
    }
    if (path === `/exams/${summaries[0].id}/report` && !init?.method) return Promise.resolve(updatedReport);
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`, client);
  await user.click(await screen.findByRole("button", { name: "Confirmar restantes" }));
  await user.selectOptions(await screen.findByLabelText("Conclusão clínica"), "Alterado");
  await user.click(screen.getByRole("button", { name: "Validar laudo" }));

  expect(within(await screen.findByRole("table", { name: "Todos os resultados" })).getByText("175")).toBeInTheDocument();
  expect(client.getQueryData(examKeys.detail(summaries[0].id))).toEqual(
    normalizePatientExamDetail(validatedDetailPayload as PatientExamDetailTransport),
  );
  expect(requestMock.mock.calls.filter(([path, init]) =>
    path === `/exams/${summaries[0].id}` && !(init as RequestInit | undefined)?.method)).toHaveLength(1);
  await waitFor(() => expect(requestMock.mock.calls.filter(([path, init]) =>
    typeof path === "string" && path.startsWith(`/exams/patients/${patient.id}`) &&
    !(init as RequestInit | undefined)?.method).length).toBeGreaterThanOrEqual(2));
  await waitFor(() => expect(client.getQueryData(clinicalReportKeys.summary(patient.id))).toEqual(updatedSummary));
});

test("loading e falha do relatório validado permanecem na coluna de detalhe", async () => {
  const activeRevision = {
    ...rawDetail().draftRevision,
    status: "Validada",
    clinicalOutcome: "Alterado",
    validatedByUserId: patient.doctorUserId,
    validatedAtUtc: "2026-08-09T14:30:00Z",
  };
  const deferredReport: { reject: (reason?: unknown) => void } = {
    reject: () => undefined,
  };
  const reportPromise = new Promise((_, reject) => {
    deferredReport.reject = reject;
  });
  let reportAttempts = 0;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      return Promise.resolve(rawDetail(summaries[0].id, {
        status: "Validado",
        activeRevision,
        draftRevision: null,
      }));
    }
    if (path === `/exams/${summaries[0].id}/report` && !init?.method) {
      reportAttempts += 1;
      return reportAttempts === 1 ? reportPromise : Promise.resolve(rawClinicalReport());
    }
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);

  expect(await screen.findByText("Carregando laudo validado…")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Perfil lipídico" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toBeInTheDocument();

  deferredReport.reject(new Error("report offline"));
  expect(await screen.findByText("Não foi possível carregar o laudo validado.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Perfil lipídico" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("table", { name: "Todos os resultados" })).toBeInTheDocument();
  expect(reportAttempts).toBe(2);
});

test("seleção troca somente a query e busca o novo detalhe", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: /Hemograma/ }));
  await waitFor(() => expect(window.location.search).toBe(`?exame=${summaries[1].id}`));
  expect(requestMock).toHaveBeenCalledWith(`/exams/${summaries[1].id}`);
});

test("busca, status e categoria consultam a lista sem remover exame selecionado", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      return Promise.resolve(rawDetail(summaries[0].id, { status: "Processando", draftRevision: null, capabilities: { ...capabilities, canEditRevision: false, canValidate: false } }));
    }
    return defaultRequest(path, init);
  });
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}&origem=atalho`);
  await screen.findByRole("heading", { name: "Perfil lipídico" });

  await user.type(screen.getByRole("searchbox", { name: "Buscar exames" }), "perfil");
  await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Em revisão");
  await user.selectOptions(screen.getByRole("combobox", { name: "Categoria" }), "Laboratório");

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/patients/${patient.id}?search=perfil&statuses=EmRevisao&categories=Laboratorio`,
  ));
  expect(window.location.search).toBe(`?exame=${summaries[0].id}&origem=atalho`);
  expect(screen.getByRole("heading", { name: "Perfil lipídico" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Buscar exames" })).toHaveValue("perfil");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("Em revisão");
  expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveValue("Laboratório");
});

test("carregar mais anexa sem duplicar e preserva filtros e grupos operacionais", async () => {
  const user = userEvent.setup();
  const firstPage = [
    { ...summaries[0], id: "30000000-0000-4000-8000-000000000001", name: "Exame para revisar", status: "EmRevisao" },
    { ...summaries[0], id: "30000000-0000-4000-8000-000000000002", name: "Exame repetido", status: "Processando" },
  ];
  const secondPage = [
    firstPage[1],
    { ...summaries[0], id: "30000000-0000-4000-8000-000000000003", name: "Exame com falha", status: "Falhou" },
    { ...summaries[0], id: "30000000-0000-4000-8000-000000000004", name: "Exame validado", status: "Validado" },
  ];
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      const query = new URL(path, "http://clinicflow.test").searchParams;
      if (query.get("search") === "Exame" && query.get("categories") === "Laboratorio") {
        return Promise.resolve(pagePayload({
          items: query.get("cursor") === "cursor-2" ? secondPage : firstPage,
          nextCursor: query.get("cursor") === "cursor-2" ? null : "cursor-2",
        }));
      }
    }
    return defaultRequest(path, init);
  });
  renderPage();

  await user.type(await screen.findByRole("searchbox", { name: "Buscar exames" }), "Exame");
  await user.selectOptions(screen.getByRole("combobox", { name: "Categoria" }), "Laboratório");
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/patients/${patient.id}?search=Exame&categories=Laboratorio`,
  ));
  await user.click(await screen.findByRole("button", { name: "Carregar mais" }));

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/patients/${patient.id}?search=Exame&categories=Laboratorio&cursor=cursor-2`,
  ));
  expect(screen.getAllByRole("button", { name: /Exame repetido/ })).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
    "Revisar", "Falhas", "Em andamento", "Histórico validado",
  ]);
  expect(screen.getByRole("button", { name: /Exame para revisar/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Exame com falha/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Exame validado/ })).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Buscar exames" })).toHaveValue("Exame");
  expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveValue("Laboratório");
  expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
});

test("nenhum resultado mantém filtros visíveis e limpar filtros reseta todos", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}?`) && !init?.method) {
      return Promise.resolve(pagePayload({ items: [], nextCursor: null }));
    }
    return defaultRequest(path, init);
  });
  renderPage();
  await screen.findByText("Perfil lipídico");

  await user.type(screen.getByRole("searchbox", { name: "Buscar exames" }), "sem correspondência");
  await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Falhou");
  await user.selectOptions(screen.getByRole("combobox", { name: "Categoria" }), "Imagem");
  await user.click(screen.getByRole("checkbox", { name: "Incluir cancelados" }));

  expect(await screen.findByText("Nenhum exame corresponde aos filtros.")).toBeInTheDocument();
  const filters = screen.getByLabelText("Filtros de exames");
  expect(within(filters).getByRole("combobox", { name: "Status" })).toHaveValue("Falhou");
  expect(within(filters).getByRole("combobox", { name: "Categoria" })).toHaveValue("Imagem");
  expect(within(filters).getByRole("checkbox", { name: "Incluir cancelados" })).toBeChecked();
  expect(screen.getByRole("searchbox", { name: "Buscar exames" })).toHaveValue("sem correspondência");

  requestMock.mockClear();
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(`/exams/patients/${patient.id}`));
  expect(screen.getByRole("searchbox", { name: "Buscar exames" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveValue("");
  expect(screen.getByRole("checkbox", { name: "Incluir cancelados" })).not.toBeChecked();
  expect(await screen.findByText("Perfil lipídico")).toBeInTheDocument();
});

test("query acao anexar abre o modal de anexar laudo", async () => {
  renderPage(`/app/pacientes/${patient.id}/exames?acao=anexar`);
  expect(await screen.findByRole("dialog", { name: "Anexar laudo" })).toBeInTheDocument();
});

test("cabeçalho expõe uma ação por capacidade e reabre composer após fechar", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Perfil lipídico");

  const requestLink = screen.getByRole("link", { name: "Solicitar exame" });
  const attachLink = screen.getByRole("link", { name: "Anexar laudo" });
  expect(screen.queryByRole("button", { name: "Solicitar exame" }))
    .not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Anexar laudo" }))
    .not.toBeInTheDocument();

  await user.click(attachLink);
  expect(await screen.findByRole("dialog", { name: "Anexar laudo" }))
    .toBeVisible();
  await user.click(screen.getByRole("button", { name: "Fechar" }));
  await waitFor(() => expect(window.location.search).toBe(""));

  await user.click(requestLink);
  expect(await screen.findByRole("region", { name: "Solicitar exame" }))
    .toBeVisible();
});

test("capabilities escondem comandos Doctor mas mantêm leitura operacional", async () => {
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) return Promise.resolve(pagePayload({ capabilities: { canRequest: false, canAttachDocument: true } }));
    return defaultRequest(path, init);
  });
  renderPage();
  expect(await screen.findByText("Perfil lipídico")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Solicitar exame" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Anexar laudo" })).toBeInTheDocument();
});

test("ação permitida no vazio abre a solicitação inline", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({ items: [], capabilities: { canRequest: true, canAttachDocument: false } }));
    }
    return defaultRequest(path, init);
  });
  renderPage();

  const empty = await screen.findByRole("region", { name: "Começar histórico de exames" });
  expect(within(empty).queryByRole("button", { name: "Anexar laudo" })).not.toBeInTheDocument();
  await user.click(within(empty).getByRole("button", { name: "Solicitar exame" }));

  expect(await screen.findByRole("region", { name: "Solicitar exame" })).toBeInTheDocument();
  expect(window.location.search).toBe("?acao=solicitar");
});

test("acesso operacional no vazio abre somente o anexo", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({ items: [], capabilities: { canRequest: false, canAttachDocument: true } }));
    }
    return defaultRequest(path, init);
  });
  renderPage();

  const empty = await screen.findByRole("region", { name: "Começar histórico de exames" });
  expect(within(empty).queryByRole("button", { name: "Solicitar exame" })).not.toBeInTheDocument();
  await user.click(within(empty).getByRole("button", { name: "Anexar laudo" }));

  expect(await screen.findByRole("dialog", { name: "Anexar laudo" })).toBeInTheDocument();
  expect(window.location.search).toBe("?acao=anexar");
});

test("falha da lista preserva detalhe selecionado e oferece retry específico", async () => {
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) return Promise.reject(new Error("list offline"));
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      return Promise.resolve(rawDetail(summaries[0].id, { status: "Processando", draftRevision: null, capabilities: { ...capabilities, canEditRevision: false, canValidate: false } }));
    }
    return defaultRequest(path, init);
  });
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);
  expect(await screen.findByText("Não foi possível carregar os exames.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Perfil lipídico" })).toBeInTheDocument();
});

test("falha do detalhe preserva lista e oferece retry regional", async () => {
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) return Promise.reject(new Error("detail offline"));
    return defaultRequest(path, init);
  });
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);
  expect(await screen.findByText("Não foi possível carregar este exame.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toBeInTheDocument();
});

test("reprocessa falha pelo endpoint tipado e preserva seleção", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) return Promise.resolve(rawDetail(summaries[0].id, { status: "Falhou", error: "Falha sanitizada", draftRevision: null, capabilities: { ...capabilities, canEditRevision: false, canValidate: false, canReprocess: true } }));
    if (path === `/exams/${summaries[0].id}/reprocess` && init?.method === "POST") return Promise.resolve(rawDetail(summaries[0].id, { status: "Pendente", draftRevision: null }));
    return defaultRequest(path, init);
  });
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);
  await user.click(await screen.findByRole("button", { name: "Tentar processar novamente" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(`/exams/${summaries[0].id}/reprocess`, { method: "POST" }));
  expect(window.location.search).toContain(summaries[0].id);
});

test("troca entre falhas cacheadas exige nova confirmação para o exame selecionado", async () => {
  const user = userEvent.setup();
  const firstId = summaries[0].id;
  const secondId = summaries[1].id;
  const failedCapabilities = {
    ...capabilities,
    canEditRevision: false,
    canValidate: false,
    canDiscardFailedExam: true,
  };
  const failedSummaries = summaries.map((summary) => ({
    ...summary,
    status: "Falhou",
    hasDocument: true,
  }));
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(examKeys.detail(firstId), normalizePatientExamDetail(rawDetail(firstId, {
    status: "Falhou",
    version: 7,
    error: "Falha A",
    draftRevision: null,
    capabilities: failedCapabilities,
  }) as PatientExamDetailTransport));
  client.setQueryData(examKeys.detail(secondId), normalizePatientExamDetail(rawDetail(secondId, {
    status: "Falhou",
    version: 9,
    error: "Falha B",
    draftRevision: null,
    capabilities: failedCapabilities,
  }) as PatientExamDetailTransport));
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({ items: failedSummaries }));
    }
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${firstId}`, client);
  await user.click(await screen.findByRole("button", { name: "Descartar laudo" }));
  expect(screen.getByRole("region", { name: "Confirmar descarte do laudo" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Hemograma/ }));
  await waitFor(() => expect(window.location.search).toBe(`?exame=${secondId}`));

  expect(screen.getByRole("heading", { name: "Hemograma" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Confirmar descarte do laudo" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Descartar laudo" })).toBeInTheDocument();
  expect(requestMock.mock.calls.some(([path, init]) => path.endsWith("/discard") && init?.method === "POST"))
    .toBe(false);
});

test("descarta revisão com a versão selecionada, limpa o detalhe e abre o fluxo de anexo", async () => {
  const user = userEvent.setup();
  const reviewId = summaries[0].id;
  const reviewVersion = 7;
  let discarded = false;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({
        items: discarded ? summaries.filter((exam) => exam.id !== reviewId) : summaries,
      }));
    }
    if (path === `/exams/${reviewId}` && !init?.method) {
      return Promise.resolve(rawDetail(reviewId, {
        status: "EmRevisao",
        version: reviewVersion,
        capabilities: { ...capabilities, canDiscardExam: true },
      }));
    }
    if (path === `/exams/${reviewId}/discard` && init?.method === "POST") {
      discarded = true;
      return Promise.resolve(rawDetail(reviewId, {
        status: "Cancelado",
        version: reviewVersion + 1,
        capabilities: { ...capabilities, canEditRevision: false, canValidate: false },
      }));
    }
    return defaultRequest(path, init);
  });

  const { client } = renderPage(`/app/pacientes/${patient.id}/exames?exame=${reviewId}`);
  await user.click(await screen.findByRole("button", { name: "Descartar exame" }));
  await user.click(screen.getByRole("button", { name: "Descartar exame" }));

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/${reviewId}/discard`,
    { method: "POST", body: JSON.stringify({ expectedVersion: reviewVersion }) },
  ));
  await waitFor(() => expect(window.location.search).toBe("?acao=anexar"));
  expect(client.getQueryData(examKeys.detail(reviewId))).toBeUndefined();
  await waitFor(() => expect(
    requestMock.mock.calls.filter(([path, init]) => path.startsWith(`/exams/patients/${patient.id}`) && !init?.method),
  ).toHaveLength(2));
});

test("descarta duplicata falha, remove detalhe e reabre anexo com o mesmo arquivo", async () => {
  const user = userEvent.setup();
  const failedId = summaries[0].id;
  const failedVersion = 7;
  let discarded = false;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith(`/exams/patients/${patient.id}`) && !init?.method) {
      return Promise.resolve(pagePayload({
        items: discarded ? summaries.filter((exam) => exam.id !== failedId) : summaries,
      }));
    }
    if (path === `/exams/${failedId}` && !init?.method) {
      return Promise.resolve(rawDetail(failedId, {
        status: "Falhou",
        version: failedVersion,
        error: "Falha sanitizada",
        draftRevision: null,
        capabilities: {
          ...capabilities,
          canEditRevision: false,
          canValidate: false,
          canDiscardFailedExam: true,
        },
      }));
    }
    if (path === `/exams/patients/${patient.id}/documents` && init?.method === "POST") {
      return Promise.reject(new ApiError("Duplicado", 409, { existingExamId: failedId }));
    }
    if (path === `/exams/${failedId}/discard` && init?.method === "POST") {
      discarded = true;
      return Promise.resolve(rawDetail(failedId, { status: "Cancelado", version: failedVersion + 1 }));
    }
    return defaultRequest(path, init);
  });

  const { client } = renderPage(`/app/pacientes/${patient.id}/exames?acao=anexar`);
  const composer = await screen.findByRole("dialog", { name: "Anexar laudo" });
  await user.upload(
    within(composer).getByLabelText("Selecionar arquivo PDF"),
    new File(["%PDF-1.7\nconteúdo sintético"], "laudo.pdf", { type: "application/pdf" }),
  );
  await user.type(within(composer).getByLabelText("Nome do exame (opcional)"), "Hemograma");
  await user.selectOptions(within(composer).getByLabelText("Tipo de exame"), "Laboratório");
  await user.click(within(composer).getByRole("button", { name: "Enviar laudo" }));
  await user.click(await within(composer).findByRole("button", { name: "Abrir exame existente" }));

  await user.click(await screen.findByRole("button", { name: "Descartar laudo" }));
  await user.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/${failedId}/discard`,
    { method: "POST", body: JSON.stringify({ expectedVersion: failedVersion }) },
  ));
  await waitFor(() => expect(window.location.search).toBe("?acao=anexar"));
  expect(screen.getByRole("status")).toHaveTextContent("laudo.pdf selecionado");
  expect(client.getQueryData(examKeys.detail(failedId))).toBeUndefined();
  await waitFor(() => expect(
    requestMock.mock.calls.filter(([path, init]) => path.startsWith(`/exams/patients/${patient.id}`) && !init?.method),
  ).toHaveLength(2));
  expect(screen.queryByRole("button", { name: /Perfil lipídico/ })).not.toBeInTheDocument();
});

test("conflito ao descartar preserva seleção e recarrega somente por ação explícita", async () => {
  const user = userEvent.setup();
  const failedId = summaries[0].id;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${failedId}` && !init?.method) {
      return Promise.resolve(rawDetail(failedId, {
        status: "Falhou",
        version: 7,
        error: "Falha sanitizada",
        draftRevision: null,
        capabilities: {
          ...capabilities,
          canEditRevision: false,
          canValidate: false,
          canDiscardFailedExam: true,
        },
      }));
    }
    if (path === `/exams/${failedId}/discard` && init?.method === "POST") {
      return Promise.reject(new ApiError("Conflito técnico", 409, { currentVersion: 8 }));
    }
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${failedId}`);
  await user.click(await screen.findByRole("button", { name: "Descartar laudo" }));
  await user.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));

  expect(await screen.findByRole("button", { name: "Recarregar dados atuais" })).toBeInTheDocument();
  expect(window.location.search).toBe(`?exame=${failedId}`);
  expect(requestMock.mock.calls.filter(([path, init]) => path === `/exams/${failedId}` && !init?.method)).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  await waitFor(() => expect(
    requestMock.mock.calls.filter(([path, init]) => path === `/exams/${failedId}` && !init?.method),
  ).toHaveLength(2));
});

test("solicitação converte categoria apresentável para o contrato BACK", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/patients/${patient.id}/requests` && init?.method === "POST") return Promise.resolve(rawDetail(summaries[1].id, { status: "Solicitado", document: null, draftRevision: null }));
    return defaultRequest(path, init);
  });
  renderPage();
  await user.click(await screen.findByRole("link", { name: "Solicitar exame" }));
  const composer = screen.getByRole("region", { name: "Solicitar exame" });
  await user.type(within(composer).getByLabelText("Nome do exame"), "Ultrassom");
  await user.selectOptions(within(composer).getByLabelText("Categoria"), "Imagem");
  await user.click(within(composer).getByRole("button", { name: "Criar solicitação" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(`/exams/patients/${patient.id}/requests`, expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Ultrassom", category: "Imagem", scheduledOn: null }) })));
});

test("classificação converte categoria e envia a versão atual ao endpoint versionado", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/exams/${summaries[0].id}` && !init?.method) {
      return Promise.resolve(rawDetail(summaries[0].id, {
        category: "NaoClassificado",
        capabilities: { ...capabilities, canClassify: true, canValidate: false },
      }));
    }
    if (path === `/exams/${summaries[0].id}/classification` && init?.method === "PUT") {
      return Promise.resolve(rawDetail(summaries[0].id, { category: "Imagem", version: 3 }));
    }
    return defaultRequest(path, init);
  });

  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}`);
  await user.selectOptions(await screen.findByLabelText("Categoria clínica do exame"), "Imagem");
  await user.click(screen.getByRole("button", { name: "Classificar exame" }));

  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    `/exams/${summaries[0].id}/classification`,
    { method: "PUT", body: JSON.stringify({ category: "Imagem", expectedVersion: 2 }) },
  ));
});

test("mobile detail oferece voltar removendo somente exame da query", async () => {
  renderPage(`/app/pacientes/${patient.id}/exames?exame=${summaries[0].id}&origem=atalho`);
  const buttons = await screen.findAllByRole("button", { hidden: true });
  const back = buttons.find((button) => button.textContent?.includes("Voltar aos exames"));
  expect(back).toBeDefined();
  fireEvent.click(back!);
  await waitFor(() => expect(window.location.search).toBe("?origem=atalho"));
});
