import type { PatientExamExtractionIssue } from "../../../api/types";

const genericResultNameWarning = "Não foi possível identificar o nome de um resultado. Compare com o laudo original.";
const patientContextMismatchWarning = "Os dados do paciente no laudo divergem do cadastro. Confira antes de validar.";
const referenceContextWarning = "A referência exige um contexto clínico que não pôde ser determinado.";

const warningByReason: Readonly<Record<string, string>> = {
  GENERIC_RESULT_NAME: genericResultNameWarning,
  PATIENT_CONTEXT_MISMATCH: patientContextMismatchWarning,
  REFERENCE_CONTEXT_MISSING: referenceContextWarning,
  AMBIGUOUS_REFERENCE_CONTEXT: referenceContextWarning,
};

export function extractionWarningMessages(issues: readonly PatientExamExtractionIssue[]) {
  const messages = new Set<string>();
  for (const issue of issues) {
    const message = warningByReason[issue.reason];
    if (message) messages.add(message);
  }
  return [...messages];
}
