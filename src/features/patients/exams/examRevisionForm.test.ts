import { describe, expect, test } from "vitest";
import type { PatientExamRevision } from "../../../api/types";
import {
  parseRevisionSubmission,
  revisionToForm,
  type ExamRevisionFormInput,
} from "./examRevisionForm";

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
  structuredResults: [{ id: "result-1", order: 2, catalogCode: "HB", name: "Hemoglobina", numericValue: 10.2, textValue: null, unit: "g/dL", referenceText: "12–16", outOfRangeSuggestion: true, confidence: 0.92, referenceLowerBound: null, referenceUpperBound: null, referenceState: "indeterminado" }],
  narrativeSections: [{ id: "section-1", order: 1, title: "Conclusão", text: "Sem sinais agudos", confidence: null }],
  structuredFindings: [{ id: "finding-1", order: 0, key: "Ritmo", value: "Sinusal", confidence: 0.98 }],
  extractionIssues: [],
};

function emptyForm(overrides: Partial<ExamRevisionFormInput> = {}): ExamRevisionFormInput {
  return {
    structuredResults: [],
    narrativeSections: [],
    structuredFindings: [],
    metadata: { collectedAtLocal: "", issuedOn: "", requesterName: "", requesterRegistration: "" },
    clinicalOutcome: "",
    correctionReason: "",
    ...overrides,
  };
}

describe("exam revision form", () => {
  test("normaliza conteúdo misto existente sem perder IDs clínicos", () => {
    const form = revisionToForm(revision);
    expect(form.structuredResults[0]).toMatchObject({ id: "result-1", name: "Hemoglobina", numericValue: "10.2", confidence: "0.92", outOfRangeSuggestion: "true", referenceState: "indeterminado" });
    expect(form.narrativeSections[0]).toMatchObject({ id: "section-1", title: "Conclusão", confidence: "" });
    expect(form.structuredFindings[0]).toMatchObject({ id: "finding-1", key: "Ritmo", confidence: "0.98" });
    expect(form.metadata).toEqual({ collectedAtLocal: "2026-08-09T09:30:00", issuedOn: "2026-08-09", requesterName: "Dra. Ana", requesterRegistration: "CRM 123" });
  });

  test("interpreta números brasileiros sem confundir milhar com decimal", () => {
    const base = revisionToForm(revision);
    const result = parseRevisionSubmission({
      ...base,
      structuredResults: [
        { ...base.structuredResults[0], numericValue: "1.018" },
        { ...base.structuredResults[0], id: "result-2", editorKey: "Resultado 2", numericValue: "24,03" },
      ],
    }, "draft", false);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      value: expect.objectContaining({
        structuredResults: [
          expect.objectContaining({ numericValue: 1018 }),
          expect.objectContaining({ numericValue: 24.03 }),
        ],
      }),
    }));
  });

  test("rascunho aceita conclusão clínica ausente", () => {
    const result = parseRevisionSubmission(emptyForm(), "draft", false);
    expect(result).toEqual(expect.objectContaining({ success: true, value: expect.objectContaining({ clinicalOutcome: null }) }));
  });

  test("validação exige conclusão clínica", () => {
    const result = parseRevisionSubmission(emptyForm({ structuredFindings: [{ editorKey: "Achado 1", id: "finding-1", key: "Ritmo", value: "Sinusal", confidence: "" }] }), "validate", false);
    expect(result).toEqual({ success: false, issues: [{ path: "clinicalOutcome", message: "Confirme a conclusão clínica." }] });
  });

  test("validação exige ao menos um conteúdo", () => {
    const result = parseRevisionSubmission(emptyForm({ clinicalOutcome: "Inconclusivo" }), "validate", false);
    expect(result).toEqual({ success: false, issues: [{ path: "root.content", message: "Adicione ao menos um resultado, seção ou achado." }] });
  });

  test("correção exige motivo tanto no rascunho quanto na validação", () => {
    expect(parseRevisionSubmission(emptyForm(), "draft", true)).toEqual({ success: false, issues: [{ path: "correctionReason", message: "Explique o motivo da correção." }] });
  });

  test("confiança é opcional e limitada ao intervalo fechado entre zero e um", () => {
    const base = { editorKey: "Achado 1", id: "finding-1", key: "Ritmo", value: "Sinusal" };
    const absent = parseRevisionSubmission(emptyForm({ structuredFindings: [{ ...base, confidence: "" }] }), "draft", false);
    expect(absent).toEqual(expect.objectContaining({ success: true, value: expect.objectContaining({ structuredFindings: [expect.objectContaining({ confidence: null })] }) }));
    const invalid = parseRevisionSubmission(emptyForm({ structuredFindings: [{ ...base, confidence: "1.01" }] }), "draft", false);
    expect(invalid).toEqual({ success: false, issues: [{ path: "structuredFindings.0.confidence", message: "Informe uma confiança entre 0 e 1." }] });
  });

  test("resultado estruturado exige valor numérico ou textual", () => {
    const result = parseRevisionSubmission(emptyForm({ structuredResults: [{ editorKey: "Resultado 1", id: "result-1", catalogCode: "", name: "Hemoglobina", numericValue: "", textValue: "", unit: "", referenceText: "", outOfRangeSuggestion: "", referenceState: "indeterminado", confidence: "" }] }), "draft", false);
    expect(result).toEqual({ success: false, issues: [{ path: "structuredResults.0.numericValue", message: "Informe um valor numérico ou textual." }] });
  });

  test("saída usa a ordem atual e converte números, booleanos e vazios", () => {
    const result = parseRevisionSubmission(revisionToForm(revision), "draft", false);
    expect(result).toEqual(expect.objectContaining({
      success: true,
      value: expect.objectContaining({
        structuredResults: [expect.objectContaining({ order: 0, numericValue: 10.2, textValue: null, outOfRangeSuggestion: true, confidence: 0.92, referenceState: "indeterminado" })],
        narrativeSections: [expect.objectContaining({ order: 0, confidence: null })],
        structuredFindings: [expect.objectContaining({ order: 0, confidence: 0.98 })],
        metadata: revision.metadata,
      }),
    }));
  });
});
