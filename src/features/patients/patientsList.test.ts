import { describe, expect, test } from "vitest";
import type { PatientListItem } from "../../api/types";
import {
  countBySituation,
  filterPatients,
  matchesSearch,
} from "./patientsList";

let record = 1000;
function makePatient(overrides: Partial<PatientListItem>): PatientListItem {
  record += 1;
  return {
    id: crypto.randomUUID(),
    name: "Paciente Teste",
    phone: "+5511999990000",
    cpf: "52998224725",
    medicalRecordNumber: record,
    bloodType: null,
    sexForClinicalUse: null,
    birthDate: null,
    notes: null,
    doctorUserId: "d-1",
    isActive: true,
    whatsappConsentAtUtc: null,
    createdAtUtc: "2026-08-01T12:00:00Z",
    lastAppointmentUtc: null,
    nextAppointmentUtc: null,
    nextAppointmentType: null,
    situation: "EmAcompanhamento",
    ...overrides,
  };
}

describe("matchesSearch", () => {
  test("ignora acentos no nome", () => {
    const patient = makePatient({ name: "Rita de Cássia Alves" });
    expect(matchesSearch(patient, "cassia")).toBe(true);
    expect(matchesSearch(patient, "CÁSSIA")).toBe(true);
    expect(matchesSearch(patient, "carlos")).toBe(false);
  });

  test("busca por CPF exige 3+ dígitos e ignora máscara", () => {
    const patient = makePatient({ cpf: "52998224725" });
    expect(matchesSearch(patient, "529.982")).toBe(true);
    expect(matchesSearch(patient, "52")).toBe(false);
  });

  test("busca por telefone e prontuário", () => {
    const patient = makePatient({
      phone: "+5511988887777",
      medicalRecordNumber: 48213,
    });
    expect(matchesSearch(patient, "98888")).toBe(true);
    expect(matchesSearch(patient, "48213")).toBe(true);
  });
});

describe("filterPatients", () => {
  const lista = [
    makePatient({ name: "Zilda Prado" }),
    makePatient({ name: "Álvaro Souza", situation: "ExamePendente" }),
    makePatient({ name: "Bruna Lima", situation: "Inativo", isActive: false }),
  ];

  test("combina filtro de situação com busca e ordena em pt-BR", () => {
    const todos = filterPatients(lista, "todos", "");
    expect(todos.map((p) => p.name)).toEqual([
      "Álvaro Souza",
      "Bruna Lima",
      "Zilda Prado",
    ]);

    const pendentes = filterPatients(lista, "ExamePendente", "");
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].name).toBe("Álvaro Souza");

    expect(filterPatients(lista, "ExamePendente", "zilda")).toHaveLength(0);
  });

  test("conta pacientes por situação", () => {
    expect(countBySituation(lista)).toEqual({
      EmAcompanhamento: 1,
      NovoPaciente: 0,
      ExamePendente: 1,
      Inativo: 1,
    });
  });
});
