import { describe, expect, it } from "vitest";
import type { BodyAssessment, BodyMeasurementType } from "../../api/types";
import { latestAssessment, measurementValue } from "./bodyAssessments";

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
