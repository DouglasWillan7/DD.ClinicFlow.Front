import { describe, expect, it } from "vitest";
import {
  getSafeReturnTo,
  normalizeCpf,
  patientSchema,
  toPatientPayload,
  type PatientFormValue,
} from "./patientForm";

const valid: PatientFormValue = {
  name: "Marina Oliveira",
  phone: "+5511999990000",
  cpf: "52998224725",
  bloodType: "APositive",
  sexForClinicalUse: "Feminino",
  doctorUserId: "d-1",
  birthDate: "1980-03-10",
  notes: "",
};

describe("patient form contract", () => {
  it("rejeita CPF com dígitos verificadores inválidos", () => {
    expect(patientSchema.safeParse({ ...valid, cpf: "11111111111" }).success).toBe(false);
  });

  it("normaliza CPF e campos opcionais antes de enviar o payload", () => {
    expect(
      toPatientPayload({
        ...valid,
        name: "  Marina Oliveira ",
        cpf: "529.982.247-25",
        notes: "   ",
      }),
    ).toEqual({
      name: "Marina Oliveira",
      phone: "+5511999990000",
      cpf: "52998224725",
      bloodType: "APositive",
      sexForClinicalUse: "Feminino",
      doctorUserId: "d-1",
      birthDate: "1980-03-10",
      notes: null,
    });
  });

  it.each([
    ["Feminino", "Feminino"],
    ["Masculino", "Masculino"],
    [null, null],
  ] as const)("preserva o sexo clínico %s no payload", (value, expected) => {
    expect(toPatientPayload({ ...valid, sexForClinicalUse: value })).toMatchObject({
      sexForClinicalUse: expected,
    });
  });

  it("normaliza apenas os dígitos do CPF", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });

  it("aceita retorno somente para o novo agendamento", () => {
    expect(getSafeReturnTo("https://evil.example")).toBe("/app/pacientes");
    expect(getSafeReturnTo("/app/agenda/nova")).toBe("/app/agenda/nova");
  });

  it("preserva a query do retorno interno e rejeita rotas semelhantes", () => {
    expect(getSafeReturnTo("/app/agenda/nova?date=2026-08-10")).toBe(
      "/app/agenda/nova?date=2026-08-10",
    );
    expect(getSafeReturnTo("//evil.example/app/agenda/nova")).toBe(
      "/app/pacientes",
    );
    expect(getSafeReturnTo("/app/agenda/nova/falsa?date=2026-08-10")).toBe(
      "/app/pacientes",
    );
  });
});
