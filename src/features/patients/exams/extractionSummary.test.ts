import { expect, test } from "vitest";
import type { PatientExamRevision } from "../../../api/types";
import { summarizeExtraction } from "./extractionSummary";

function revision(overrides: Partial<PatientExamRevision> = {}) {
  return {
    structuredResults: [],
    narrativeSections: [],
    structuredFindings: [],
    ...overrides,
  } as PatientExamRevision;
}

const result = (
  referenceState: PatientExamRevision["structuredResults"][number]["referenceState"],
  confidence: number | null = 1,
) => ({ referenceState, confidence }) as PatientExamRevision["structuredResults"][number];

test("revisão ausente zera as contagens em vez de estimar", () => {
  expect(summarizeExtraction(null)).toEqual({
    results: 0,
    outOfRange: 0,
    laboratoryNotes: 0,
    lowConfidence: 0,
  });
});

test("fora da referência conta apenas elevado e baixo", () => {
  const summary = summarizeExtraction(revision({
    structuredResults: [
      result("elevado"),
      result("baixo"),
      result("limítrofe"),
      result("normal"),
      result("indeterminado"),
    ],
  }));
  expect([summary.results, summary.outOfRange]).toEqual([5, 2]);
});

test("baixa confiança soma resultados, notas e achados abaixo do corte", () => {
  const summary = summarizeExtraction(revision({
    structuredResults: [result("normal", 0.92), result("normal", 0.93)],
    narrativeSections: [
      { confidence: 0.5 },
      { confidence: null },
    ] as PatientExamRevision["narrativeSections"],
    structuredFindings: [{ confidence: 0.1 }] as PatientExamRevision["structuredFindings"],
  }));
  expect(summary.lowConfidence).toBe(3);
  expect(summary.laboratoryNotes).toBe(2);
});

test("confiança não informada não vira alerta de baixa confiança", () => {
  const summary = summarizeExtraction(revision({
    structuredResults: [result("normal", null), result("elevado", null)],
  }));
  expect(summary.lowConfidence).toBe(0);
});
