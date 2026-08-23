import { z } from "zod";
import type {
  ExamClinicalOutcome,
  PatientExamNarrativeSection,
  PatientExamRevision,
  PatientExamRevisionMetadata,
  PatientExamStructuredFinding,
  PatientExamStructuredResult,
} from "../../../api/types";

export function parseBrazilianNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;
  const parsed = /^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const optionalNumber = z.string().refine(
  (value) => value === "" || parseBrazilianNumber(value) !== null,
  "Informe um número válido.",
);

const optionalConfidence = optionalNumber.refine(
  (value) => value === "" || (Number(value) >= 0 && Number(value) <= 1),
  "Informe uma confiança entre 0 e 1.",
);

const structuredResultSchema = z.object({
  editorKey: z.string(),
  id: z.string(),
  catalogCode: z.string(),
  name: z.string().trim().min(1, "Informe o nome do resultado."),
  numericValue: optionalNumber,
  textValue: z.string(),
  unit: z.string(),
  referenceText: z.string(),
  outOfRangeSuggestion: z.enum(["", "true", "false"]),
  referenceState: z.enum(["normal", "elevado", "baixo", "limítrofe", "indeterminado"]),
  confidence: optionalConfidence,
}).superRefine((value, context) => {
  if (value.numericValue === "" && value.textValue.trim() === "") {
    context.addIssue({
      code: "custom",
      path: ["numericValue"],
      message: "Informe um valor numérico ou textual.",
    });
  }
});

const narrativeSectionSchema = z.object({
  editorKey: z.string(),
  id: z.string(),
  title: z.string().trim().min(1, "Informe o título da seção."),
  text: z.string().trim().min(1, "Informe o texto da seção."),
  confidence: optionalConfidence,
});

const structuredFindingSchema = z.object({
  editorKey: z.string(),
  id: z.string(),
  key: z.string().trim().min(1, "Informe a chave do achado."),
  value: z.string().trim().min(1, "Informe o valor do achado."),
  confidence: optionalConfidence,
});

export const examRevisionFormSchema = z.object({
  structuredResults: z.array(structuredResultSchema),
  narrativeSections: z.array(narrativeSectionSchema),
  structuredFindings: z.array(structuredFindingSchema),
  metadata: z.object({
    collectedAtLocal: z.string(),
    issuedOn: z.string(),
    requesterName: z.string(),
    requesterRegistration: z.string(),
  }),
  clinicalOutcome: z.union([
    z.literal(""),
    z.literal("Alterado"),
    z.literal("Sem alterações"),
    z.literal("Inconclusivo"),
  ]),
  correctionReason: z.string(),
});

export type ExamRevisionFormInput = z.input<typeof examRevisionFormSchema>;

export interface RevisionSubmissionValue {
  structuredResults: Array<Omit<
    PatientExamStructuredResult,
    "referenceLowerBound" | "referenceUpperBound"
  >>;
  narrativeSections: PatientExamNarrativeSection[];
  structuredFindings: PatientExamStructuredFinding[];
  metadata: PatientExamRevisionMetadata;
  clinicalOutcome: ExamClinicalOutcome | null;
  correctionReason: string | null;
}

export type RevisionSubmissionResult =
  | { success: true; value: RevisionSubmissionValue }
  | { success: false; issues: Array<{ path: string; message: string }> };

const optionalString = (value: string) => value.trim() || null;
const optionalNumeric = (value: string) => parseBrazilianNumber(value);

export function revisionToForm(revision: PatientExamRevision): ExamRevisionFormInput {
  return {
    structuredResults: [...revision.structuredResults]
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({
        editorKey: `Resultado ${index + 1}`,
        id: item.id,
        catalogCode: item.catalogCode ?? "",
        name: item.name,
        numericValue: item.numericValue === null ? "" : String(item.numericValue),
        textValue: item.textValue ?? "",
        unit: item.unit ?? "",
        referenceText: item.referenceText ?? "",
        outOfRangeSuggestion: item.outOfRangeSuggestion === null ? "" : String(item.outOfRangeSuggestion) as "true" | "false",
        referenceState: item.referenceState,
        confidence: item.confidence === null ? "" : String(item.confidence),
      })),
    narrativeSections: [...revision.narrativeSections]
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({
        editorKey: `Seção ${index + 1}`,
        id: item.id,
        title: item.title,
        text: item.text,
        confidence: item.confidence === null ? "" : String(item.confidence),
      })),
    structuredFindings: [...revision.structuredFindings]
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({
        editorKey: `Achado ${index + 1}`,
        id: item.id,
        key: item.key,
        value: item.value,
        confidence: item.confidence === null ? "" : String(item.confidence),
      })),
    metadata: {
      collectedAtLocal: revision.metadata?.collectedAtLocal ?? "",
      issuedOn: revision.metadata?.issuedOn ?? "",
      requesterName: revision.metadata?.requesterName ?? "",
      requesterRegistration: revision.metadata?.requesterRegistration ?? "",
    },
    clinicalOutcome: revision.clinicalOutcome ?? "",
    correctionReason: revision.correctionReason ?? "",
  };
}

export function parseRevisionSubmission(
  input: ExamRevisionFormInput,
  intent: "draft" | "validate",
  isCorrection: boolean,
): RevisionSubmissionResult {
  const parsed = examRevisionFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  if (isCorrection && !parsed.data.correctionReason.trim()) {
    return { success: false, issues: [{ path: "correctionReason", message: "Explique o motivo da correção." }] };
  }
  if (intent === "validate" && !parsed.data.clinicalOutcome) {
    return { success: false, issues: [{ path: "clinicalOutcome", message: "Confirme a conclusão clínica." }] };
  }
  if (intent === "validate" && !(
    parsed.data.structuredResults.length
    || parsed.data.narrativeSections.length
    || parsed.data.structuredFindings.length
  )) {
    return { success: false, issues: [{ path: "root.content", message: "Adicione ao menos um resultado, seção ou achado." }] };
  }

  return {
    success: true,
    value: {
      structuredResults: parsed.data.structuredResults.map((item, order) => ({
        id: item.id,
        order,
        catalogCode: optionalString(item.catalogCode),
        name: item.name.trim(),
        numericValue: optionalNumeric(item.numericValue),
        textValue: optionalString(item.textValue),
        unit: optionalString(item.unit),
        referenceText: optionalString(item.referenceText),
        outOfRangeSuggestion: item.outOfRangeSuggestion === "" ? null : item.outOfRangeSuggestion === "true",
        referenceState: item.referenceState,
        confidence: optionalNumeric(item.confidence),
      })),
      narrativeSections: parsed.data.narrativeSections.map((item, order) => ({
        id: item.id,
        order,
        title: item.title.trim(),
        text: item.text.trim(),
        confidence: optionalNumeric(item.confidence),
      })),
      structuredFindings: parsed.data.structuredFindings.map((item, order) => ({
        id: item.id,
        order,
        key: item.key.trim(),
        value: item.value.trim(),
        confidence: optionalNumeric(item.confidence),
      })),
      metadata: {
        collectedAtLocal: optionalString(parsed.data.metadata.collectedAtLocal),
        issuedOn: optionalString(parsed.data.metadata.issuedOn),
        requesterName: optionalString(parsed.data.metadata.requesterName),
        requesterRegistration: optionalString(parsed.data.metadata.requesterRegistration),
      },
      clinicalOutcome: parsed.data.clinicalOutcome || null,
      correctionReason: optionalString(parsed.data.correctionReason),
    },
  };
}

export const clinicalOutcomes: ExamClinicalOutcome[] = ["Alterado", "Sem alterações", "Inconclusivo"];
