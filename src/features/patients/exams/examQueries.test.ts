import { describe, expect, test } from "vitest";
import type { ExamListFilters } from "../../../api/types";
import {
  examKeys,
  examListSearchParams,
  normalizePatientExamDetail,
  normalizePatientExamPage,
} from "./examQueries";

const filters: ExamListFilters = {
  search: "hemograma",
  statuses: ["Em revisão", "Falhou"],
  categories: ["Laboratório"],
  includeCancelled: false,
};

describe("examKeys", () => {
  test("mantém raízes estáveis para invalidação por feature e paciente", () => {
    expect(examKeys.all).toEqual(["exams"]);
    expect(examKeys.patient("patient-1")).toEqual(["exams", "patient", "patient-1"]);
  });

  test("separa paciente, filtros e cursor", () => {
    expect(examKeys.list("patient-1", filters, "cursor-2")).toEqual([
      "exams", "patient", "patient-1", "list", filters, "cursor-2",
    ]);
    expect(examKeys.list("patient-2", filters, "cursor-2")).not.toEqual(
      examKeys.list("patient-1", filters, "cursor-2"),
    );
    expect(examKeys.list("patient-1", filters, "cursor-3")).not.toEqual(
      examKeys.list("patient-1", filters, "cursor-2"),
    );
  });

  test("separa detalhe pelo id do exame", () => {
    expect(examKeys.detail("exam-9")).toEqual(["exams", "detail", "exam-9"]);
  });
});

describe("examListSearchParams", () => {
  test("serializa filtros e cursor no contrato do backend", () => {
    expect(examListSearchParams(filters, "cursor-2").toString()).toBe(
      "search=hemograma&statuses=EmRevisao%2CFalhou&categories=Laboratorio&cursor=cursor-2",
    );
  });

  test("inclui cancelados somente por opção explícita", () => {
    expect(examListSearchParams({ ...filters, includeCancelled: true }).get("includeCancelled"))
      .toBe("true");
    expect(examListSearchParams(filters).has("includeCancelled")).toBe(false);
  });
});

describe("exam transport normalization", () => {
  test("traduz página do contrato BACK para rótulos apresentáveis", () => {
    const page = normalizePatientExamPage({
      items: [{ id: "exam-1", patientId: "patient-1", name: "Hemograma", category: "Laboratorio", scheduledOn: null, status: "EmRevisao", version: 2, hasDocument: true, averageConfidence: 0.92, createdAtUtc: "2026-08-09T10:00:00Z", updatedAtUtc: "2026-08-09T11:00:00Z" }],
      nextCursor: null,
      capabilities: { canRequest: true, canAttachDocument: true },
    });
    expect(page.items[0]).toEqual(expect.objectContaining({ category: "Laboratório", status: "Em revisão" }));
  });

  test("traduz detalhe, fonte e desfechos aninhados sem expor enum cru", () => {
    const detail = normalizePatientExamDetail({
      id: "exam-1", patientId: "patient-1", doctorUserId: "doctor-1", requestedByUserId: "doctor-1", name: "Hemograma", category: "NaoClassificado", scheduledOn: null, status: "Falhou", version: 3, error: "Falha sanitizada", createdAtUtc: "2026-08-09T10:00:00Z", updatedAtUtc: "2026-08-09T11:00:00Z", processedAtUtc: "2026-08-09T11:00:00Z", cancelledByUserId: null, cancelledAtUtc: null,
      document: { fileName: "laudo.pdf", contentType: "application/pdf", sizeBytes: 50, source: "Clinica", createdAtUtc: "2026-08-09T10:00:00Z", processingAttempts: 1 },
      activeRevision: { id: "revision-1", number: 1, status: "Validada", aiSuggestedOutcome: "SemAlteracoes", clinicalOutcome: "SemAlteracoes", averageConfidence: 0.99, model: null, correctionReason: null, createdByUserId: "doctor-1", createdAtUtc: "2026-08-09T10:00:00Z", lastEditedByUserId: null, updatedAtUtc: null, validatedByUserId: "doctor-1", validatedAtUtc: "2026-08-09T11:00:00Z", structuredResults: [{ id: "result-1", order: 0, catalogCode: "HB", name: "Hemoglobina", numericValue: 10.2, textValue: null, unit: "g/dL", referenceText: "12–16", outOfRangeSuggestion: true, confidence: 0.99 }], narrativeSections: [], structuredFindings: [], extractionIssues: [{ id: "issue-1", structuredResultId: "result-1", page: 4, field: "referenceRange", reason: "REFERENCE_CONTEXT_MISSING" }] },
      draftRevision: null, attemptsRemaining: 2,
      capabilities: { canEditRequest: false, canCancelRequest: false, canAttachDocument: false, canReprocess: false, canDiscardFailedExam: true, canDiscardExam: true, canOpenCorrection: true, canEditRevision: false, canClassify: false, canValidate: false },
    });
    expect(detail).toEqual(expect.objectContaining({ category: "Não classificado", document: expect.objectContaining({ source: "Clínica" }), activeRevision: expect.objectContaining({ aiSuggestedOutcome: "Sem alterações", clinicalOutcome: "Sem alterações", metadata: null, structuredResults: [expect.objectContaining({ referenceLowerBound: null, referenceUpperBound: null, referenceState: "indeterminado" })] }) }));
    expect(detail.activeRevision?.extractionIssues).toEqual([{ id: "issue-1", structuredResultId: "result-1", page: 4, field: "referenceRange", reason: "REFERENCE_CONTEXT_MISSING" }]);
    expect(detail.capabilities.canDiscardFailedExam).toBe(true);
    expect(detail.capabilities.canDiscardExam).toBe(true);
  });

  test("normaliza capability de descarte ausente como falsa", () => {
    const detail = normalizePatientExamDetail({
      id: "exam-failed", patientId: "patient-1", doctorUserId: "doctor-1", requestedByUserId: "doctor-1", name: "Hemograma", category: "Laboratorio", scheduledOn: null, status: "Falhou", version: 2, error: "Falha sanitizada", createdAtUtc: "2026-08-09T10:00:00Z", updatedAtUtc: "2026-08-09T11:00:00Z", processedAtUtc: null, cancelledByUserId: null, cancelledAtUtc: null,
      document: null, activeRevision: null, draftRevision: null, attemptsRemaining: 0,
      capabilities: { canEditRequest: false, canCancelRequest: false, canAttachDocument: false, canReprocess: false, canOpenCorrection: false, canEditRevision: false, canClassify: false, canValidate: false },
    });

    expect(detail.capabilities.canDiscardFailedExam).toBe(false);
    expect(detail.capabilities.canDiscardExam).toBe(false);
  });
});
