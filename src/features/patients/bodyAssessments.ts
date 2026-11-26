import type { BodyAssessment, BodyMeasurementType } from "../../api/types";

export const measurementLabels: Record<BodyMeasurementType, string> = {
  Peso: "Peso",
  Altura: "Altura",
  Gordura: "Gordura",
  Braco: "Braço",
  Antebraco: "Antebraço",
  Cintura: "Cintura",
  Coxa: "Coxa",
  Panturrilha: "Panturrilha",
};

export const measurementUnits: Record<BodyMeasurementType, string> = {
  Peso: "kg",
  Altura: "cm",
  Gordura: "%",
  Braco: "cm",
  Antebraco: "cm",
  Cintura: "cm",
  Coxa: "cm",
  Panturrilha: "cm",
};

/** Espelha `BodyMeasurementRules` do backend: a faixa é da grandeza, não da coluna.
 * Serve para errar cedo no formulário; o servidor continua sendo quem decide. */
export const measurementRanges: Record<
  BodyMeasurementType,
  { min: number; max: number }
> = {
  Peso: { min: 1, max: 400 },
  Altura: { min: 30, max: 250 },
  Gordura: { min: 1, max: 75 },
  Braco: { min: 5, max: 300 },
  Antebraco: { min: 5, max: 300 },
  Cintura: { min: 5, max: 300 },
  Coxa: { min: 5, max: 300 },
  Panturrilha: { min: 5, max: 300 },
};

/** Ordem dos campos do formulário de nova avaliação. */
export const measurementInputOrder: BodyMeasurementType[] = [
  "Peso",
  "Altura",
  "Gordura",
  "Braco",
  "Antebraco",
  "Cintura",
  "Coxa",
  "Panturrilha",
];

/** A API já devolve o histórico ordenado; reordenar aqui mantém a tela correta se isso mudar. */
export function sortByDateDesc(assessments: BodyAssessment[]) {
  return [...assessments].sort((a, b) => b.assessedOn.localeCompare(a.assessedOn));
}

/** Da mais antiga para a mais recente — ordem do eixo X dos gráficos. */
export function sortByDateAsc(assessments: BodyAssessment[]) {
  return [...assessments].sort((a, b) => a.assessedOn.localeCompare(b.assessedOn));
}

export function latestAssessment(assessments: BodyAssessment[]) {
  return sortByDateDesc(assessments)[0] ?? null;
}

export function measurementValue(
  assessment: BodyAssessment | null,
  type: BodyMeasurementType,
): number | null {
  return assessment?.measurements.find((m) => m.type === type)?.value ?? null;
}

/** Altura mais recente do histórico — a mesma regra de carry-forward do backend. */
export function latestHeightCm(assessments: BodyAssessment[]): number | null {
  for (const assessment of sortByDateDesc(assessments)) {
    const height = measurementValue(assessment, "Altura");
    if (height !== null) return height;
  }
  return null;
}
