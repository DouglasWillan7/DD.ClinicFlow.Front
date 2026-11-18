import { describe, expect, test } from "vitest";
import {
  prescriptionContentMaxLength,
  prescriptionLengthHint,
  prescriptionSchema,
} from "./prescriptionForm";

describe("prescriptionSchema", () => {
  test("exige texto: vazio ou só espaços e quebras não emitem", () => {
    for (const content of ["", "   ", "\n\n  \t"]) {
      const result = prescriptionSchema.safeParse({ content });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors).toEqual({
          content: ["Escreva o texto da receita."],
        });
      }
    }
  });

  test("preserva as quebras de linha internas e apara só as bordas", () => {
    const content = "\n  Amoxicilina 500 mg\nTomar 1 cápsula a cada 8 horas.\n\nUso oral.  \n";

    expect(prescriptionSchema.parse({ content }).content).toBe(
      "Amoxicilina 500 mg\nTomar 1 cápsula a cada 8 horas.\n\nUso oral.",
    );
  });

  test("aceita exatamente 5.000 caracteres e recusa um a mais", () => {
    expect(prescriptionContentMaxLength).toBe(5000);
    expect(prescriptionSchema.safeParse({ content: "a".repeat(5000) }).success).toBe(true);

    const result = prescriptionSchema.safeParse({ content: "a".repeat(5001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.content).toEqual([
        "A receita pode ter até 5.000 caracteres.",
      ]);
    }
  });

  test("o limite vale para o texto aparado: espaços nas bordas não contam", () => {
    expect(
      prescriptionSchema.safeParse({ content: `  ${"a".repeat(5000)}\n\n` }).success,
    ).toBe(true);
  });
});

test("contador do campo no formato pt-BR", () => {
  expect(prescriptionLengthHint("")).toBe("0 de 5.000 caracteres");
  expect(prescriptionLengthHint("a".repeat(1234))).toBe("1.234 de 5.000 caracteres");
});
