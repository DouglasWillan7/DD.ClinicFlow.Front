import { describe, expect, it } from "vitest";
import {
  formatBirthDate,
  formatBloodType,
  formatPatientDocument,
  formatMedicalRecord,
  getAge,
} from "./patientFormatters";

describe("patient formatters", () => {
  it("apresenta CPF brasileiro e preserva documentos internacionais", () => {
    expect(formatPatientDocument("BR", "CPF", "52998224725")).toBe(
      "529.982.247-25",
    );
    expect(formatPatientDocument("PT", "NIF", "123456789")).toBe("123456789");
  });

  it("traduz o tipo sanguíneo da API para o rótulo clínico", () => {
    expect(formatBloodType("ABNegative")).toBe("AB-");
  });

  it("formata o prontuário para leitura em português", () => {
    expect(formatMedicalRecord(1234)).toBe("1.234");
  });

  it("formata nascimento sem deslocamento de fuso e calcula a idade", () => {
    expect(formatBirthDate("1980-03-10")).toBe("10/03/1980");
    expect(getAge("1980-03-10", new Date(2026, 2, 9))).toBe(45);
    expect(getAge("1980-03-10", new Date(2026, 2, 10))).toBe(46);
  });
});
