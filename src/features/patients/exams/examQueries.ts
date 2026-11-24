import type {
  ExamAnalysisAvailability,
  ExamAnalysisHold,
  ExamAnalysisUnavailableReason,
  ExamCategory,
  ExamSource,
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
  "category" | "status" | "document" | "activeRevision" | "draftRevision" | "capabilities" | "analysisHold"
> & {
  category: string;
  status: string;
  document: PatientExamDocumentTransport | null;
  activeRevision: PatientExamRevisionTransport | null;
  draftRevision: PatientExamRevisionTransport | null;
  capabilities: Omit<
    PatientExamDetail["capabilities"],
    "canDiscardFailedExam" | "canDiscardExam" | "canRequestAnalysis"
  > & {
    canDiscardFailedExam?: boolean;
    canDiscardExam?: boolean;
    canRequestAnalysis?: boolean;
  };
  analysisHold?: string | null;
};

export type ExamAnalysisAvailabilityTransport = {
  available?: boolean;
  reason?: string | null;
};

const statusApiValues: Record<ExamStatus, string> = {
  Pendente: "Pendente",
  Processando: "Processando",
  "Em revisão": "EmRevisao",
  Validado: "Validado",
  Falhou: "Falhou",
  Cancelado: "Cancelado",
  "Sem análise": "Anexado",
};

/**
 * Rótulo de cada estado na tela. "Falhou" diz respeito só à análise por IA: o documento de um
 * exame nesse estado está salvo, e o rótulo precisa deixar isso claro.
 */
export const examStatusLabels: Record<ExamStatus, string> = {
  Pendente: "Pendente",
  Processando: "Processando",
  "Em revisão": "Em revisão",
  Validado: "Validado",
  Falhou: "Análise falhou",
  Cancelado: "Cancelado",
  "Sem análise": "Sem análise",
};

const unavailableReasons: Record<string, ExamAnalysisUnavailableReason> = {
  Desabilitada: "Desabilitada",
  NaoConfigurada: "NaoConfigurada",
  DesabilitadaPelaClinica: "DesabilitadaPelaClinica",
  SemCreditos: "SemCreditos",
  CredencialRecusada: "CredencialRecusada",
};

/** Por que a análise por IA não pode começar agora, em palavras de quem está anexando o laudo. */
export const analysisUnavailableMessages: Record<ExamAnalysisUnavailableReason, string> = {
  Desabilitada: "A análise por IA está desativada.",
  NaoConfigurada: "A análise por IA não está configurada.",
  DesabilitadaPelaClinica: "A análise por IA está desativada nas configurações da clínica.",
  SemCreditos: "A análise por IA está sem créditos disponíveis no momento.",
  CredencialRecusada: "A análise por IA está indisponível no momento.",
};

export function analysisUnavailableMessage(availability: ExamAnalysisAvailability | null | undefined) {
  if (!availability || availability.available) return null;
  return availability.reason
    ? analysisUnavailableMessages[availability.reason]
    : "A análise por IA está indisponível no momento.";
}

export function normalizeExamAnalysisAvailability(
  payload: ExamAnalysisAvailabilityTransport,
): ExamAnalysisAvailability {
  // Só um "não" explícito bloqueia a opção: resposta incompleta não pode esconder a análise,
  // porque o backend decide de novo no envio e guarda o documento de qualquer jeito.
  const available = payload?.available !== false;
  return {
    available,
    // Motivo desconhecido (backend mais novo) cai no texto genérico em vez de sumir.
    reason: available ? null : unavailableReasons[payload.reason ?? ""] ?? null,
  };
}

const analysisHoldValues: Record<string, ExamAnalysisHold> = {
  NaoSolicitada: "NaoSolicitada",
  Indisponivel: "Indisponivel",
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
  analysisAvailability: ["exams", "analysis-availability"] as const,
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
  Pendente: "Pendente",
  Processando: "Processando",
  EmRevisao: "Em revisão",
  "Em revisão": "Em revisão",
  Validado: "Validado",
  Falhou: "Falhou",
  Cancelado: "Cancelado",
  Anexado: "Sem análise",
  "Sem análise": "Sem análise",
};

// Espelha `ExamSource` do backend; valor desconhecido não vira "Paciente".
const examSourceUiValues: Record<string, ExamSource> = {
  Paciente: "Paciente",
  Clinica: "Clínica",
  "Clínica": "Clínica",
  Publico: "Público",
  "Público": "Público",
  Legado: "Legado",
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
      canRequestAnalysis: payload.capabilities.canRequestAnalysis ?? false,
    },
    analysisHold: analysisHoldValues[payload.analysisHold ?? ""] ?? null,
    status: statusUiValues[payload.status] ?? "Falhou",
    category: categoryUiValues[payload.category] ?? "Não classificado",
    document: payload.document
      ? {
          ...payload.document,
          source: examSourceUiValues[payload.document.source] ?? "Origem não informada",
        }
      : null,
    activeRevision: normalizeRevision(payload.activeRevision),
    draftRevision: normalizeRevision(payload.draftRevision),
  };
}
