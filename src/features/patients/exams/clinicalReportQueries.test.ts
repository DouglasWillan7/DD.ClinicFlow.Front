import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  ClinicalExamReport,
  PatientClinicalSummary,
} from "../../../api/types";
import type {
  ClinicalExamReportTransport,
  PatientClinicalSummaryTransport,
} from "./clinicalReport";
import {
  clinicalReportKeys,
  useClinicalExamReport,
  usePatientClinicalSummary,
} from "./clinicalReportQueries";

const request = vi.hoisted(() => vi.fn());

vi.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({ request }),
}));

function reportTransport(overrides: Partial<ClinicalExamReportTransport> = {}): ClinicalExamReportTransport {
  return {
    id: "exam-1",
    patientId: "patient-1",
    name: "Hemograma",
    category: "Laboratorio",
    clinicalOutcome: "Alterado",
    version: 3,
    metadata: null,
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
      referenceState: "High",
      confidence: null,
      deltaPercent: null,
      history: [],
    }],
    notes: [],
    capabilities: { canOpenDocument: true, canViewHistory: true, canOpenCorrection: false },
    ...overrides,
  };
}

function summaryTransport(overrides: Partial<PatientClinicalSummaryTransport> = {}): PatientClinicalSummaryTransport {
  return {
    latestReport: reportTransport(),
    totalFindingCount: 1,
    findings: [{ resultId: "result-1", name: "Hemoglobina", valueText: "10,2", unit: "g/dL", referenceText: "12–16", referenceState: "Low", deltaPercent: null }],
    trends: [{ catalogCode: "HB", name: "Hemoglobina", unit: "g/dL", referenceState: "unknown", points: undefined }],
    latestCollectionDate: "2026-08-09",
    capabilities: { canRequest: true, canAttachDocument: true },
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
}

afterEach(() => request.mockReset());

describe("clinical report query keys", () => {
  test("separa relatório por exame e resumo por paciente", () => {
    expect(clinicalReportKeys.report("exam-1")).toEqual(["exams", "exam-1", "clinical-report"]);
    expect(clinicalReportKeys.summary("patient-1")).toEqual(["patients", "patient-1", "clinical-summary"]);
  });
});

describe("clinical report query hooks", () => {
  test("busca o relatório na URL clínica e normaliza a resposta", async () => {
    request.mockResolvedValue(reportTransport());
    const { result } = renderHook(() => useClinicalExamReport("exam-1", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(expect.objectContaining({
      results: [expect.objectContaining({ referenceState: "indeterminado" })],
    } satisfies Partial<ClinicalExamReport>)));
    expect(request).toHaveBeenCalledWith("/exams/exam-1/report");
  });

  test("não inicia a consulta do relatório sem um exame habilitado", async () => {
    const { result } = renderHook(() => useClinicalExamReport(null, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isFetching).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  test("mantém a consulta desabilitada mesmo com um exame selecionado", async () => {
    const { result } = renderHook(() => useClinicalExamReport("exam-1", false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  test("busca o resumo clínico, normaliza séries e preserva a resposta utilizável", async () => {
    request.mockResolvedValue(summaryTransport());
    const { result } = renderHook(() => usePatientClinicalSummary("patient-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(expect.objectContaining({
      latestReport: expect.objectContaining({
        results: [expect.objectContaining({ referenceState: "indeterminado" })],
      }),
      findings: [expect.objectContaining({ referenceState: "indeterminado" })],
      trends: [expect.objectContaining({ referenceState: "indeterminado", points: [] })],
    } satisfies Partial<PatientClinicalSummary>)));
    expect(request).toHaveBeenCalledWith("/exams/patients/patient-1/clinical-summary");
  });
});
