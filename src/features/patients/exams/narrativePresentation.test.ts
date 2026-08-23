import { describe, expect, test } from "vitest";
import { isClinicalNarrativeTitle } from "./narrativePresentation";

describe("isClinicalNarrativeTitle", () => {
  test.each([
    "Conclusão",
    "CONCLUSAO DO EXAME",
    "Impressão diagnóstica",
    "Interpretação clínica",
    "Comentário interpretativo",
    "Observação clínica",
    "Limitação técnica",
    "Limitações técnicas do exame",
  ])("mantém %s na revisão clínica", (title) => {
    expect(isClinicalNarrativeTitle(title)).toBe(true);
  });

  test.each([
    "Notas do laboratório",
    "Observações",
    "Método",
    "Referências bibliográficas",
    "Nota sobre a conclusão do laboratório",
    "Texto adicional",
    "",
  ])("trata %s como conteúdo adicional", (title) => {
    expect(isClinicalNarrativeTitle(title)).toBe(false);
  });
});
