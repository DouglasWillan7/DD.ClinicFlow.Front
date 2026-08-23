import { describe, expect, it } from "vitest";
import {
  emptyDraft,
  parseAssessmentDraft,
  todayIso,
  type AssessmentDraft,
} from "./assessmentForm";

const TODAY = "2026-08-09";

function draft(values: Partial<AssessmentDraft>): AssessmentDraft {
  return { ...emptyDraft, ...values };
}

describe("parseAssessmentDraft", () => {
  it("aceita vírgula e ponto como separador decimal", () => {
    const result = parseAssessmentDraft(
      TODAY,
      draft({ Peso: "84,1", Cintura: "84.5" }),
      TODAY,
    );

    expect(result).toEqual({
      ok: true,
      measurements: [
        { type: "Peso", value: 84.1 },
        { type: "Cintura", value: 84.5 },
      ],
    });
  });

  it("campo em branco não vira medida — não herda o valor anterior", () => {
    const result = parseAssessmentDraft(TODAY, draft({ Peso: "84,1" }), TODAY);

    expect(result.ok).toBe(true);
    expect(result.ok && result.measurements.map((m) => m.type)).toEqual(["Peso"]);
  });

  it("exige ao menos uma medida", () => {
    const result = parseAssessmentDraft(TODAY, emptyDraft, TODAY);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.summary).toBe("Preencha ao menos uma medida.");
  });

  it("recusa data no futuro e data vazia", () => {
    expect(
      parseAssessmentDraft("2026-08-10", draft({ Peso: "84" }), TODAY),
    ).toMatchObject({
      ok: false,
      errors: { assessedOn: "A data da avaliação não pode estar no futuro." },
    });
    expect(parseAssessmentDraft("", draft({ Peso: "84" }), TODAY)).toMatchObject({
      ok: false,
      errors: { assessedOn: "Informe a data da avaliação." },
    });
  });

  it("recusa texto que não é número", () => {
    const result = parseAssessmentDraft(TODAY, draft({ Peso: "oitenta" }), TODAY);

    expect(!result.ok && result.errors.fields.Peso).toBe("Informe um número.");
  });

  // A faixa é a da grandeza: 380 passa na balança e reprova no braço.
  it("aplica a faixa de sanidade de cada grandeza", () => {
    expect(parseAssessmentDraft(TODAY, draft({ Peso: "380" }), TODAY).ok).toBe(true);

    const arm = parseAssessmentDraft(TODAY, draft({ Braco: "380" }), TODAY);
    expect(!arm.ok && arm.errors.fields.Braco).toBe("Informe entre 5 e 300 cm.");

    const fat = parseAssessmentDraft(TODAY, draft({ Gordura: "90" }), TODAY);
    expect(!fat.ok && fat.errors.fields.Gordura).toBe("Informe entre 1 e 75 %.");
  });

  it("arredonda para uma casa decimal, como a coluna do banco", () => {
    const result = parseAssessmentDraft(TODAY, draft({ Peso: "84,16" }), TODAY);

    expect(result.ok && result.measurements[0].value).toBe(84.2);
  });
});

describe("todayIso", () => {
  it("usa a data local, não o UTC — a avaliação é registrada no fuso da clínica", () => {
    // 23h em São Paulo (UTC-3) já é o dia seguinte em UTC.
    expect(todayIso(new Date(2026, 7, 9, 23, 30))).toBe("2026-08-09");
  });
});
