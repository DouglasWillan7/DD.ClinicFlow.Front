import type {
  AppointmentType,
  AvailabilitySlot,
  Member,
  Patient,
} from "../../api/types";
import { SCOPED_SESSION_STORAGE_PREFIX } from "../../auth/sessionScope";

const DRAFT_KEY_PREFIX = `${SCOPED_SESSION_STORAGE_PREFIX}new-appointment-draft:`;
const DRAFT_VERSION = 1;

export interface NewAppointmentSelection {
  patient: Patient | null;
  doctor: Member | null;
  type: AppointmentType | null;
  date: string | null;
  slot: AvailabilitySlot | null;
  healthcarePlanId?: string | null;
}

export interface NewAppointmentDraft {
  patientId: string | null;
  doctorId: string | null;
  type: AppointmentType | null;
  date: string | null;
  healthcarePlanId?: string | null;
}

interface StoredDraft extends NewAppointmentDraft {
  version: typeof DRAFT_VERSION;
}

export const emptyNewAppointmentSelection: NewAppointmentSelection = {
  patient: null,
  doctor: null,
  type: null,
  date: null,
  slot: null,
  healthcarePlanId: null,
};

export type NewAppointmentSelectionAction =
  | { type: "patient"; patient: Patient | null }
  | { type: "doctor"; doctor: Member | null }
  | { type: "appointmentType"; appointmentType: AppointmentType | null }
  | { type: "date"; date: string | null }
  | { type: "slot"; slot: AvailabilitySlot | null }
  | { type: "healthcarePlan"; healthcarePlanId: string | null }
  | { type: "reset" };

function withoutDateAndSlot(
  selection: NewAppointmentSelection,
): NewAppointmentSelection {
  return { ...selection, date: null, slot: null };
}

export function selectionReducer(
  selection: NewAppointmentSelection,
  action: NewAppointmentSelectionAction,
): NewAppointmentSelection {
  switch (action.type) {
    case "patient":
      if (selection.patient?.id === action.patient?.id) {
        return { ...selection, patient: action.patient };
      }
      return { ...selection, patient: action.patient };
    case "doctor":
      if (selection.doctor?.userId === action.doctor?.userId) {
        return { ...selection, doctor: action.doctor };
      }
      return {
        ...withoutDateAndSlot(selection),
        doctor: action.doctor,
        healthcarePlanId: null,
      };
    case "appointmentType":
      if (selection.type === action.appointmentType) return selection;
      return { ...selection, type: action.appointmentType };
    case "date":
      if (selection.date === action.date) return selection;
      return { ...selection, date: action.date, slot: null };
    case "slot":
      return { ...selection, slot: action.slot };
    case "healthcarePlan":
      return { ...selection, healthcarePlanId: action.healthcarePlanId };
    case "reset":
      return emptyNewAppointmentSelection;
  }
}

export function canConfirm(selection: NewAppointmentSelection) {
  return Boolean(
    selection.patient &&
    selection.doctor &&
    selection.type &&
    selection.date &&
    selection.slot,
  );
}

function isSafeId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
  );
}

function isAppointmentType(value: unknown): value is AppointmentType | null {
  return value === null || value === "InPerson" || value === "Teleconsultation";
}

function isIsoDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const expectedKeys = ["date", "doctorId", "patientId", "type", "version"];
  const actualKeys = Object.keys(candidate).sort();
  const expectedKeysWithPlan = [...expectedKeys, "healthcarePlanId"].sort();
  const hasExpectedKeys =
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
  const hasExpectedKeysWithPlan =
    actualKeys.length === expectedKeysWithPlan.length &&
    actualKeys.every((key, index) => key === expectedKeysWithPlan[index]);
  return (
    (hasExpectedKeys || hasExpectedKeysWithPlan) &&
    candidate.version === DRAFT_VERSION &&
    isSafeId(candidate.patientId) &&
    isSafeId(candidate.doctorId) &&
    (!hasExpectedKeysWithPlan || isSafeId(candidate.healthcarePlanId)) &&
    isAppointmentType(candidate.type) &&
    isIsoDate(candidate.date)
  );
}

function getDraftKey(authScope: string) {
  const normalized = authScope.trim();
  if (!normalized || normalized.length > 512) return null;
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

export function saveDraft(
  selection: NewAppointmentSelection,
  authScope: string,
) {
  const draftKey = getDraftKey(authScope);
  if (!draftKey) return;
  const draft: StoredDraft = {
    version: DRAFT_VERSION,
    patientId: selection.patient?.id ?? null,
    doctorId: selection.doctor?.userId ?? null,
    type: selection.type,
    date: selection.date,
    ...(selection.healthcarePlanId
      ? { healthcarePlanId: selection.healthcarePlanId }
      : {}),
  };

  try {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {
    // O fluxo continua mesmo quando o armazenamento está indisponível.
  }
}

export function restoreDraft(authScope: string): NewAppointmentDraft | null {
  const draftKey = getDraftKey(authScope);
  if (!draftKey) return null;
  try {
    const serialized = sessionStorage.getItem(draftKey);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (!isStoredDraft(parsed)) {
      clearDraft(authScope);
      return null;
    }
    return {
      patientId: parsed.patientId,
      doctorId: parsed.doctorId,
      type: parsed.type,
      date: parsed.date,
      ...(parsed.healthcarePlanId
        ? { healthcarePlanId: parsed.healthcarePlanId }
        : {}),
    };
  } catch {
    clearDraft(authScope);
    return null;
  }
}

export function clearDraft(authScope: string) {
  const draftKey = getDraftKey(authScope);
  if (!draftKey) return;
  try {
    sessionStorage.removeItem(draftKey);
  } catch {
    // Não há ação de recuperação necessária para um rascunho efêmero.
  }
}
