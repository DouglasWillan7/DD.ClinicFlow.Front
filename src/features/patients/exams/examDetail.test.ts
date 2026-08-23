import { describe, expect, test } from "vitest";
import {
  confidencePresentation,
  formatExamDate,
  formatExamResultValue,
  processingAttemptsLabel,
} from "./examDetail";

describe("exam detail presentation", () => {
  test("marca confiança abaixo de 93% como prioridade", () => {
    expect(confidencePresentation(0.929)).toEqual({ label: "92,9%", isLow: true });
  });

  test("não marca o limiar exato de 93% como baixo", () => {
    expect(confidencePresentation(0.93)).toEqual({ label: "93%", isLow: false });
  });

  test("não inventa percentual para confiança ausente", () => {
    expect(confidencePresentation(null)).toEqual({
      label: "Confiança não informada",
      isLow: false,
    });
  });

  test("formata resultado numérico, textual e ausente sem perder unidade", () => {
    expect(formatExamResultValue({ numericValue: 4.7, textValue: null, unit: "mg/dL" })).toBe("4,7 mg/dL");
    expect(formatExamResultValue({ numericValue: null, textValue: "Negativo", unit: null })).toBe("Negativo");
    expect(formatExamResultValue({ numericValue: null, textValue: null, unit: "mg/dL" })).toBe("Não informado");
  });

  test("formata datas clínicas e mantém fallback seguro", () => {
    expect(formatExamDate("2026-08-15")).toBe("15/08/2026");
    expect(formatExamDate("data-inválida")).toBe("Não informada");
    expect(formatExamDate(null)).toBe("Não informada");
  });

  test("explica tentativas restantes no singular, plural e esgotamento", () => {
    expect(processingAttemptsLabel(2)).toBe("2 tentativas restantes");
    expect(processingAttemptsLabel(1)).toBe("1 tentativa restante");
    expect(processingAttemptsLabel(0)).toBe("Nenhuma tentativa restante. Envie outro PDF para continuar.");
  });
});
