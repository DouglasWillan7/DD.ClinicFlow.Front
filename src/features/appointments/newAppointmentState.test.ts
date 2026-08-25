import { beforeEach, describe, expect, it } from "vitest";
import type {
  AvailabilitySlot,
  Member,
  Patient,
} from "../../api/types";
import {
  canConfirm,
  clearDraft,
  emptyNewAppointmentSelection,
  restoreDraft,
  saveDraft,
  selectionReducer,
  type NewAppointmentSelection,
} from "./newAppointmentState";

const patient: Patient = {
  id: "p-1",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  name: "Marina Oliveira",
  phone: "+5511999990000",
  email: "marina@example.test",
  medicalRecordNumber: 48213,
  bloodType: "APositive",
  sexForClinicalUse: null,
  birthDate: "1980-03-10",
  notes: null,
  isActive: true,
  createdAtUtc: "2026-08-01T12:00:00Z",
};

const doctor: Member = {
  userClinicId: "uc-d-1",
  userId: "d-1",
  displayName: "Dra. Helena Costa",
  role: "Doctor",
  isAdmin: false,
  specialty: "Cardiologia",
  defaultAppointmentDurationMinutes: 30,
};

const slot: AvailabilitySlot = {
  startUtc: "2026-08-10T12:00:00Z",
  endUtc: "2026-08-10T12:30:00Z",
  label: "09:00",
};
const scopeA = "clinic-a:user-a:Admin,Secretary";
const scopeB = "clinic-b:user-b:Secretary";

function draftKey(scope: string) {
  return `clinicflow.scoped.new-appointment-draft:${encodeURIComponent(scope)}`;
}

const selected: NewAppointmentSelection = {
  patient,
  doctor,
  type: "InPerson",
  date: "2026-08-10",
  slot,
};

describe("new appointment selection", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("limpa data e horário quando o médico muda", () => {
    const doctorChanged = selectionReducer(selected, {
      type: "doctor",
      doctor: { ...doctor, userId: "d-2" },
    });
    expect(doctorChanged.date).toBeNull();
    expect(doctorChanged.slot).toBeNull();
    expect(canConfirm(doctorChanged)).toBe(false);
  });

  it("preserva data e horário ao trocar paciente ou tipo de atendimento", () => {
    expect(
      selectionReducer(selected, {
        type: "patient",
        patient: { ...patient, id: "p-2" },
      }),
    ).toEqual({ ...selected, patient: { ...patient, id: "p-2" } });
    expect(
      selectionReducer(selected, {
        type: "appointmentType",
        appointmentType: "Teleconsultation",
      }),
    ).toEqual({ ...selected, type: "Teleconsultation" });
  });

  it("limpa somente o horário ao trocar a data e reinicia o fluxo", () => {
    expect(
      selectionReducer(selected, { type: "date", date: "2026-08-11" }),
    ).toEqual({ ...selected, date: "2026-08-11", slot: null });
    expect(selectionReducer(selected, { type: "reset" })).toEqual(
      emptyNewAppointmentSelection,
    );
  });

  it("só permite confirmar uma seleção completa e coerente", () => {
    expect(canConfirm(selected)).toBe(true);
    expect(canConfirm({ ...selected, patient: null })).toBe(false);
    expect(canConfirm({ ...selected, doctor: null })).toBe(false);
    expect(canConfirm({ ...selected, type: null })).toBe(false);
    expect(canConfirm({ ...selected, date: null })).toBe(false);
    expect(canConfirm({ ...selected, slot: null })).toBe(false);
  });

  it("persiste somente IDs, tipo e data, sem qualquer PII", () => {
    saveDraft(selected, scopeA);

    const serialized = sessionStorage.getItem(draftKey(scopeA));
    expect(serialized).not.toBeNull();
    expect(JSON.parse(serialized!)).toEqual({
      version: 1,
      patientId: "p-1",
      doctorId: "d-1",
      type: "InPerson",
      date: "2026-08-10",
    });
    expect(serialized).not.toContain(patient.name);
    expect(serialized).not.toContain(patient.document);
    expect(serialized).not.toContain(patient.birthDate!);
    expect(serialized).not.toContain(patient.phone);
    expect(serialized).not.toContain(doctor.displayName);

    expect(restoreDraft(scopeA)).toEqual({
      patientId: "p-1",
      doctorId: "d-1",
      type: "InPerson",
      date: "2026-08-10",
    });
  });

  it.each([
    "{invalid-json",
    JSON.stringify({ version: 2, patientId: "p-1" }),
    JSON.stringify({
      version: 1,
      patientId: " ",
      doctorId: "d-1",
      type: "InPerson",
      date: "2026-08-10",
    }),
    JSON.stringify({
      version: 1,
      patientId: "p-1",
      doctorId: "../../doctor",
      type: "InPerson",
      date: "2026-08-10",
    }),
    JSON.stringify({
      version: 1,
      patientId: "p-1",
      doctorId: "d-1",
      type: "Remote",
      date: "2026-08-10",
    }),
    JSON.stringify({
      version: 1,
      patientId: "p-1",
      doctorId: "d-1",
      type: "InPerson",
      date: "2026-02-30",
    }),
    JSON.stringify({
      version: 1,
      patientId: "p-1",
      doctorId: "d-1",
      type: "InPerson",
      date: "2026-08-10",
      patientName: "dado que não deve existir no draft",
    }),
  ])("descarta rascunho inválido sem lançar (%s)", (serialized) => {
    sessionStorage.setItem(draftKey(scopeA), serialized);

    expect(restoreDraft(scopeA)).toBeNull();
    expect(sessionStorage.getItem(draftKey(scopeA))).toBeNull();
  });

  it("não restaura o rascunho de outra identidade", () => {
    saveDraft(selected, scopeA);

    expect(restoreDraft(scopeB)).toBeNull();
    expect(restoreDraft(scopeA)).not.toBeNull();
  });

  it("remove explicitamente o rascunho", () => {
    saveDraft(selected, scopeA);
    clearDraft(scopeA);
    expect(restoreDraft(scopeA)).toBeNull();
  });
});
