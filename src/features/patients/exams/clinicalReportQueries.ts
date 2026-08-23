import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import type { ClinicalExamReport, PatientClinicalSummary } from "../../../api/types";
import {
  normalizeClinicalExamReport,
  normalizePatientClinicalSummary,
  type ClinicalExamReportTransport,
  type PatientClinicalSummaryTransport,
} from "./clinicalReport";

export const clinicalReportKeys = {
  report: (examId: string) => ["exams", examId, "clinical-report"] as const,
  summary: (patientId: string) => ["patients", patientId, "clinical-summary"] as const,
};

export function useClinicalExamReport(
  examId: string | null,
  enabled: boolean,
): UseQueryResult<ClinicalExamReport> {
  const { request } = useAuth();

  return useQuery({
    queryKey: clinicalReportKeys.report(examId ?? "none"),
    enabled: enabled && Boolean(examId),
    queryFn: async () => {
      if (!examId) throw new Error("Exame não selecionado.");
      return normalizeClinicalExamReport(
        await request<ClinicalExamReportTransport>(`/exams/${examId}/report`),
      );
    },
  });
}

export function usePatientClinicalSummary(
  patientId: string,
): UseQueryResult<PatientClinicalSummary> {
  const { request } = useAuth();

  return useQuery({
    queryKey: clinicalReportKeys.summary(patientId),
    queryFn: async () => normalizePatientClinicalSummary(
      await request<PatientClinicalSummaryTransport>(
        `/exams/patients/${patientId}/clinical-summary`,
      ),
    ),
  });
}
