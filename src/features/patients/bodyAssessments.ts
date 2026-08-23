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

/** Subconjunto que tem posição fixa sobre a ilustração — peso, altura e gordura não têm. */
export type FigureCircumference =
  | "Braco"
  | "Antebraco"
  | "Cintura"
  | "Coxa"
  | "Panturrilha";

/** Circunferências desenhadas sobre a figura, na ordem de leitura de cima para baixo. */
export const figureCircumferences: FigureCircumference[] = [
  "Braco",
  "Antebraco",
  "Cintura",
  "Coxa",
  "Panturrilha",
];

export interface MeasurementAnchor {
  /** Ponto sobre a figura, em % do box da imagem. */
  point: { x: number; y: number };
  /** Âncora do card, em % do box da imagem. */
  card: { x: number; y: number };
  side: "left" | "right";
}

/**
 * Posições do handoff (design_handoff_detalhes_paciente/README.md). Percentuais do
 * box da figura, que coincide com o PNG, então os pontos escalam junto com o corpo.
 *
 * Os X dos cards da direita saíram de 70/70/68 para 80: o card tem largura fixa em
 * px enquanto a figura escala com a viewport, e a 70% ele encobria os braços quando
 * a figura encolhe. A 80% ficam fora da silhueta (que vai de ~22% a ~78%) em
 * qualquer tamanho, usando a folga lateral da coluna.
 */
export const measurementAnchors: Record<FigureCircumference, MeasurementAnchor> = {
  Braco: { point: { x: 34, y: 28 }, card: { x: 18, y: 22 }, side: "left" },
  Antebraco: { point: { x: 27, y: 38 }, card: { x: 14, y: 46 }, side: "left" },
  Cintura: { point: { x: 52, y: 42 }, card: { x: 80, y: 30 }, side: "right" },
  Coxa: { point: { x: 55, y: 55 }, card: { x: 80, y: 56 }, side: "right" },
  Panturrilha: { point: { x: 57, y: 71 }, card: { x: 80, y: 78 }, side: "right" },
};

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

const cmFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatCm(value: number | null) {
  return value === null ? "—" : `${cmFormatter.format(value)} cm`;
}

export interface MeasurementReading {
  type: FigureCircumference;
  label: string;
  valueCm: number | null;
  /** Diferença para a avaliação anterior; null quando não há base de comparação. */
  deltaCm: number | null;
}

/**
 * Uma linha por circunferência, sempre nas cinco posições da figura — tipos ainda
 * não medidos aparecem com valor nulo em vez de sumirem da tela.
 */
export function readingsFor(assessments: BodyAssessment[]): MeasurementReading[] {
  const sorted = sortByDateDesc(assessments);
  const current = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  return figureCircumferences.map((type) => {
    const valueCm = measurementValue(current, type);
    const previousValue = measurementValue(previous, type);
    return {
      type,
      label: measurementLabels[type],
      valueCm,
      deltaCm:
        valueCm === null || previousValue === null
          ? null
          : Number((valueCm - previousValue).toFixed(1)),
    };
  });
}

export function formatDelta(deltaCm: number | null) {
  if (deltaCm === null) return null;
  if (deltaCm === 0) return "sem variação";
  const sign = deltaCm > 0 ? "+" : "−";
  return `${sign}${cmFormatter.format(Math.abs(deltaCm))} cm`;
}
