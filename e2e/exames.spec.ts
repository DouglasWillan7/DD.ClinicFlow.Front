import { expect, test, type Locator, type Page, type Request } from "@playwright/test";
import { createHash } from "node:crypto";

type ClinicRole = "Doctor" | "Admin" | "Secretary";

const patientId = "00000000-0000-4000-8000-000000000101";
const doctorId = "30000000-0000-4000-8000-000000000001";
const reviewId = "70000000-0000-4000-8000-000000000001";
const requestedId = "70000000-0000-4000-8000-000000000002";
const processingId = "70000000-0000-4000-8000-000000000003";
const failedId = "70000000-0000-4000-8000-000000000004";
const validatedId = "70000000-0000-4000-8000-000000000005";
const newRequestId = "70000000-0000-4000-8000-000000000006";

const patient = {
  id: patientId,
  name: "Paciente Exemplo",
  phone: "+5511000000000",
  cpf: "00000000000",
  medicalRecordNumber: 101,
  bloodType: null,
  birthDate: "1984-03-12",
  notes: null,
  doctorUserId: doctorId,
  isActive: true,
  whatsappConsentAtUtc: null,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

const document = {
  fileName: "laudo-sintetico.pdf",
  contentType: "application/pdf",
  sizeBytes: 4096,
  source: "Clinica",
  createdAtUtc: "2026-08-09T10:00:00Z",
  processingAttempts: 1,
};

const cpkResultId = "75000000-0000-4000-8000-000000000001";

function validatedReport(overrides: Record<string, unknown> = {}) {
  const cpkHistory = [
    {
      date: "2026-06-08",
      numericValue: 281,
      valueText: "281",
      outOfRange: true,
    },
    {
      date: "2026-07-08",
      numericValue: 294,
      valueText: "294",
      outOfRange: true,
    },
    {
      date: "2026-08-08",
      numericValue: 562,
      valueText: "562",
      outOfRange: true,
    },
  ];
  const findings = [
    {
      resultId: cpkResultId,
      name: "CPK",
      valueText: "562",
      unit: "U/L",
      referenceText: "até 190 U/L",
      referenceState: "elevado",
      deltaPercent: 91.16,
    },
    {
      resultId: "75000000-0000-4000-8000-000000000002",
      name: "Ferritina",
      valueText: "10",
      unit: "ng/mL",
      referenceText: "15 a 150 ng/mL",
      referenceState: "baixo",
      deltaPercent: null,
    },
  ];
  return {
    id: validatedId,
    patientId,
    name: "Painel laboratorial sintético",
    category: "Laboratorio",
    clinicalOutcome: "Alterado",
    version: 2,
    metadata: {
      collectedAtLocal: "2026-08-08T08:30:00",
      issuedOn: "2026-08-08",
      validatedAtUtc: "2026-08-08T15:00:00Z",
      requesterName: "Profissional Exemplo com nome longo para validação responsiva",
      requesterRegistration: "CRM EX 0000",
      validatorName: "Médica Exemplo",
    },
    document: {
      fileName: "laudo-sintetico-com-nome-extenso.pdf",
      sizeBytes: 4096,
      source: "Clinica",
      pageCount: 3,
    },
    findings,
    structuredFindings: [
      {
        id: "74000000-0000-4000-8000-000000000001",
        key: "Ritmo de demonstração",
        value: "Regular, sem alteração aguda",
        confidence: 0.94,
      },
    ],
    results: [
      {
        id: cpkResultId,
        catalogCode: "CPK",
        name: "CPK",
        subtitle: "Creatinofosfoquinase total",
        numericValue: 562,
        valueText: "562",
        unit: "U/L",
        referenceText: "até 190 U/L",
        detailedReferenceText:
          "Esta referência detalhada e inteiramente sintética considera faixas distintas por contexto clínico, idade e condições de coleta, preservando conteúdo longo em português sem identificar pessoas.",
        referenceState: "elevado",
        confidence: null,
        deltaPercent: 91.16,
        history: cpkHistory,
      },
      {
        id: "75000000-0000-4000-8000-000000000002",
        catalogCode: "FERRITINA",
        name: "Ferritina",
        subtitle: null,
        numericValue: 10,
        valueText: "10",
        unit: "ng/mL",
        referenceText: "15 a 150 ng/mL",
        detailedReferenceText: null,
        referenceState: "baixo",
        confidence: null,
        deltaPercent: null,
        history: [
          {
            date: "2026-08-08",
            numericValue: 10,
            valueText: "10",
            outOfRange: true,
          },
        ],
      },
      {
        id: "75000000-0000-4000-8000-000000000003",
        catalogCode: "VITD",
        name: "Vitamina D",
        subtitle: "25-hidroxivitamina D",
        numericValue: 29,
        valueText: "29",
        unit: "ng/mL",
        referenceText: "30 a 60 ng/mL",
        detailedReferenceText: null,
        referenceState: "limítrofe",
        confidence: null,
        deltaPercent: null,
        history: [],
      },
      {
        id: "75000000-0000-4000-8000-000000000004",
        catalogCode: "TSH",
        name: "TSH",
        subtitle: "Hormônio estimulante da tireoide",
        numericValue: 2.1,
        valueText: "2,1",
        unit: "mUI/L",
        referenceText: "0,4 a 4,0 mUI/L",
        detailedReferenceText: null,
        referenceState: "normal",
        confidence: null,
        deltaPercent: null,
        history: [],
      },
      {
        id: "75000000-0000-4000-8000-000000000005",
        catalogCode: "BILT",
        name: "Bilirrubina total",
        subtitle: null,
        numericValue: 0.8,
        valueText: "0,8",
        unit: "mg/dL",
        referenceText: "Não informada",
        detailedReferenceText: null,
        referenceState: "indeterminado",
        confidence: null,
        deltaPercent: null,
        history: [],
      },
    ],
    notes: [
      {
        id: "76000000-0000-4000-8000-000000000001",
        title: "Observação sintética do laboratório",
        text: "Amostra de demonstração adequada para análise. Este texto longo em português valida quebra de linha, leitura progressiva e ausência de sobreposição em telas estreitas.",
        confidence: null,
      },
    ],
    capabilities: {
      canOpenDocument: true,
      canViewHistory: true,
      canOpenCorrection: true,
    },
    ...overrides,
  };
}

function patientClinicalSummary() {
  const report = validatedReport();
  return {
    latestReport: report,
    totalFindingCount: report.findings.length + report.structuredFindings.length,
    structuredFindings: report.structuredFindings,
    findings: report.findings,
    trends: [
      {
        catalogCode: "CPK",
        name: "CPK",
        unit: "U/L",
        referenceState: "elevado",
        points: report.results[0].history,
      },
    ],
    latestCollectionDate: "2026-08-08",
    capabilities: { canRequest: true, canAttachDocument: true },
  };
}

function revision(status: "Rascunho" | "Validada", outcome: string | null) {
  return {
    id: status === "Rascunho"
      ? "71000000-0000-4000-8000-000000000001"
      : "71000000-0000-4000-8000-000000000002",
    number: 1,
    status,
    aiSuggestedOutcome: "Alterado",
    clinicalOutcome: outcome,
    averageConfidence: 0.88,
    model: "fixture-model",
    correctionReason: null,
    createdByUserId: doctorId,
    createdAtUtc: "2026-08-09T10:00:00Z",
    lastEditedByUserId: null,
    updatedAtUtc: "2026-08-09T11:00:00Z",
    validatedByUserId: status === "Validada" ? doctorId : null,
    validatedAtUtc: status === "Validada" ? "2026-08-09T11:00:00Z" : null,
    structuredResults: [{
      id: "72000000-0000-4000-8000-000000000001",
      order: 0,
      catalogCode: "LDL",
      name: "LDL colesterol",
      numericValue: 160,
      textValue: null,
      unit: "mg/dL",
      referenceText: "< 130",
      outOfRangeSuggestion: true,
      confidence: 0.88,
    }],
    narrativeSections: [{
      id: "73000000-0000-4000-8000-000000000001",
      order: 0,
      title: "Observações",
      text: "Amostra adequada para análise.",
      confidence: 0.97,
    }],
    structuredFindings: [{
      id: "74000000-0000-4000-8000-000000000001",
      order: 0,
      key: "Jejum",
      value: "12 horas",
      confidence: null,
    }],
    extractionIssues: status === "Rascunho" ? [
      { id: "75000000-0000-4000-8000-000000000001", structuredResultId: "72000000-0000-4000-8000-000000000001", page: 4, field: "name", reason: "GENERIC_RESULT_NAME" },
      { id: "75000000-0000-4000-8000-000000000002", structuredResultId: null, page: null, field: "patientContext", reason: "PATIENT_CONTEXT_MISMATCH" },
      { id: "75000000-0000-4000-8000-000000000003", structuredResultId: "72000000-0000-4000-8000-000000000001", page: 4, field: "referenceRange", reason: "REFERENCE_CONTEXT_MISSING" },
      { id: "75000000-0000-4000-8000-000000000004", structuredResultId: "72000000-0000-4000-8000-000000000001", page: 4, field: "referenceRange", reason: "AMBIGUOUS_REFERENCE_CONTEXT" },
    ] : [],
  };
}

interface ExamOptions {
  roles?: ClinicRole[];
  duplicateUpload?: boolean;
  duplicateExamId?: string;
  staleRevisionOnce?: boolean;
}

interface MockState {
  records: Map<string, Record<string, unknown>>;
  requests: Array<{ path: string; method: string; body: unknown }>;
  acceptedUploadExamIds: string[];
  uploadAttempts: MultipartUpload[];
  defaultListSnapshots: string[][];
  staleUsed: boolean;
}

interface MultipartUpload {
  fieldName: string;
  fileName: string;
  bytes: Buffer;
  sha256: string;
  fields: Record<string, string>;
}

function detail(
  id: string,
  name: string,
  status: string,
  doctor: boolean,
): Record<string, unknown> {
  const hasDocument = status !== "Solicitado" && status !== "Cancelado";
  const draft = status === "EmRevisao" ? revision("Rascunho", null) : null;
  const active = status === "Validado" ? revision("Validada", "Alterado") : null;
  return {
    id,
    patientId,
    doctorUserId: doctorId,
    requestedByUserId: doctorId,
    name,
    category: name.includes("Ultrassom") ? "Imagem" : "Laboratorio",
    scheduledOn: status === "Solicitado" ? "2026-08-15" : null,
    status,
    version: 2,
    error: status === "Falhou" ? "O arquivo não pôde ser lido. O documento original foi preservado." : null,
    createdAtUtc: "2026-08-09T10:00:00Z",
    updatedAtUtc: "2026-08-09T11:00:00Z",
    processedAtUtc: hasDocument ? "2026-08-09T11:00:00Z" : null,
    cancelledByUserId: null,
    cancelledAtUtc: null,
    document: hasDocument ? document : null,
    activeRevision: active,
    draftRevision: doctor ? draft : null,
    attemptsRemaining: hasDocument ? 2 : 0,
    capabilities: {
      canEditRequest: doctor && status === "Solicitado",
      canCancelRequest: doctor && status === "Solicitado",
      canAttachDocument: status === "Solicitado",
      canReprocess: status === "Falhou" || status === "Pendente" || status === "Processando",
      canDiscardFailedExam: status === "Falhou",
      canDiscardExam: status === "Falhou" || doctor && status === "EmRevisao",
      canOpenCorrection: doctor && status === "Validado",
      canEditRevision: doctor && Boolean(draft),
      canClassify: false,
      canValidate: doctor && Boolean(draft),
    },
  };
}

function summary(value: Record<string, unknown>) {
  return {
    id: value.id,
    patientId,
    name: value.name,
    category: value.category,
    scheduledOn: value.scheduledOn,
    status: value.status,
    version: value.version,
    hasDocument: Boolean(value.document),
    averageConfidence: value.draftRevision || value.activeRevision ? 0.88 : null,
    createdAtUtc: value.createdAtUtc,
    updatedAtUtc: value.updatedAtUtc,
  };
}

function sessionFor(roles: ClinicRole[]) {
  return {
    userId: "10000000-0000-4000-8000-000000000001",
    email: "professional@example.test",
    clinicId: "20000000-0000-4000-8000-000000000001",
    roles,
    name: roles.includes("Doctor") ? "Dra. Helena Costa" : "Equipe ClinicFlow",
    tokens: {
      accessToken: "exam-e2e-access-token",
      refreshToken: "exam-e2e-refresh-token",
      accessTokenExpiresAtUtc: "2030-08-09T12:00:00Z",
    },
  };
}

function jsonBody(request: Request) {
  try {
    return request.postDataJSON();
  } catch {
    return null;
  }
}

function parseMultipartUpload(request: Request): MultipartUpload {
  const contentType = request.headers()["content-type"] ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  const body = request.postDataBuffer();
  if (!boundary || !body) throw new Error("Upload multipart sintético inválido.");

  const marker = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const nextMarker = Buffer.from(`\r\n--${boundary}`);
  const fields: Record<string, string> = {};
  let filePart: { fieldName: string; fileName: string; bytes: Buffer } | null = null;
  let cursor = 0;

  while (cursor < body.length) {
    const markerStart = body.indexOf(marker, cursor);
    if (markerStart < 0) break;
    const headersStart = markerStart + marker.length + 2;
    const headersEnd = body.indexOf(headerSeparator, headersStart);
    if (headersEnd < 0) break;
    const contentStart = headersEnd + headerSeparator.length;
    const contentEnd = body.indexOf(nextMarker, contentStart);
    if (contentEnd < 0) break;

    const headers = body.subarray(headersStart, headersEnd).toString("utf8");
    const fieldName = /name="([^"]+)"/.exec(headers)?.[1];
    const fileName = /filename="([^"]*)"/.exec(headers)?.[1];
    const content = Buffer.from(body.subarray(contentStart, contentEnd));
    if (fieldName && fileName !== undefined) {
      filePart = { fieldName, fileName, bytes: content };
    } else if (fieldName) {
      fields[fieldName] = content.toString("utf8");
    }
    cursor = contentEnd + 2;
  }

  if (!filePart) throw new Error("Campo file ausente no upload multipart sintético.");
  return {
    ...filePart,
    sha256: createHash("sha256").update(filePart.bytes).digest("hex"),
    fields,
  };
}

async function mockExams(page: Page, options: ExamOptions = {}): Promise<MockState> {
  const roles = options.roles ?? ["Doctor"];
  const doctor = roles.includes("Doctor");
  const session = sessionFor(roles);
  const records = new Map([
    [reviewId, detail(reviewId, "Perfil lipídico", "EmRevisao", doctor)],
    [requestedId, detail(requestedId, "Hemograma completo", "Solicitado", doctor)],
    [processingId, detail(processingId, "Ultrassom abdominal", "Processando", doctor)],
    [failedId, detail(failedId, "Função tireoidiana", "Falhou", doctor)],
    [validatedId, detail(validatedId, "Painel laboratorial sintético", "Validado", doctor)],
  ]);
  const state: MockState = {
    records,
    requests: [],
    acceptedUploadExamIds: [],
    uploadAttempts: [],
    defaultListSnapshots: [],
    staleUsed: false,
  };
  const duplicateExamId = options.duplicateExamId ?? validatedId;
  let duplicateHashActive = options.duplicateUpload ?? false;
  let activeDuplicateHash: string | null = null;

  await page.clock.setFixedTime(new Date("2026-08-09T12:00:00Z"));
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/hubs/agenda/negotiate") {
      return route.fulfill({
        status: 200,
        json: {
          negotiateVersion: 1,
          connectionId: "synthetic-connection",
          connectionToken: "synthetic-connection-token",
          availableTransports: [],
        },
      });
    }
    if (url.pathname === `/patients/${patientId}`) {
      return route.fulfill({ status: 200, json: patient });
    }
    if (url.pathname === "/patients") {
      return route.fulfill({ status: 200, json: [patient] });
    }
    if (url.pathname === "/clinics/current") {
      return route.fulfill({ status: 200, json: {
        id: session.clinicId,
        name: "Clínica Vital",
        timeZoneId: "America/Sao_Paulo",
        phone: null,
        address: null,
        defaultAppointmentDurationMinutes: 30,
        plan: "Clinic",
        subscriptionStatus: "Active",
        maxDoctors: null,
        createdAtUtc: "2026-07-01T12:00:00Z",
      } });
    }
    if (url.pathname === "/clinics/members") {
      return route.fulfill({ status: 200, json: [{
        userId: doctorId,
        email: "doctor@example.test",
        roles: ["Doctor"],
        isCreator: false,
        name: "Dra. Helena Costa",
        specialty: "Clínica médica",
      }] });
    }
    if (url.pathname === "/users/me") {
      return route.fulfill({ status: 200, json: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        roles,
        medicalLicense: null,
        medicalLicenseState: null,
        specialty: null,
      } });
    }
    if (
      url.pathname === `/assessments/patients/${patientId}`
      || url.pathname === `/appointments/patients/${patientId}`
    ) {
      return route.fulfill({ status: 200, json: [] });
    }
    if (url.pathname === `/exams/patients/${patientId}/grid`) {
      return route.fulfill({ status: 200, json: { dates: [], rows: [] } });
    }
    if (url.pathname === `/exams/patients/${patientId}/clinical-summary`) {
      return route.fulfill({ status: 200, json: patientClinicalSummary() });
    }
    if (url.pathname === `/exams/patients/${patientId}/requests` && method === "POST") {
      const body = jsonBody(request) as Record<string, unknown>;
      const created = detail(newRequestId, String(body.name), "Solicitado", doctor);
      created.category = body.category;
      created.scheduledOn = body.scheduledOn;
      records.set(newRequestId, created);
      state.requests.push({ path: url.pathname, method, body });
      return route.fulfill({ status: 201, json: created });
    }
    if (url.pathname === `/exams/patients/${patientId}/documents` && method === "POST") {
      const upload = parseMultipartUpload(request);
      state.uploadAttempts.push(upload);
      state.requests.push({ path: url.pathname, method, body: request.postData() });
      activeDuplicateHash ??= upload.sha256;
      if (duplicateHashActive && upload.sha256 === activeDuplicateHash) {
        return route.fulfill({
          status: 409,
          json: {
            title: "Documento duplicado",
            existingExamId: duplicateExamId,
          },
        });
      }
      const attached = detail(requestedId, "Hemograma completo", "Pendente", doctor);
      records.set(requestedId, attached);
      state.acceptedUploadExamIds.push(requestedId);
      return route.fulfill({ status: 201, json: attached });
    }
    if (url.pathname === `/exams/patients/${patientId}` && method === "GET") {
      let items = [...records.values()].map(summary);
      const search = url.searchParams.get("search")?.toLocaleLowerCase("pt-BR");
      if (search) items = items.filter((item) => String(item.name).toLocaleLowerCase("pt-BR").includes(search));
      const statuses = url.searchParams.get("statuses")?.split(",");
      if (statuses?.length) {
        items = items.filter((item) => statuses.includes(String(item.status)));
      } else {
        items = items.filter((item) => item.status !== "Cancelado");
        state.defaultListSnapshots.push(items.map((item) => String(item.id)));
      }
      const categories = url.searchParams.get("categories")?.split(",");
      if (categories?.length) items = items.filter((item) => categories.includes(String(item.category)));
      return route.fulfill({
        status: 200,
        json: { items, nextCursor: null, capabilities: { canRequest: doctor, canAttachDocument: true } },
      });
    }

    const reportMatch = url.pathname.match(/^\/exams\/([0-9a-f-]+)\/report$/i);
    if (reportMatch && method === "GET") {
      const id = reportMatch[1];
      const current = records.get(id);
      if (!current) {
        return route.fulfill({ status: 404, json: { title: "Exame não encontrado" } });
      }
      if (current.status !== "Validado") {
        return route.fulfill({ status: 409, json: { title: "Laudo ainda não validado" } });
      }
      return route.fulfill({
        status: 200,
        json: validatedReport({
          id,
          name: current.name,
          clinicalOutcome:
            (current.activeRevision as Record<string, unknown> | null)
              ?.clinicalOutcome ?? "Alterado",
          version: current.version,
        }),
      });
    }

    const examMatch = url.pathname.match(/^\/exams\/([0-9a-f-]+)(\/document|\/reprocess|\/discard|\/revision|\/validate|\/revisions)?$/i);
    if (examMatch) {
      const id = examMatch[1];
      const action = examMatch[2];
      const current = records.get(id);
      if (!current) return route.fulfill({ status: 404, json: { title: "Exame não encontrado" } });
      if (!action && method === "GET") return route.fulfill({ status: 200, json: current });
      if (action === "/document" && method === "GET") {
        state.requests.push({ path: url.pathname, method, body: null });
        return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7\nfixture" });
      }
      if (action === "/reprocess" && method === "POST") {
        const next = { ...current, status: "Pendente", error: null, version: Number(current.version) + 1 };
        records.set(id, next);
        state.requests.push({ path: url.pathname, method, body: null });
        return route.fulfill({ status: 200, json: next });
      }
      if (action === "/discard" && method === "POST") {
        const body = jsonBody(request) as Record<string, unknown>;
        const capabilities = current.capabilities as Record<string, unknown>;
        const validDiscard = (id === duplicateExamId
          && current.status === "Falhou"
          && capabilities.canDiscardFailedExam === true
          || current.status === "EmRevisao"
          && capabilities.canDiscardExam === true)
          && body.expectedVersion === current.version;
        if (!validDiscard) {
          return route.fulfill({
            status: 409,
            json: { title: "Descarte inválido", currentVersion: current.version },
          });
        }
        const next = {
          ...current,
          status: "Cancelado",
          version: Number(current.version) + 1,
          capabilities: {
            ...(current.capabilities as Record<string, unknown>),
            canReprocess: false,
            canDiscardFailedExam: false,
            canDiscardExam: false,
          },
        };
        records.set(id, next);
        duplicateHashActive = false;
        state.requests.push({ path: url.pathname, method, body });
        return route.fulfill({ status: 200, json: next });
      }
      if (action === "/revision" && method === "PUT") {
        const body = jsonBody(request) as Record<string, unknown>;
        state.requests.push({ path: url.pathname, method, body });
        if (options.staleRevisionOnce && !state.staleUsed) {
          state.staleUsed = true;
          return route.fulfill({ status: 409, json: { title: "Versão desatualizada", currentVersion: 7 } });
        }
        const next = {
          ...current,
          version: Number(current.version) + 1,
          draftRevision: {
            ...(current.draftRevision as Record<string, unknown>),
            ...body,
            status: "Rascunho",
          },
        };
        records.set(id, next);
        return route.fulfill({ status: 200, json: next });
      }
      if (action === "/validate" && method === "POST") {
        const body = jsonBody(request) as Record<string, unknown>;
        const draftRevision = current.draftRevision as Record<string, unknown>;
        const next = {
          ...current,
          status: "Validado",
          version: Number(current.version) + 1,
          draftRevision: null,
          activeRevision: {
            ...draftRevision,
            status: "Validada",
            clinicalOutcome: body.clinicalOutcome,
            validatedByUserId: doctorId,
            validatedAtUtc: "2026-08-09T12:00:00Z",
          },
          capabilities: {
            canEditRequest: false,
            canCancelRequest: false,
            canAttachDocument: false,
            canReprocess: false,
            canOpenCorrection: doctor,
            canEditRevision: false,
            canClassify: false,
            canValidate: false,
          },
        };
        records.set(id, next);
        state.requests.push({ path: url.pathname, method, body });
        return route.fulfill({ status: 200, json: next });
      }
      if (action === "/revisions" && method === "POST") {
        const next = { ...current, version: Number(current.version) + 1, draftRevision: revision("Rascunho", null) };
        records.set(id, next);
        return route.fulfill({ status: 201, json: next });
      }
    }

    return route.fulfill({ status: 404, json: { title: `Rota não simulada: ${method} ${url.pathname}` } });
  });

  return state;
}

async function openExams(page: Page, query = "") {
  await page.goto(`/app/pacientes/${patientId}/exames${query}`);
  await expect(page.getByRole("navigation", { name: "Seções do paciente" }).getByRole("link", { name: "Exames" })).toBeVisible();
}

async function attachPdf(page: Page) {
  const composer = page.getByRole("dialog", { name: "Anexar laudo" });
  await composer.getByLabel("Selecionar arquivo PDF").setInputFiles({
    name: "laudo-sintetico.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nfixture"),
  });
  await composer.getByLabel("Vincular laudo").selectOption(requestedId);
  await composer.getByRole("button", { name: "Enviar laudo" }).click();
}

function colorChannels(value: string) {
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (value.startsWith("color(srgb")) return numbers.slice(0, 3).map((channel) => channel * 255);
  return numbers.slice(0, 3);
}

function relativeLuminance(value: string) {
  const channels = colorChannels(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function renderedColors(locator: Locator) {
  return locator.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    let current: Element | null = element;
    let background = "";
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor;
      if (candidate !== "transparent" && !candidate.endsWith(", 0)")) {
        background = candidate;
        break;
      }
      current = current.parentElement;
    }
    return { foreground, background, fontSize: getComputedStyle(element).fontSize };
  });
}

function durationMs(value: string) {
  return Math.max(...value.split(",").map((item) => {
    const parsed = Number.parseFloat(item);
    return item.trim().endsWith("ms") ? parsed : parsed * 1000;
  }));
}

function observeUnexpectedBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location().url;
      errors.push(
        `console${location ? ` (${location})` : ""}: ${message.text()}`,
      );
    }
  });
  return errors;
}

async function pageOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

async function tabTo(page: Page, target: Locator, maximumTabs = 60) {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate(
        (element) => element === document.activeElement,
      )
    ) {
      return;
    }
  }
  throw new Error(`O alvo não recebeu foco após ${maximumTabs} tabs.`);
}

test.use({ viewport: { width: 1440, height: 1050 } });

test("deep link seleciona detalhe, preserva query adjacente e abre PDF autenticado", async ({ page }) => {
  const state = await mockExams(page);
  const pdfRequest = page.waitForRequest((request) => request.url().endsWith(`/exams/${reviewId}/document`));
  await openExams(page, `?exame=${reviewId}&origem=atalho`);

  await expect(page.getByRole("heading", { name: "Conferir dados extraídos" })).toBeVisible();
  expect((await pdfRequest).headers().authorization).toBe("Bearer exam-e2e-access-token");
  expect(state.requests.some((request) => request.path.endsWith("/document"))).toBe(true);

  await page.getByRole("button", { name: "Voltar aos exames" }).click();
  await page.getByRole("button", { name: /Hemograma completo/ }).click();
  await expect(page).toHaveURL(new RegExp(`exame=${requestedId}`));
  expect(new URL(page.url()).searchParams.get("origem")).toBe("atalho");
});

test("Doctor cria solicitação com enum do contrato e seleção resultante", async ({ page }) => {
  const state = await mockExams(page);
  await openExams(page);
  await page.getByRole("link", { name: "Solicitar exame" }).click();
  const composer = page.getByRole("region", { name: "Solicitar exame" });
  await composer.getByLabel("Nome do exame").fill("Ressonância de joelho");
  await composer.getByLabel("Categoria").selectOption("Imagem");
  await composer.getByRole("button", { name: "Criar solicitação" }).click();

  await expect(page).toHaveURL(new RegExp(`exame=${newRequestId}`));
  await expect(page.getByRole("heading", { name: "Ressonância de joelho" })).toBeVisible();
  expect(state.requests.find((request) => request.path.endsWith("/requests"))?.body).toEqual({
    name: "Ressonância de joelho",
    category: "Imagem",
    scheduledOn: null,
  });
});

test("anexa PDF válido a uma solicitação explícita e inicia processamento", async ({ page }) => {
  const state = await mockExams(page);
  await openExams(page, "?acao=anexar");
  await attachPdf(page);

  await expect(
    page.getByRole("progressbar", { name: "Extração do laudo em andamento" }),
  ).toBeVisible();
  expect(state.requests.some((request) => request.path.endsWith("/documents") && request.method === "POST")).toBe(true);
});

test("duplicidade 409 preserva upload e leva ao existingExamId", async ({ page }) => {
  await mockExams(page, { duplicateUpload: true });
  await openExams(page, "?acao=anexar");
  await attachPdf(page);

  await expect(page.getByRole("alert")).toContainText("Este PDF já foi anexado");
  await page.getByRole("button", { name: "Abrir exame existente" }).click();
  await expect(page).toHaveURL(new RegExp(`exame=${validatedId}`));
  await expect(
    page.getByRole("heading", { name: "Painel laboratorial sintético" }),
  ).toBeVisible();
});

test("descarta laudo falho duplicado e reenvia o mesmo PDF", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await mockExams(page, {
    duplicateUpload: true,
    duplicateExamId: failedId,
  });
  await openExams(page, "?acao=anexar");
  await attachPdf(page);

  expect(state.acceptedUploadExamIds).toEqual([]);
  await page.getByRole("button", { name: "Enviar laudo" }).click();
  await expect(page.getByRole("alert")).toContainText("Este PDF já foi anexado");
  expect(state.acceptedUploadExamIds).toEqual([]);
  expect(state.uploadAttempts).toHaveLength(2);
  expect(state.uploadAttempts.map((upload) => upload.sha256)).toEqual([
    "f581fc87f30296eff11777c3ce1b9a8b7077071ad8abedfcba317fef0c807224",
    "f581fc87f30296eff11777c3ce1b9a8b7077071ad8abedfcba317fef0c807224",
  ]);

  await page.getByRole("button", { name: "Abrir exame existente" }).click();
  await expect(page).toHaveURL(new RegExp(`exame=${failedId}`));
  const discardButton = page.getByRole("button", { name: "Descartar laudo" });
  await tabTo(page, discardButton);
  expect(
    Number.parseFloat(
      await discardButton.evaluate((element) => getComputedStyle(element).outlineWidth),
    ),
  ).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  const confirmation = page.getByRole("region", {
    name: "Confirmar descarte do laudo",
  });
  await expect(confirmation).toContainText("continuará registrado para auditoria");
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(discardButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(confirmation).toBeVisible();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  const confirmationBox = await confirmation.boundingBox();
  expect(confirmationBox).not.toBeNull();
  expect((confirmationBox?.x ?? 0) + (confirmationBox?.width ?? 0)).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: ".superpowers/sdd/2026-08-10-discard-failed-exam/screenshots/failed-discard-375x812.png",
    fullPage: true,
  });
  await confirmation
    .getByRole("button", { name: "Descartar e enviar novamente" })
    .click();

  await expect(page).toHaveURL(/acao=anexar/);
  expect(state.records.get(failedId)).toMatchObject({
    id: failedId,
    status: "Cancelado",
    version: 3,
    capabilities: { canDiscardFailedExam: false },
  });
  await expect.poll(
    () => state.defaultListSnapshots.at(-1) ?? [],
  ).not.toContain(failedId);
  await expect(page.getByRole("status")).toContainText(
    "laudo-sintetico.pdf selecionado",
  );
  await page.getByRole("button", { name: "Enviar laudo" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Extração do laudo em andamento" }),
  ).toBeVisible();
  expect(
    state.requests.filter((request) => request.path.endsWith("/discard")),
  ).toHaveLength(1);
  expect(
    state.requests.find((request) => request.path.endsWith("/discard"))?.body,
  ).toEqual({ expectedVersion: 2 });
  expect(state.uploadAttempts).toHaveLength(3);
  for (const upload of state.uploadAttempts) {
    expect(upload.fieldName).toBe("file");
    expect(upload.fileName).toBe("laudo-sintetico.pdf");
    expect(upload.bytes).toEqual(Buffer.from("%PDF-1.7\nfixture"));
    expect(upload.sha256).toBe(
      "f581fc87f30296eff11777c3ce1b9a8b7077071ad8abedfcba317fef0c807224",
    );
    expect(upload.fields.requestExamId).toBe(requestedId);
  }
  expect(state.acceptedUploadExamIds).toEqual([requestedId]);
  expect(state.acceptedUploadExamIds[0]).not.toBe(failedId);
});

test("acompanha processamento, expõe falha sanitizada e reprocessa", async ({ page }) => {
  const state = await mockExams(page);
  await openExams(page, `?exame=${processingId}`);
  await expect(page.getByText("Extraindo resultados do laudo original.")).toBeVisible();

  await page.getByRole("button", { name: /Função tireoidiana/ }).click();
  await expect(page.getByRole("alert")).toContainText("O arquivo não pôde ser lido");
  await page.getByRole("button", { name: "Tentar processar novamente" }).click();
  await expect(page.getByText("Laudo recebido. Aguardando o início da extração.")).toBeVisible();
  expect(state.requests.some((request) => request.path.endsWith("/reprocess"))).toBe(true);
});

test("abre o PDF autenticado enquanto o exame está processando", async ({ page }) => {
  await mockExams(page);
  await openExams(page, `?exame=${processingId}`);
  const pdfRequest = page.waitForRequest((request) => request.url().endsWith(`/exams/${processingId}/document`));
  const popupPromise = page.waitForEvent("popup");

  await page.getByRole("button", { name: "Abrir laudo original em nova aba" }).click();

  const popup = await popupPromise;
  expect((await pdfRequest).headers().authorization).toBe("Bearer exam-e2e-access-token");
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
});

test("revisa conteúdo misto, salva rascunho e valida conclusão clínica", async ({ page }) => {
  const state = await mockExams(page);
  await openExams(page, `?exame=${reviewId}`);

  await expect(page.getByRole("heading", { name: "Conferir dados extraídos" })).toBeVisible();
  const warnings = page.getByRole("region", { name: "Pontos para conferir no laudo" });
  await expect(warnings.getByText("Não foi possível identificar o nome de um resultado. Compare com o laudo original.")).toHaveCount(1);
  await expect(warnings.getByText("Os dados do paciente no laudo divergem do cadastro. Confira antes de validar.")).toHaveCount(1);
  await expect(warnings.getByText("A referência exige um contexto clínico que não pôde ser determinado.")).toHaveCount(1);
  await expect(warnings).not.toContainText("GENERIC_RESULT_NAME");
  await expect(page.getByRole("button", { name: /reprocessar|processar novamente/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Resultados/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Narrativas clínicas/ })).toHaveCount(0);
  await page.getByText("Conteúdo adicional do laudo").click();
  await expect(page.getByText("Amostra adequada para análise.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jejum" })).toBeVisible();
  await expect(page.getByText("12 horas")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Achados estruturados/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar achado" })).toHaveCount(0);
  await expect(page.getByText("Revisar confiança").first()).toBeVisible();

  const numeric = page.getByLabel("Resultado 1 — valor");
  await numeric.fill("155");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(numeric).toHaveValue("155");
  expect(state.requests.find((request) => request.path.endsWith("/revision"))?.body).toMatchObject({
    narrativeSections: [{ title: "Observações", text: "Amostra adequada para análise." }],
    structuredFindings: [{ id: "74000000-0000-4000-8000-000000000001", order: 0, key: "Jejum", value: "12 horas", confidence: null }],
  });

  await page.getByRole("button", { name: "Confirmar restantes" }).click();
  await page.getByLabel("Conclusão clínica").selectOption("Sem alterações");
  await page.getByRole("button", { name: "Validar laudo" }).click();
  await expect(page.getByText("Sem alterações").first()).toBeVisible();
  expect(state.requests.some((request) => request.path.endsWith("/validate"))).toBe(true);
});

test("médico descarta revisão com confirmação por teclado e sai para anexar", async ({ page }) => {
  const state = await mockExams(page);
  await openExams(page, `?exame=${reviewId}`);

  const reviewActions = page.getByRole("region", { name: "Ações da revisão" });
  const discard = reviewActions.getByRole("button", { name: "Descartar exame" });
  await expect(discard).toBeVisible();
  expect(await reviewActions.evaluate((element) => getComputedStyle(element.closest("header")!).position)).toBe("sticky");
  await tabTo(page, discard);
  const box = await discard.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Enter");

  const confirmation = page.getByRole("region", { name: "Confirmar descarte do exame" });
  await expect(confirmation).toContainText("documento e a revisão continuarão registrados para auditoria");
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(discard).toBeFocused();

  await page.keyboard.press("Enter");
  await confirmation.getByRole("button", { name: "Descartar exame" }).click();

  await expect(page).toHaveURL(/acao=anexar/);
  expect(state.records.get(reviewId)).toMatchObject({
    status: "Cancelado",
    version: 3,
    capabilities: { canDiscardExam: false },
  });
  expect(state.requests.filter((request) => request.path.endsWith("/discard"))).toHaveLength(1);
  expect(state.requests.find((request) => request.path.endsWith("/discard"))?.body)
    .toEqual({ expectedVersion: 2 });
  await expect.poll(() => state.defaultListSnapshots.at(-1) ?? []).not.toContain(reviewId);
});

test("conflito stale 409 preserva os campos locais e oferece reload regional", async ({ page }) => {
  await mockExams(page, { staleRevisionOnce: true });
  await openExams(page, `?exame=${reviewId}`);
  const numeric = page.getByLabel("Resultado 1 — valor");
  await numeric.fill("177");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();

  await expect(page.getByRole("alert")).toContainText("Seus campos foram preservados");
  await expect(numeric).toHaveValue("177");
  await expect(page.getByRole("button", { name: "Recarregar dados atuais" })).toBeVisible();
});

for (const role of ["Admin", "Secretary"] as const) {
  test(`${role} não acessa exames do prontuário`, async ({ page }) => {
    await mockExams(page, { roles: [role] });
    await page.goto(`/app/pacientes/${patientId}/exames?exame=${reviewId}`);
    await expect(page).toHaveURL("/app/agenda");
    await expect(page.getByRole("navigation", { name: "Seções do paciente" })).toHaveCount(0);
  });
}

test("atalho Anexar laudo da visão geral abre a rota operacional", async ({ page }) => {
  await mockExams(page);
  await page.goto(`/app/pacientes/${patientId}`);
  await page.getByRole("link", { name: "Anexar laudo" }).click();
  await expect(page).toHaveURL(`/app/pacientes/${patientId}/exames?acao=anexar`);
  await expect(page.getByRole("dialog", { name: "Anexar laudo" })).toBeVisible();
});

test("médico abre um achado do último laudo e chega ao resultado", async ({
  page,
}) => {
  await mockExams(page);
  await page.goto(`/app/pacientes/${patientId}`);

  await page.getByRole("link", { name: /CPK 562 U\/L, Elevado/i }).click();
  await expect(page).toHaveURL(new RegExp(`/exames\\?exame=${validatedId}`));
  await page.getByRole("button", { name: /CPK.*Elevado/i }).click();
  await expect(
    page.getByRole("row", { name: /CPK 562 U\/L/i }),
  ).toBeFocused();
});

test("laudo expande referência longa e informa confiança ausente uma vez", async ({
  page,
}) => {
  await mockExams(page);
  await openExams(page, `?exame=${validatedId}`);

  const reference = page.getByRole("button", {
    name: "Ver metas por risco de CPK",
  });
  await expect(reference).toHaveAttribute("aria-expanded", "false");
  await reference.click();
  await expect(
    page.getByRole("button", { name: "Ocultar metas por risco de CPK" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(/Esta referência detalhada e inteiramente sintética/i),
  ).toBeVisible();
  await expect(
    page.getByText(/processamento não informou confiança/i),
  ).toHaveCount(1);
  await expect(
    page.getByRole("columnheader", { name: /confiança/i }),
  ).toHaveCount(0);
});

test("resultado sem histórico anterior mantém indicação explícita", async ({
  page,
}) => {
  await mockExams(page);
  await openExams(page, `?exame=${validatedId}`);

  await expect(
    page
      .getByRole("row", { name: /TSH 2,1 mUI\/L/i })
      .getByText("Sem histórico anterior"),
  ).toBeVisible();
});

test("laudo validado mostra os cinco estados e o achado estruturado uma única vez", async ({ page }) => {
  await mockExams(page);
  await openExams(page, `?exame=${validatedId}`);

  const states = [
    ["TSH", "normal", "Normal", "lucide-circle-check"],
    ["Bilirrubina total", "indeterminado", "Indeterminado", "lucide-circle-question-mark"],
    ["CPK", "elevado", "Elevado", "lucide-arrow-up"],
    ["Ferritina", "baixo", "Baixo", "lucide-arrow-down"],
    ["Vitamina D", "limítrofe", "Limítrofe", "lucide-arrow-right"],
  ] as const;
  for (const [resultName, state, label, iconClass] of states) {
    const row = page.getByRole("row", { name: new RegExp(`${resultName}.*${label}`, "i") });
    const pill = row.getByText(label, { exact: true });
    await expect(pill).toHaveAttribute("data-state", state);
    await expect(pill.locator("svg")).toHaveClass(new RegExp(iconClass));
    expect(await pill.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)))
      .toBeGreaterThanOrEqual(12);
  }
  await expect(page.getByText("Ritmo de demonstração", { exact: true })).toHaveCount(1);
});

test("navegação acompanha scroll natural e impressão revela nota recolhida", async ({ page }) => {
  await mockExams(page);
  await openExams(page, `?exame=${validatedId}`);

  const noteText = page.getByText(/Amostra de demonstração adequada/i);
  await expect(noteText).toBeHidden();
  await page.getByRole("heading", { name: "Notas do laboratório" }).evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });
  await expect(page.getByRole("button", { name: "Notas do laboratório 1" })).toHaveAttribute("aria-current", "true");

  await page.emulateMedia({ media: "print" });
  await expect(noteText).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Seções do laudo" })).toBeHidden();
  await page.screenshot({
    path: ".superpowers/sdd/2026-08-10-laudo-v2/screenshots/report-print.png",
    fullPage: true,
  });
});

test("erro ao abrir documento preserva o restante do laudo", async ({
  page,
}) => {
  await mockExams(page);
  await page.route(
    `http://localhost:5094/exams/${validatedId}/document`,
    async (route) => route.fulfill({ status: 503, json: { title: "Indisponível" } }),
  );
  await openExams(page, `?exame=${validatedId}`);

  await page
    .getByRole("button", { name: "Abrir laudo original em nova aba" })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "O laudo original está indisponível no momento.",
  );
  await expect(
    page.getByRole("heading", { name: "Todos os resultados" }),
  ).toBeVisible();
});

const reportViewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "960x900", width: 960, height: 900 },
  { name: "640x900", width: 640, height: 900 },
  { name: "375x812", width: 375, height: 812 },
] as const;

for (const viewport of reportViewports) {
  test(`laudo v2 não causa overflow em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const browserErrors = observeUnexpectedBrowserErrors(page);
    await mockExams(page);
    await page.goto(`/app/pacientes/${patientId}`);

    await expect(
      page.getByRole("heading", { name: "Painel laboratorial sintético" }),
    ).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    if (viewport.width === 375) {
      expect(
        await page
          .getByRole("navigation", { name: "Seções do paciente" })
          .evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
      ).toBeLessThanOrEqual(1);
    }
    await page.screenshot({
      path: `.superpowers/sdd/2026-08-10-laudo-v2/screenshots/overview-${viewport.name}.png`,
      fullPage: true,
    });

    await page.getByRole("link", { name: /CPK 562 U\/L, Elevado/i }).click();
    await expect(
      page.getByRole("heading", { name: "Todos os resultados" }),
    ).toBeVisible();
    if (viewport.width === 375) {
      const documentCopy = page
        .getByRole("region", { name: "Documento original" })
        .getByText("laudo-sintetico-com-nome-extenso.pdf")
        .locator("..");
      const documentSpacing = await documentCopy.evaluate((element) => {
          const style = getComputedStyle(element);
          const textHeight = [...element.children].reduce((total, child) => {
            const range = document.createRange();
            range.selectNodeContents(child);
            return total + range.getBoundingClientRect().height;
          }, 0);
          const gap = Number.parseFloat(style.rowGap) || 0;
          return {
            unusedHeight:
              element.getBoundingClientRect().height -
              textHeight -
              gap * Math.max(element.children.length - 1, 0),
            contentOverflow: element.scrollHeight - element.clientHeight,
            allowedHeight:
              Number.parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue(
                  "--space-2",
                ),
              ) || 8,
          };
        });
      expect(documentSpacing.unusedHeight).toBeGreaterThanOrEqual(-1);
      expect(documentSpacing.unusedHeight).toBeLessThanOrEqual(
        documentSpacing.allowedHeight,
      );
      expect(documentSpacing.contentOverflow).toBeLessThanOrEqual(1);
    }
    await page
      .getByRole("button", { name: "Ver metas por risco de CPK" })
      .click();
    await page
      .getByRole("button", { name: "Observação sintética do laboratório" })
      .click();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.superpowers/sdd/2026-08-10-laudo-v2/screenshots/report-${viewport.name}.png`,
      fullPage: true,
    });

    expect(browserErrors).toEqual([]);
  });
}

test("laudo mantém fluxo por teclado com movimento reduzido", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const browserErrors = observeUnexpectedBrowserErrors(page);
  await mockExams(page);
  await page.goto(`/app/pacientes/${patientId}/exames?exame=${validatedId}`);
  await expect(
    page.getByRole("heading", { name: "Todos os resultados" }),
  ).toBeVisible();

  await page.evaluate(() => {
    const original = Element.prototype.scrollIntoView;
    const view = window as Window & { clinicFlowScrollBehaviors?: string[] };
    view.clinicFlowScrollBehaviors = [];
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      if (typeof options === "object") {
        view.clinicFlowScrollBehaviors?.push(options.behavior ?? "auto");
      }
      original.call(this, options);
    };
  });

  const finding = page.getByRole("button", { name: /CPK.*Elevado/i });
  await tabTo(page, finding);
  await finding.press("Enter");
  const row = page.getByRole("row", { name: /CPK 562 U\/L/i });
  await expect(row).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { clinicFlowScrollBehaviors?: string[] })
          .clinicFlowScrollBehaviors,
    ),
  ).toContain("auto");
  expect(
    durationMs(
      await row.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    ),
  ).toBeLessThanOrEqual(0.01);

  await page.keyboard.press("Tab");
  const reference = page.getByRole("button", {
    name: "Ver metas por risco de CPK",
  });
  await expect(reference).toBeFocused();
  await reference.press("Enter");
  await expect(
    page.getByRole("button", { name: "Ocultar metas por risco de CPK" }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  expect(browserErrors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".superpowers/sdd/2026-08-10-laudo-v2/screenshots/report-375x812-reduced-motion-keyboard.png",
    fullPage: true,
  });
});

test("alvos operacionais medem 44x44 e o foco real permanece visível", async ({ page }) => {
  await mockExams(page);
  await openExams(page);

  const targets = [
    ["voltar", page.getByRole("button", { name: "Voltar para a lista de pacientes" })],
    ["solicitar", page.getByRole("link", { name: "Solicitar exame" })],
    ["anexar", page.getByRole("link", { name: "Anexar laudo" })],
    ["buscar", page.getByRole("searchbox", { name: "Buscar exames" })],
    ["status", page.getByRole("combobox", { name: "Status" })],
    ["categoria", page.getByRole("combobox", { name: "Categoria" })],
    ["cancelados", page.locator("label").filter({ hasText: "Incluir cancelados" })],
    ["linha", page.getByRole("button", { name: /Perfil lipídico/ })],
  ] as const;

  for (const [name, target] of targets) {
    const box = await target.boundingBox();
    expect(box, `${name} deve estar renderizado`).not.toBeNull();
    expect(box!.width, `${name} deve ter largura mínima de 44px`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${name} deve ter altura mínima de 44px`).toBeGreaterThanOrEqual(44);
  }

  const row = page.getByRole("button", { name: /Perfil lipídico/ });
  await row.focus();
  const focus = await row.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(focus.style).not.toBe("none");
  expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
  expect(focus.color).not.toBe("rgba(0, 0, 0, 0)");
});

test("texto, status e ações atendem contraste renderizado AA", async ({ page }) => {
  await mockExams(page);
  await openExams(page);

  const common = [
    ["texto auxiliar", page.getByText("Solicitações, laudos e revisões do paciente.")],
    ["status em revisão", page.getByLabel("Status: Em revisão — revisão clínica necessária")],
    ["ação solicitar", page.getByRole("link", { name: "Solicitar exame" })],
    ["ação anexar", page.getByRole("link", { name: "Anexar laudo" })],
  ] as const;
  for (const [name, target] of common) {
    const colors = await renderedColors(target);
    expect(contrastRatio(colors.foreground, colors.background), `${name}: ${colors.foreground} em ${colors.background}`).toBeGreaterThanOrEqual(4.5);
  }

  const heading = await renderedColors(page.getByRole("heading", { name: "Exames" }));
  expect(Number.parseFloat(heading.fontSize)).toBeGreaterThanOrEqual(24);
  expect(contrastRatio(heading.foreground, heading.background), `heading: ${heading.foreground} em ${heading.background}`).toBeGreaterThanOrEqual(3);
});

test("fluxo por teclado expõe foco visível e remove movimento não essencial", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockExams(page);
  await page.goto(`/app/pacientes/${patientId}/exames?exame=${processingId}`);
  await expect(page.getByRole("heading", { name: "Ultrassom abdominal" })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Buscar exames" });
  const back = page.getByRole("button", { name: "Voltar aos exames" });
  await back.focus();
  const focus = await back.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(Number.parseFloat(focus)).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Voltar aos exames" })).toBeVisible();
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const rowMotion = await back.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(durationMs(rowMotion)).toBeLessThanOrEqual(0.01);
  const skeletonMotion = await page.getByTestId("exam-detail-skeleton").locator("span").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { duration: style.animationDuration, iterations: style.animationIterationCount };
  });
  expect(durationMs(skeletonMotion.duration)).toBeLessThanOrEqual(0.01);
  expect(skeletonMotion.iterations).toBe("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await back.press("Enter");
  await expect(search).toBeVisible();
  await search.focus();
  await page.keyboard.type("perfil");
  await expect(search).toHaveValue("perfil");
});

test("escala 200% via CDP reduz o viewport CSS e preserva reflow e ações", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 720,
    height: 525,
    screenWidth: 1440,
    screenHeight: 1050,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await mockExams(page);
  await openExams(page);

  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    dpr: window.devicePixelRatio,
    desktopMedia: window.matchMedia("(min-width: 960px)").matches,
  }));
  expect(metrics).toEqual({ width: 720, dpr: 2, desktopMedia: false });
  await expect(page.getByRole("link", { name: "Solicitar exame" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Anexar laudo" })).toBeVisible();
  await page.getByRole("button", { name: /Perfil lipídico/ }).click();
  await expect(page.getByRole("button", { name: "Voltar aos exames" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conferir dados extraídos" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("revisão mobile mantém resultado compacto legível e sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await mockExams(page);
  await page.goto(`/app/pacientes/${patientId}/exames?exame=${reviewId}`);
  await expect(page.getByRole("heading", { name: "Conferir dados extraídos" })).toBeVisible();

  const result = page.getByRole("group", { name: "Resultado 1" });
  await expect(result.getByLabel("Resultado 1 — nome")).toHaveValue("LDL colesterol");
  await expect(result.getByLabel("Resultado 1 — valor")).toHaveValue("160");
  expect(await result.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

for (const width of [390, 640, 960, 1280, 1440]) {
  test(`workspace de revisão não causa overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockExams(page);
    await openExams(page);

    const list = page.getByLabel("Filtros de exames");
    await expect(list).toBeVisible();
    if (width < 960) {
      await expect(page.getByText("Selecione um exame")).toBeHidden();
    } else {
      await expect(page.getByText("Selecione um exame")).toBeVisible();
    }

    await page.getByRole("button", { name: /Perfil lipídico/ }).click();
    await expect(page.getByRole("heading", { name: "Conferir dados extraídos" })).toBeVisible();
    await expect(list).toBeHidden();
    await expect(page.getByRole("button", { name: "Voltar aos exames" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    if (width === 390 || width === 960 || width === 1440) {
      await page.screenshot({
        path: `.specs/features/patient-exams/screenshots/exames-${width}.png`,
        fullPage: true,
      });
    }
  });
}
