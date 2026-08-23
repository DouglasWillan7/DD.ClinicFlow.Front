import { describe, expect, test } from "vitest";
import {
  formatDelta,
  normalizeClinicalExamReport,
  referenceStateLabel,
} from "./clinicalReport";

function reportTransport(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam-1",
    patientId: "patient-1",
    name: "Hemograma",
    category: "Laboratorio",
    clinicalOutcome: "Alterado",
    version: 3,
    metadata: {
      collectedAtLocal: "2026-08-09T09:00:00",
      issuedOn: "2026-08-09",
      validatedAtUtc: "2026-08-09T12:00:00Z",
      requesterName: "Dra. Ana",
      requesterRegistration: "CRM 123",
      validatorName: "Dr. Bruno",
    },
    document: null,
    findings: [],
    results: [{
      id: "result-1",
      catalogCode: "HB",
      name: "Hemoglobina",
      subtitle: null,
      numericValue: 10.2,
      valueText: "10,2",
      unit: "g/dL",
      referenceText: "12–16",
      detailedReferenceText: null,
      referenceState: "normal",
      confidence: 0.95,
      deltaPercent: null,
      history: [{ date: "2026-08-09", numericValue: 10.2, valueText: "10,2", outOfRange: false }],
    }],
    notes: [],
    capabilities: { canOpenDocument: true, canViewHistory: true, canOpenCorrection: false },
    ...overrides,
  };
}

describe("clinical report helpers", () => {
  test("normaliza estado, confiança ausente e histórico", () => {
    const report = normalizeClinicalExamReport(reportTransport({
      results: [{
        ...reportTransport().results[0],
        referenceState: "elevado",
        confidence: null,
      }],
    }));

    expect(report.results[0].referenceState).toBe("elevado");
    expect(report.results[0].confidence).toBeNull();
    expect(report.results[0].history).toEqual([
      { date: "2026-08-09", numericValue: 10.2, valueText: "10,2", outOfRange: false },
    ]);
    expect(referenceStateLabel("elevado")).toBe("Elevado");
  });

  test("converte estados desconhecidos e arrays ausentes sem inventar metadados", () => {
    const report = normalizeClinicalExamReport(reportTransport({
      metadata: null,
      findings: undefined,
      results: [{ ...reportTransport().results[0], referenceState: "High", history: undefined }],
      notes: undefined,
    }));

    expect(report.metadata).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.structuredFindings).toEqual([]);
    expect(report.results[0].referenceState).toBe("indeterminado");
    expect(report.results[0].history).toEqual([]);
    expect(report.notes).toEqual([]);
  });

  test("preserva achados estruturados validados no contrato normalizado", () => {
    const report = normalizeClinicalExamReport(reportTransport({
      structuredFindings: [{
        id: "finding-rhythm",
        key: "Ritmo",
        value: "Sinusal, sem alterações agudas",
        confidence: 0.94,
      }],
    }));

    expect(report.structuredFindings).toEqual([{
      id: "finding-rhythm",
      key: "Ritmo",
      value: "Sinusal, sem alterações agudas",
      confidence: 0.94,
    }]);
  });

  test("não calcula delta quando a coleta anterior vale zero", () => {
    expect(formatDelta(null)).toBeNull();
  });
});
