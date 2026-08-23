import { describe, expect, test } from "vitest";
import { examRequestSchema } from "./examRequestForm";

describe("examRequestSchema", () => {
  test("exige nome e categoria clínica", () => {
    const result = examRequestSchema.safeParse({ name: "", category: "", scheduledOn: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        name: ["Informe o nome do exame."],
        category: ["Informe a categoria do exame."],
      });
    }
  });

  test("aceita data passada sem classificar como erro clínico", () => {
    expect(examRequestSchema.safeParse({
      name: "Hemograma",
      category: "Laboratório",
      scheduledOn: "2020-01-02",
    }).success).toBe(true);
  });

  test("transforma data vazia em ausência explícita", () => {
    expect(examRequestSchema.parse({
      name: "Hemograma",
      category: "Laboratório",
      scheduledOn: "",
    }).scheduledOn).toBeNull();
  });
});
