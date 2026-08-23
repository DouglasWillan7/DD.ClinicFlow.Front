import { describe, expect, it } from "vitest";
import type { BodyAssessment, BodyMeasurementType } from "../../api/types";
import {
  assessmentMetrics,
  buildRows,
  buildSeries,
  deltaTone,
  formatMetricValue,
  formatPeriod,
  formatShortMonth,
  formatSignedDelta,
} from "./assessmentMetrics";

function assessment(
  assessedOn: string,
  measurements: Array<[BodyMeasurementType, number]>,
  bmi: number | null = null,
): BodyAssessment {
  return {
    id: assessedOn,
    patientId: "p1",
    assessedOn,
    createdAtUtc: `${assessedOn}T12:00:00Z`,
    measurements: measurements.map(([type, value]) => ({ type, value })),
    bmi,
  };
}

const metricById = Object.fromEntries(
  assessmentMetrics.map((metric) => [metric.id, metric]),
);

describe("catálogo de métricas", () => {
  it("tem as oito colunas do handoff e deixa altura de fora", () => {
    expect(assessmentMetrics.map((m) => m.id)).toEqual([
      "peso",
      "imc",
      "gordura",
      "braco",
      "antebraco",
      "cintura",
      "coxa",
      "panturrilha",
    ]);
  });

  it("lê o IMC do campo derivado pelo backend, não de uma medida", () => {
    const withBmi = assessment("2026-01-21", [["Peso", 84.1]], 26.5);

    expect(metricById.imc.read(withBmi)).toBe(26.5);
    expect(metricById.imc.read(assessment("2026-01-21", [["Peso", 84.1]]))).toBeNull();
  });
});

describe("deltaTone", () => {
  it("inverte o sinal favorável conforme a métrica", () => {
    expect(deltaTone(metricById.peso, -0.8)).toBe("good");
    expect(deltaTone(metricById.peso, 0.8)).toBe("bad");
    expect(deltaTone(metricById.braco, 0.1)).toBe("good");
    expect(deltaTone(metricById.braco, -0.1)).toBe("bad");
    expect(deltaTone(metricById.cintura, 0)).toBe("flat");
  });
});

describe("buildRows", () => {
  const list = [
    assessment("2026-01-21", [["Peso", 84.1]], 26.5),
    assessment("2025-11-12", [["Peso", 84.9]], 26.7),
    assessment("2025-09-03", [["Peso", 85.8]], 27),
  ];

  it("ordena da mais recente para a mais antiga e numera do início do histórico", () => {
    const rows = buildRows(list);

    expect(rows.map((row) => row.assessment.assessedOn)).toEqual([
      "2026-01-21",
      "2025-11-12",
      "2025-09-03",
    ]);
    expect(rows.map((row) => row.number)).toEqual([3, 2, 1]);
  });

  it("calcula a variação contra a avaliação anterior", () => {
    const rows = buildRows(list);

    expect(rows[0].cells.peso.delta).toBe(-0.8);
    expect(rows[1].cells.peso.delta).toBe(-0.9);
    expect(rows[2].cells.peso.delta).toBeNull();
  });

  it("compara com a última avaliação que mediu a métrica, pulando as lacunas", () => {
    const rows = buildRows([
      assessment("2026-01-21", [["Cintura", 84]]),
      assessment("2025-11-12", [["Peso", 84.9]]),
      assessment("2025-09-03", [["Cintura", 86]]),
    ]);

    expect(rows[0].cells.cintura.delta).toBe(-2);
    expect(rows[1].cells.cintura.value).toBeNull();
    expect(rows[1].cells.cintura.delta).toBeNull();
  });

  it("não inventa variação na primeira medição de cada métrica", () => {
    const rows = buildRows([
      assessment("2026-01-21", [
        ["Peso", 84.1],
        ["Coxa", 56],
      ]),
      assessment("2025-11-12", [["Peso", 84.9]]),
    ]);

    expect(rows[0].cells.peso.delta).toBe(-0.8);
    expect(rows[0].cells.coxa.delta).toBeNull();
  });
});

describe("buildSeries", () => {
  it("guarda o índice cronológico de cada amostra, ignorando as lacunas", () => {
    const series = buildSeries([
      assessment("2025-09-03", [["Peso", 85.8]]),
      assessment("2025-11-12", []),
      assessment("2026-01-21", [["Peso", 84.1]]),
    ]);
    const peso = series.find((item) => item.metric.id === "peso")!;

    expect(peso.samples.map((sample) => sample.index)).toEqual([0, 2]);
    expect(peso.min).toBe(84.1);
    expect(peso.max).toBe(85.8);
    expect(peso.latest?.value).toBe(84.1);
    expect(peso.delta).toBe(-1.7);
  });

  it("métrica sem nenhuma medição fica vazia em vez de sumir", () => {
    const series = buildSeries([assessment("2026-01-21", [["Peso", 84.1]])]);
    const coxa = series.find((item) => item.metric.id === "coxa")!;

    expect(coxa.samples).toEqual([]);
    expect(coxa.latest).toBeNull();
    expect(coxa.delta).toBeNull();
  });
});

describe("formatação", () => {
  it("mostra sempre uma casa decimal, com vírgula", () => {
    expect(formatMetricValue(84)).toBe("84,0");
    expect(formatMetricValue(26.53)).toBe("26,5");
    expect(formatMetricValue(null)).toBe("—");
  });

  it("assina a variação com o menos tipográfico", () => {
    expect(formatSignedDelta(0.1)).toBe("+0,1");
    expect(formatSignedDelta(-0.8)).toBe("−0,8");
    expect(formatSignedDelta(0)).toBe("0,0");
  });

  it("resume o período em mês e ano curtos", () => {
    expect(formatShortMonth("2025-02-10")).toBe("fev 25");
    expect(
      formatPeriod([
        assessment("2026-07-28", []),
        assessment("2025-02-10", []),
      ]),
    ).toBe("fev 25 – jul 26");
  });

  it("período de uma avaliação só não vira intervalo", () => {
    expect(formatPeriod([assessment("2026-07-28", [])])).toBe("jul 26");
    expect(formatPeriod([])).toBeNull();
  });
});
