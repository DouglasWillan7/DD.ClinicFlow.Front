import { describe, expect, test } from "vitest";
import {
  clinicDraftFromSaved,
  countDoctorsByPlan,
  diffFromDefault,
  doctorSelectedIds,
  isClinicDirty,
  isDoctorDirty,
  normalizeClinicDraft,
  restoreClinicPlan,
} from "./healthcarePlansDraft";
import { clinicSummaryLabel, joinNames } from "./healthcarePlanLabels";

const clinic = { accepted: ["amil", "bradesco", "unimed"], defaults: ["amil", "unimed"] };

describe("rascunho da clínica", () => {
  test("padrão nunca passa dos convênios aceitos", () => {
    expect(
      normalizeClinicDraft({ accepted: ["amil"], defaults: ["amil", "unimed"] }),
    ).toEqual({ accepted: ["amil"], defaults: ["amil"] });
  });

  test("ordem não conta como alteração; aceitar ou tirar o padrão conta", () => {
    expect(
      isClinicDirty({ accepted: ["unimed", "amil", "bradesco"], defaults: ["unimed", "amil"] }, clinic),
    ).toBe(false);
    expect(isClinicDirty({ ...clinic, defaults: ["amil"] }, clinic)).toBe(true);
    expect(isClinicDirty({ ...clinic, accepted: ["amil", "unimed"] }, clinic)).toBe(true);
  });

  test("restaurar um convênio devolve aceito e padrão sem mexer nos outros", () => {
    const draft = { accepted: ["amil", "omint"], defaults: [] };
    expect(restoreClinicPlan(draft, clinic, "unimed")).toEqual({
      accepted: ["amil", "omint", "unimed"],
      defaults: ["unimed"],
    });
    expect(restoreClinicPlan(draft, clinic, "omint")).toEqual({
      accepted: ["amil"],
      defaults: [],
    });
  });

  test("resposta de API sem a lista de padrão vira padrão vazio", () => {
    expect(
      clinicDraftFromSaved({ healthcarePlanIds: ["amil"] } as never),
    ).toEqual({ accepted: ["amil"], defaults: [] });
  });
});

describe("rascunho do médico", () => {
  test("no padrão mostra os convênios da clínica; personalizado ignora o que não é aceito", () => {
    expect(doctorSelectedIds({ mode: "ClinicDefault", planIds: ["bradesco"] }, clinic))
      .toEqual(["amil", "unimed"]);
    expect(doctorSelectedIds({ mode: "Custom", planIds: ["bradesco", "omint"] }, clinic))
      .toEqual(["bradesco"]);
  });

  test("trocar de modo é alteração mesmo com a mesma lista", () => {
    const saved = { mode: "ClinicDefault" as const, planIds: ["amil", "unimed"] };
    expect(isDoctorDirty({ mode: "Custom", planIds: ["amil", "unimed"] }, saved, clinic)).toBe(true);
    expect(isDoctorDirty({ mode: "ClinicDefault", planIds: [] }, saved, clinic)).toBe(false);
  });

  test("diferença para o padrão separa o que entrou e o que saiu", () => {
    expect(diffFromDefault(["amil", "bradesco"], ["amil", "unimed"])).toEqual({
      added: ["bradesco"],
      removed: ["unimed"],
    });
  });
});

test("conta médicos por convênio sem contar repetição", () => {
  const counts = countDoctorsByPlan([["amil", "amil", "unimed"], ["amil"], []]);
  expect(counts.get("amil")).toBe(2);
  expect(counts.get("unimed")).toBe(1);
  expect(counts.get("bradesco")).toBeUndefined();
});

test("rótulos do resumo e da lista de nomes", () => {
  expect(clinicSummaryLabel(5, 3)).toBe("5 aceitos · 3 padrão");
  expect(clinicSummaryLabel(1, 0)).toBe("1 aceito · 0 padrão");
  expect(joinNames(["Ana"])).toBe("Ana");
  expect(joinNames(["Ana", "Bia"])).toBe("Ana e Bia");
  expect(joinNames(["Ana", "Bia", "Caio"])).toBe("Ana, Bia e Caio");
});
