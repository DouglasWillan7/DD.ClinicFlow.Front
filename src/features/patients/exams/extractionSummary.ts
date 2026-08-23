import type { PatientExamRevision } from "../../../api/types";
import { LOW_CONFIDENCE_THRESHOLD } from "./examDetail";

export interface ExtractionSummary {
  results: number;
  outOfRange: number;
  laboratoryNotes: number;
  lowConfidence: number;
}

const emptySummary: ExtractionSummary = {
  results: 0,
  outOfRange: 0,
  laboratoryNotes: 0,
  lowConfidence: 0,
};

function isLowConfidence(item: { confidence: number | null }) {
  return item.confidence !== null && item.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * Contagens que o médico vê ao fim da extração, antes de abrir a revisão.
 * Tudo vem da revisão em rascunho: nada aqui é estimado.
 */
export function summarizeExtraction(
  revision: PatientExamRevision | null | undefined,
): ExtractionSummary {
  if (!revision) return emptySummary;
  const { structuredResults, narrativeSections, structuredFindings } = revision;
  return {
    results: structuredResults.length,
    outOfRange: structuredResults.filter(
      (result) => result.referenceState === "elevado" || result.referenceState === "baixo",
    ).length,
    laboratoryNotes: narrativeSections.length,
    lowConfidence: [...structuredResults, ...narrativeSections, ...structuredFindings]
      .filter(isLowConfidence).length,
  };
}
