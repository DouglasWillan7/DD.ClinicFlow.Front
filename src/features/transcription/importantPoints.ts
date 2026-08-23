import { ApiError } from "../../api/client";

export const consultationPointCategories = [
  "Symptom",
  "Alert",
  "Medication",
  "Habit",
  "Conduct",
  "Exam",
  "Guidance",
] as const;

export const consultationPointStatuses = [
  "Draft",
  "Accepted",
  "Rejected",
  "Saved",
] as const;

export const consultationPointProcessingStatuses = [
  "Idle",
  "Pending",
  "Processing",
  "Available",
  "Unavailable",
] as const;

export type ConsultationPointCategory = typeof consultationPointCategories[number];
export type ConsultationPointStatus = typeof consultationPointStatuses[number];
export type ConsultationPointProcessingStatus = typeof consultationPointProcessingStatuses[number];
export type ConsultationPointReviewAction = "Accept" | "Reject" | "Edit";

export interface ImportantPointEvidence {
  segmentId: string;
  quote: string;
  quoteStart: number;
  quoteLength: number;
  startTimeMs: number;
}

export interface ConsultationImportantPoint {
  id: string;
  category: ConsultationPointCategory;
  generatedText: string;
  reviewedText: string | null;
  displayText: string;
  status: ConsultationPointStatus;
  version: number;
  firstEvidenceStartTimeMs: number;
  evidence: ImportantPointEvidence[];
}

export interface ConsultationImportantPointsSnapshot {
  sessionId: string | null;
  processingStatus: ConsultationPointProcessingStatus;
  waitingForSpeakerCount: number;
  updatedAtUtc: string | null;
  points: ConsultationImportantPoint[];
}

export interface ReviewConsultationPointInput {
  action: ConsultationPointReviewAction;
  text: string | null;
  expectedVersion: number;
}

type AuthenticatedRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

const categoryLabels: Record<ConsultationPointCategory, string> = {
  Symptom: "Sintoma",
  Alert: "Alerta",
  Medication: "Medicação",
  Habit: "Hábito",
  Conduct: "Conduta",
  Exam: "Exame",
  Guidance: "Orientação",
};

const statusLabels: Record<ConsultationPointStatus, string> = {
  Draft: "Revisão pendente",
  Accepted: "Aceito",
  Rejected: "Rejeitado",
  Saved: "Salvo",
};

export class InvalidConsultationPointPayloadError extends Error {
  constructor() {
    super("A resposta dos pontos importantes é inválida.");
    this.name = "InvalidConsultationPointPayloadError";
  }
}

export class ConsultationPointConflictError extends Error {
  constructor(readonly currentPoint: ConsultationImportantPoint) {
    super("O ponto foi alterado. Revise o estado atual antes de tentar novamente.");
    this.name = "ConsultationPointConflictError";
  }
}

export function getConsultationPointCategoryLabel(value: string) {
  return isOneOf(value, consultationPointCategories)
    ? categoryLabels[value]
    : "Categoria não reconhecida";
}

export function getConsultationPointStatusLabel(value: string) {
  return isOneOf(value, consultationPointStatuses)
    ? statusLabels[value]
    : "Estado não reconhecido";
}

export function consultationImportantPointsQueryKey(appointmentId: string) {
  return ["consultation-important-points", appointmentId] as const;
}

export async function getConsultationImportantPoints(
  request: AuthenticatedRequest,
  appointmentId: string,
) {
  const payload = await request<unknown>(`/consultations/${appointmentId}/important-points`);
  return parseConsultationImportantPointsSnapshot(payload);
}

export async function reviewConsultationImportantPoint(
  request: AuthenticatedRequest,
  pointId: string,
  input: ReviewConsultationPointInput,
) {
  try {
    const payload = await request<unknown>(`/consultation-important-points/${pointId}/review`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    return parseConsultationImportantPoint(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const currentPoint = (error.problem as { currentPoint?: unknown } | undefined)?.currentPoint;
      try {
        if (currentPoint !== undefined) {
          throw new ConsultationPointConflictError(parseConsultationImportantPoint(currentPoint));
        }
      } catch (conflictError) {
        if (conflictError instanceof ConsultationPointConflictError) throw conflictError;
      }
    }
    throw error;
  }
}

export async function saveConsultationImportantPoints(
  request: AuthenticatedRequest,
  appointmentId: string,
  saveRequestId: string,
) {
  const payload = await request<unknown>(`/consultations/${appointmentId}/important-points/save`, {
    method: "POST",
    body: JSON.stringify({ saveRequestId }),
  });
  if (!Array.isArray(payload)) invalidPayload();
  return payload.map(parseConsultationImportantPoint);
}

export function parseConsultationImportantPointsSnapshot(
  payload: unknown,
): ConsultationImportantPointsSnapshot {
  const value = asRecord(payload);
  const processingStatus = requiredString(value.processingStatus);
  if (!isOneOf(processingStatus, consultationPointProcessingStatuses)) invalidPayload();
  if (!Array.isArray(value.points)) invalidPayload();

  return {
    sessionId: nullableString(value.sessionId),
    processingStatus,
    waitingForSpeakerCount: nonNegativeInteger(value.waitingForSpeakerCount),
    updatedAtUtc: nullableString(value.updatedAtUtc),
    points: value.points.map(parseConsultationImportantPoint),
  };
}

export function parseConsultationImportantPoint(payload: unknown): ConsultationImportantPoint {
  const value = asRecord(payload);
  const category = requiredString(value.category);
  const status = requiredString(value.status);
  if (!isOneOf(category, consultationPointCategories) ||
    !isOneOf(status, consultationPointStatuses) ||
    !Array.isArray(value.evidence)) invalidPayload();

  return {
    id: requiredString(value.id),
    category,
    generatedText: requiredString(value.generatedText),
    reviewedText: nullableString(value.reviewedText),
    displayText: requiredString(value.displayText),
    status,
    version: positiveInteger(value.version),
    firstEvidenceStartTimeMs: nonNegativeInteger(value.firstEvidenceStartTimeMs),
    evidence: value.evidence.map(parseEvidence),
  };
}

function parseEvidence(payload: unknown): ImportantPointEvidence {
  const value = asRecord(payload);
  return {
    segmentId: requiredString(value.segmentId),
    quote: requiredString(value.quote),
    quoteStart: nonNegativeInteger(value.quoteStart),
    quoteLength: positiveInteger(value.quoteLength),
    startTimeMs: nonNegativeInteger(value.startTimeMs),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidPayload();
  return value as Record<string, unknown>;
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || value.length === 0) invalidPayload();
  return value;
}

function nullableString(value: unknown) {
  if (value === null) return null;
  return requiredString(value);
}

function nonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) invalidPayload();
  return value;
}

function positiveInteger(value: unknown) {
  const integer = nonNegativeInteger(value);
  if (integer === 0) invalidPayload();
  return integer;
}

function isOneOf<const T extends readonly string[]>(
  value: string,
  allowed: T,
): value is T[number] {
  return allowed.some((candidate) => candidate === value);
}

function invalidPayload(): never {
  throw new InvalidConsultationPointPayloadError();
}
