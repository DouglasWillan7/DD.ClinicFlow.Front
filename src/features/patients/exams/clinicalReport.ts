import type {
  ClinicalExamFinding,
  ClinicalExamHistoryPoint,
  ClinicalExamReport,
  ClinicalExamResult,
  ClinicalExamStructuredFinding,
  ClinicalExamTrend,
  ClinicalReferenceState,
  PatientClinicalSummary,
} from "../../../api/types";

export type ClinicalExamHistoryPointTransport = ClinicalExamHistoryPoint;

export type ClinicalExamResultTransport = Omit<ClinicalExamResult, "referenceState" | "history"> & {
  referenceState: string | null | undefined;
  history?: ClinicalExamHistoryPointTransport[] | null;
};

export type ClinicalExamFindingTransport = Omit<ClinicalExamFinding, "referenceState"> & {
  referenceState: string | null | undefined;
};

export type ClinicalExamTrendTransport = Omit<ClinicalExamTrend, "referenceState" | "points"> & {
  referenceState: string | null | undefined;
  points?: ClinicalExamHistoryPointTransport[] | null;
};

export type ClinicalExamReportTransport = Omit<
  ClinicalExamReport,
  "metadata" | "findings" | "structuredFindings" | "results" | "notes"
> & {
  metadata?: ClinicalExamReport["metadata"];
  findings?: ClinicalExamFindingTransport[] | null;
  structuredFindings?: ClinicalExamStructuredFinding[] | null;
  results?: ClinicalExamResultTransport[] | null;
  notes?: ClinicalExamReport["notes"] | null;
};

export type PatientClinicalSummaryTransport = Omit<
  PatientClinicalSummary,
  "latestReport" | "findings" | "structuredFindings" | "trends"
> & {
  latestReport?: ClinicalExamReportTransport | null;
  findings?: ClinicalExamFindingTransport[] | null;
  structuredFindings?: ClinicalExamStructuredFinding[] | null;
  trends?: ClinicalExamTrendTransport[] | null;
};

const referenceStateLabels: Record<ClinicalReferenceState, string> = {
  normal: "Normal",
  elevado: "Elevado",
  baixo: "Baixo",
  "limítrofe": "Limítrofe",
  indeterminado: "Indeterminado",
};

const categoryLabels: Record<string, string> = {
  Laboratorio: "Laboratório",
  NaoClassificado: "Não classificado",
};

const outcomeLabels: Record<string, string> = {
  SemAlteracoes: "Sem alterações",
};

export function normalizeClinicalReferenceState(value: unknown): ClinicalReferenceState {
  return value === "normal" || value === "elevado" || value === "baixo" || value === "limítrofe"
    ? value
    : "indeterminado";
}

export function referenceStateLabel(state: ClinicalReferenceState): string {
  return referenceStateLabels[state];
}

export function clinicalExamCategoryLabel(value: string): string {
  return categoryLabels[value] ?? value;
}

export function clinicalExamOutcomeLabel(value: string): string {
  return outcomeLabels[value] ?? value;
}

export function formatDelta(deltaPercent: number | null): string | null {
  if (deltaPercent === null) return null;
  return `${deltaPercent > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(deltaPercent)}%`;
}

function normalizeFindingIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function withoutDerivedStructuredFindings(
  structuredFindings: ClinicalExamStructuredFinding[],
  findings: ClinicalExamFinding[],
  results: ClinicalExamResult[] = [],
): ClinicalExamStructuredFinding[] {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  const derivedIdentities = new Set<string>();

  findings.forEach((finding) => {
    const result = resultsById.get(finding.resultId);
    const value = normalizeFindingIdentity(
      `${finding.valueText} ${finding.unit ?? ""}`,
    );
    [finding.name, result?.name, result?.catalogCode]
      .filter((key): key is string => Boolean(key?.trim()))
      .forEach((key) => {
        derivedIdentities.add(`${normalizeFindingIdentity(key)}|${value}`);
      });
  });

  return structuredFindings.filter((finding) =>
    !derivedIdentities.has(
      `${normalizeFindingIdentity(finding.key)}|${normalizeFindingIdentity(finding.value)}`,
    ));
}

export function clinicalTrendKey(trend: ClinicalExamTrend): string {
  const analyte = (trend.catalogCode ?? trend.name).trim().toLocaleUpperCase("pt-BR");
  const unit = trend.unit?.replace(/\s+/g, "").toLocaleUpperCase("pt-BR") ?? "";
  return `${analyte}|unit:${unit}`;
}

function normalizeFinding(finding: ClinicalExamFindingTransport): ClinicalExamFinding {
  return {
    ...finding,
    referenceState: normalizeClinicalReferenceState(finding.referenceState),
  };
}

function normalizeResult(result: ClinicalExamResultTransport): ClinicalExamResult {
  return {
    ...result,
    referenceState: normalizeClinicalReferenceState(result.referenceState),
    history: result.history ?? [],
  };
}

function normalizeTrend(trend: ClinicalExamTrendTransport): ClinicalExamTrend {
  return {
    ...trend,
    referenceState: normalizeClinicalReferenceState(trend.referenceState),
    points: trend.points ?? [],
  };
}

export function normalizeClinicalExamReport(payload: ClinicalExamReportTransport): ClinicalExamReport {
  return {
    ...payload,
    metadata: payload.metadata ?? null,
    findings: (payload.findings ?? []).map(normalizeFinding),
    structuredFindings: payload.structuredFindings ?? [],
    results: (payload.results ?? []).map(normalizeResult),
    notes: payload.notes ?? [],
  };
}

export function normalizePatientClinicalSummary(payload: PatientClinicalSummaryTransport): PatientClinicalSummary {
  return {
    ...payload,
    latestReport: payload.latestReport ? normalizeClinicalExamReport(payload.latestReport) : null,
    findings: (payload.findings ?? []).map(normalizeFinding),
    structuredFindings: payload.structuredFindings ?? [],
    trends: (payload.trends ?? []).map(normalizeTrend),
  };
}
