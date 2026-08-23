import { describe, expect, it } from "vitest";
import type { BodyAssessment, BodyMeasurementType } from "../../api/types";
import {
  formatCm,
  formatDelta,
  latestAssessment,
  measurementAnchors,
  figureCircumferences,
  measurementValue,
  readingsFor,
} from "./bodyAssessments";

function assessment(
  assessedOn: string,
  measurements: Array<[BodyMeasurementType, number]>,
): BodyAssessment {
  return {
    id: assessedOn,
    patientId: "p1",
    assessedOn,
    createdAtUtc: `${assessedOn}T12:00:00Z`,
    measurements: measurements.map(([type, value]) => ({ type, value })),
    bmi: null,
  };
}

describe("latestAssessment", () => {
  it("escolhe a data mais recente mesmo fora de ordem", () => {
    const list = [
      assessment("2025-11-12", [["Braco", 37]]),
      assessment("2026-01-21", [["Braco", 38]]),
      assessment("2025-09-03", [["Braco", 36]]),
    ];

    expect(latestAssessment(list)?.assessedOn).toBe("2026-01-21");
  });

  it("devolve null sem avaliações", () => {
    expect(latestAssessment([])).toBeNull();
  });
});

describe("measurementValue", () => {
  it("lê o tipo pedido e ignora os demais", () => {
    const current = assessment("2026-01-21", [
      ["Braco", 38],
      ["Cintura", 84.5],
    ]);

    expect(measurementValue(current, "Cintura")).toBe(84.5);
    expect(measurementValue(current, "Coxa")).toBeNull();
    expect(measurementValue(null, "Braco")).toBeNull();
  });
});

describe("readingsFor", () => {
  it("mantém as cinco posições da figura mesmo com medidas ausentes", () => {
    const readings = readingsFor([assessment("2026-01-21", [["Braco", 38]])]);

    expect(readings.map((r) => r.type)).toEqual(figureCircumferences);
    expect(readings.find((r) => r.type === "Braco")?.valueCm).toBe(38);
    expect(readings.find((r) => r.type === "Coxa")?.valueCm).toBeNull();
  });

  it("calcula a variação contra a avaliação anterior", () => {
    const readings = readingsFor([
      assessment("2026-01-21", [
        ["Braco", 38],
        ["Cintura", 84],
      ]),
      assessment("2025-11-12", [
        ["Braco", 37],
        ["Cintura", 86],
      ]),
    ]);

    expect(readings.find((r) => r.type === "Braco")?.deltaCm).toBe(1);
    expect(readings.find((r) => r.type === "Cintura")?.deltaCm).toBe(-2);
  });

  it("não inventa variação quando falta base de comparação", () => {
    const readings = readingsFor([
      assessment("2026-01-21", [
        ["Braco", 38],
        ["Coxa", 56],
      ]),
      assessment("2025-11-12", [["Braco", 37]]),
    ]);

    expect(readings.find((r) => r.type === "Coxa")?.deltaCm).toBeNull();
  });

  it("sem avaliação nenhuma, devolve as cinco linhas vazias", () => {
    const readings = readingsFor([]);

    expect(readings).toHaveLength(5);
    expect(readings.every((r) => r.valueCm === null && r.deltaCm === null)).toBe(true);
  });
});

describe("formatação", () => {
  it("usa vírgula decimal e traço para ausente", () => {
    expect(formatCm(84.5)).toBe("84,5 cm");
    expect(formatCm(38)).toBe("38 cm");
    expect(formatCm(null)).toBe("—");
  });

  it("descreve a variação com sinal legível", () => {
    expect(formatDelta(1.5)).toBe("+1,5 cm");
    expect(formatDelta(-2)).toBe("−2 cm");
    expect(formatDelta(0)).toBe("sem variação");
    expect(formatDelta(null)).toBeNull();
  });
});

describe("measurementAnchors", () => {
  it("cobre os cinco tipos dentro do box da figura", () => {
    expect(Object.keys(measurementAnchors).sort()).toEqual([...figureCircumferences].sort());
    for (const anchor of Object.values(measurementAnchors)) {
      for (const value of [anchor.point.x, anchor.point.y, anchor.card.x, anchor.card.y]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});
