import { describe, expect, it } from "vitest";
import {
  formatBirthDate,
  formatMedicalRecord,
  getAge,
} from "./patientFormatters";

describe("patient formatters", () => {
  it("formata o prontuário para leitura em português", () => {
    expect(formatMedicalRecord(1234)).toBe("1.234");
  });

  it("formata nascimento sem deslocamento de fuso e calcula a idade", () => {
    expect(formatBirthDate("1980-03-10")).toBe("10/03/1980");
    expect(getAge("1980-03-10", new Date(2026, 2, 9))).toBe(45);
    expect(getAge("1980-03-10", new Date(2026, 2, 10))).toBe(46);
  });
});
