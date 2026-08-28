import { describe, expect, test } from "vitest";
import type { PatientListItem } from "../../api/types";
import {
  countBySituation,
  filterPatients,
  matchesSearch,
} from "./patientsList";

function makePatient(overrides: Partial<PatientListItem>): PatientListItem {
  return {
    id: crypto.randomUUID(),
    name: "Paciente Teste",
    phone: "+5511999990000",
    birthDate: null,
    isActive: true,
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

  test("busca por telefone exige ao menos três dígitos", () => {
    const patient = makePatient({
      phone: "+5511988887777",
    });
    expect(matchesSearch(patient, "98888")).toBe(true);
    expect(matchesSearch(patient, "98")).toBe(false);
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
