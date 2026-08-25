import { describe, expect, it } from "vitest";
import {
  getSafeReturnTo,
  patientSchema,
  toPatientPayload,
  type PatientFormValue,
} from "./patientForm";

const valid: PatientFormValue = {
  name: "Marina Oliveira",
  phone: "+5511999990000",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  email: "marina@example.test",
  bloodType: "APositive",
  sexForClinicalUse: "Feminino",
  birthDate: "1980-03-10",
  notes: "",
};

describe("patient form contract", () => {
  it("exige o tamanho de CPF brasileiro sem impor a regra a documentos estrangeiros", () => {
    expect(patientSchema.safeParse({ ...valid, document: "123" }).success).toBe(false);
    expect(patientSchema.safeParse({
      ...valid,
      documentCountryCode: "PT",
      documentType: "NIF",
      document: "123456789",
    }).success).toBe(true);
  });

  it("aceita E.164 internacional e rejeita telefone impossível", () => {
    expect(
      patientSchema.safeParse({ ...valid, phone: "+351912345678" }).success,
    ).toBe(true);

    const result = patientSchema.safeParse({ ...valid, phone: "+351123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Informe um WhatsApp válido para o país selecionado.",
      );
    }
  });

  it("normaliza campos opcionais sem acoplar o paciente a um médico", () => {
    expect(
      toPatientPayload({
        ...valid,
        name: "  Marina Oliveira ",
        document: " 529.982.247-25 ",
        email: "",
        notes: "   ",
      }),
    ).toEqual({
      name: "Marina Oliveira",
      phone: "+5511999990000",
      documentCountryCode: "BR",
      documentType: "CPF",
      document: "529.982.247-25",
      email: null,
      bloodType: "APositive",
      sexForClinicalUse: "Feminino",
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
