import type {
  ExamCategory,
  ExamClinicalOutcome,
  ExamListFilters,
  ExamStatus,
  PatientExamDetail,
  PatientExamDocument,
  PatientExamPage,
  PatientExamRevision,
  PatientExamRevisionMetadata,
  PatientExamSummary,
  PatientExamStructuredResult,
} from "../../../api/types";
import { normalizeClinicalReferenceState } from "./clinicalReport";

export type PatientExamSummaryTransport = Omit<PatientExamSummary, "category" | "status"> & {
  category: string;
  status: string;
};

export type PatientExamStructuredResultTransport = Omit<
  PatientExamStructuredResult,
  "referenceLowerBound" | "referenceUpperBound" | "referenceState"
> & {
  referenceLowerBound?: number | null;
  referenceUpperBound?: number | null;
  referenceState?: string | null;
};

export type PatientExamRevisionTransport = Omit<
  PatientExamRevision,
  "aiSuggestedOutcome" | "clinicalOutcome" | "metadata" | "structuredResults" | "narrativeSections" | "structuredFindings" | "extractionIssues"
> & {
  aiSuggestedOutcome: string | null;
  clinicalOutcome: string | null;
  metadata?: PatientExamRevisionMetadata | null;
  structuredResults?: PatientExamStructuredResultTransport[] | null;
  narrativeSections?: PatientExamRevision["narrativeSections"] | null;
  structuredFindings?: PatientExamRevision["structuredFindings"] | null;
  extractionIssues?: PatientExamRevision["extractionIssues"] | null;
};

export type PatientExamDocumentTransport = Omit<PatientExamDocument, "source"> & {
  source: string;
};

export type PatientExamPageTransport = Omit<PatientExamPage, "items"> & {
  items: PatientExamSummaryTransport[];
};

export type PatientExamDetailTransport = Omit<
  PatientExamDetail,
  "category" | "status" | "document" | "activeRevision" | "draftRevision" | "capabilities"
> & {
  category: string;
  status: string;
  document: PatientExamDocumentTransport | null;
  activeRevision: PatientExamRevisionTransport | null;
  draftRevision: PatientExamRevisionTransport | null;
  capabilities: Omit<PatientExamDetail["capabilities"], "canDiscardFailedExam" | "canDiscardExam"> & {
    canDiscardFailedExam?: boolean;
    canDiscardExam?: boolean;
  };
};

const statusApiValues: Record<ExamStatus, string> = {
  Solicitado: "Solicitado",
  Pendente: "Pendente",
  Processando: "Processando",
  "Em revisão": "EmRevisao",
  Validado: "Validado",
  Falhou: "Falhou",
  Cancelado: "Cancelado",
};

const categoryApiValues: Record<ExamCategory, string> = {
  "Não classificado": "NaoClassificado",
  Laboratório: "Laboratorio",
  Imagem: "Imagem",
  Endoscopia: "Endoscopia",
  Cardiologia: "Cardiologia",
};

const outcomeApiValues: Record<ExamClinicalOutcome, string> = {
  Alterado: "Alterado",
  "Sem alterações": "SemAlteracoes",
  Inconclusivo: "Inconclusivo",
};

export const examKeys = {
  all: ["exams"] as const,
  patient: (patientId: string) => ["exams", "patient", patientId] as const,
  list: (patientId: string, filters: ExamListFilters, cursor?: string | null) =>
    ["exams", "patient", patientId, "list", filters, cursor ?? null] as const,
  detail: (examId: string) => ["exams", "detail", examId] as const,
};

export function examListSearchParams(
  filters: ExamListFilters,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set("search", search);
  if (filters.statuses.length) {
    params.set("statuses", filters.statuses.map((status) => statusApiValues[status]).join(","));
  }
  if (filters.categories.length) {
    params.set("categories", filters.categories.map((category) => categoryApiValues[category]).join(","));
  }
  if (cursor) params.set("cursor", cursor);
  if (filters.includeCancelled) params.set("includeCancelled", "true");
  return params;
}

export function toExamCategoryApi(category: ExamCategory) {
  return categoryApiValues[category];
}

export function toExamOutcomeApi(outcome: ExamClinicalOutcome | null) {
  return outcome ? outcomeApiValues[outcome] : null;
}

const statusUiValues: Record<string, ExamStatus> = {
  Solicitado: "Solicitado",
  Pendente: "Pendente",
  Processando: "Processando",
  EmRevisao: "Em revisão",
  "Em revisão": "Em revisão",
  Validado: "Validado",
  Falhou: "Falhou",
  Cancelado: "Cancelado",
};

const categoryUiValues: Record<string, ExamCategory> = {
  NaoClassificado: "Não classificado",
  "Não classificado": "Não classificado",
  Laboratorio: "Laboratório",
  "Laboratório": "Laboratório",
  Imagem: "Imagem",
  Endoscopia: "Endoscopia",
  Cardiologia: "Cardiologia",
};

const outcomeUiValues: Record<string, ExamClinicalOutcome> = {
  Alterado: "Alterado",
  SemAlteracoes: "Sem alterações",
  "Sem alterações": "Sem alterações",
  Inconclusivo: "Inconclusivo",
};

function normalizeRevision(revision: PatientExamRevisionTransport | null): PatientExamRevision | null {
  if (!revision) return null;
  return {
    ...revision,
    aiSuggestedOutcome: revision.aiSuggestedOutcome
      ? outcomeUiValues[revision.aiSuggestedOutcome] ?? "Inconclusivo"
      : null,
    clinicalOutcome: revision.clinicalOutcome
      ? outcomeUiValues[revision.clinicalOutcome] ?? "Inconclusivo"
      : null,
    metadata: revision.metadata ?? null,
    structuredResults: (revision.structuredResults ?? []).map((result) => ({
      ...result,
      referenceLowerBound: result.referenceLowerBound ?? null,
      referenceUpperBound: result.referenceUpperBound ?? null,
      referenceState: normalizeClinicalReferenceState(result.referenceState),
    })),
    narrativeSections: revision.narrativeSections ?? [],
    structuredFindings: revision.structuredFindings ?? [],
    extractionIssues: revision.extractionIssues ?? [],
  };
}

export function normalizePatientExamPage(payload: PatientExamPageTransport): PatientExamPage {
  return {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      status: statusUiValues[item.status] ?? "Falhou",
      category: categoryUiValues[item.category] ?? "Não classificado",
    })),
  };
}

export function normalizePatientExamDetail(payload: PatientExamDetailTransport): PatientExamDetail {
  return {
    ...payload,
    capabilities: {
      ...payload.capabilities,
      canDiscardFailedExam: payload.capabilities.canDiscardFailedExam ?? false,
      canDiscardExam: payload.capabilities.canDiscardExam ?? false,
    },
    status: statusUiValues[payload.status] ?? "Falhou",
    category: categoryUiValues[payload.category] ?? "Não classificado",
    document: payload.document
      ? {
          ...payload.document,
          source: payload.document.source === "Clinica" || payload.document.source === "Clínica"
            ? "Clínica"
            : "Paciente",
        }
      : null,
    activeRevision: normalizeRevision(payload.activeRevision),
    draftRevision: normalizeRevision(payload.draftRevision),
  };
}
