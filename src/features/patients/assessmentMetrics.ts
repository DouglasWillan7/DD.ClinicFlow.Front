import type { BodyAssessment, BodyMeasurementType } from "../../api/types";
import {
  measurementLabels,
  measurementUnits,
  measurementValue,
  sortByDateAsc,
} from "./bodyAssessments";

export type MetricId =
  | "peso"
  | "imc"
  | "gordura"
  | "braco"
  | "antebraco"
  | "cintura"
  | "coxa"
  | "panturrilha";

export interface AssessmentMetric {
  id: MetricId;
  label: string;
  unit: string;
  /** 1 = subir é evolução favorável; -1 = descer é favorável. Define a cor da variação. */
  favorable: 1 | -1;
  /** Cor da série no gráfico. Nunca é a única pista: a variação leva ícone e texto. */
  color: string;
  read(assessment: BodyAssessment): number | null;
}

function fromMeasurement(
  id: MetricId,
  type: BodyMeasurementType,
  favorable: 1 | -1,
  color: string,
): AssessmentMetric {
  return {
    id,
    label: measurementLabels[type],
    unit: measurementUnits[type],
    favorable,
    color,
    read: (assessment) => measurementValue(assessment, type),
  };
}

/**
 * As oito colunas do handoff, nesta ordem. Altura fica de fora de propósito: ela é
 * insumo do IMC, praticamente constante, e viraria uma coluna morta na tabela.
 *
 * Cores são as do handoff. Elas se repetem no vermelho e no verde que a variação usa,
 * então a variação nunca comunica só por cor — carrega seta e texto (ver `deltaTone`).
 */
export const assessmentMetrics: AssessmentMetric[] = [
  fromMeasurement("peso", "Peso", -1, "#3b5bfe"),
  {
    id: "imc",
    label: "IMC",
    unit: "kg/m²",
    favorable: -1,
    color: "#e8404a",
    // Derivado no backend a partir de peso e altura, nunca digitado.
    read: (assessment) => assessment.bmi,
  },
  fromMeasurement("gordura", "Gordura", -1, "#f0a12e"),
  fromMeasurement("braco", "Braco", 1, "#35b7cd"),
  fromMeasurement("antebraco", "Antebraco", 1, "#2f9e57"),
  fromMeasurement("cintura", "Cintura", -1, "#8b5cf6"),
  fromMeasurement("coxa", "Coxa", 1, "#ec4899"),
  fromMeasurement("panturrilha", "Panturrilha", 1, "#64748b"),
];

export type DeltaTone = "good" | "bad" | "flat";

export function deltaTone(metric: AssessmentMetric, delta: number): DeltaTone {
  if (delta === 0) return "flat";
  return delta * metric.favorable > 0 ? "good" : "bad";
}

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Uma casa decimal sempre, para as colunas alinharem com `tabular-nums`. */
export function formatMetricValue(value: number | null) {
  return value === null ? "—" : numberFormatter.format(value);
}

export function formatSignedDelta(delta: number) {
  if (delta === 0) return "0,0";
  return `${delta > 0 ? "+" : "−"}${numberFormatter.format(Math.abs(delta))}`;
}

const deltaDescriptions: Record<DeltaTone, string> = {
  good: "evolução favorável",
  bad: "evolução desfavorável",
  flat: "sem variação",
};

export function describeDelta(tone: DeltaTone) {
  return deltaDescriptions[tone];
}

export interface MetricCell {
  value: number | null;
  /** Diferença para a avaliação anterior que registrou a mesma métrica. */
  delta: number | null;
}

export interface AssessmentRow {
  assessment: BodyAssessment;
  /** Posição na ordem cronológica: 1 é a avaliação mais antiga. */
  number: number;
  cells: Record<MetricId, MetricCell>;
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

/**
 * Linhas da tabela, da mais recente para a mais antiga. A variação compara com a
 * avaliação anterior **que mediu aquela métrica** — pular uma coleta não inventa
 * nem apaga a evolução.
 */
export function buildRows(assessments: BodyAssessment[]): AssessmentRow[] {
  const chronological = sortByDateAsc(assessments);
  const previousValue = new Map<MetricId, number>();

  const rows = chronological.map((assessment, index) => {
    const cells = {} as Record<MetricId, MetricCell>;

    for (const metric of assessmentMetrics) {
      const value = metric.read(assessment);
      const previous = previousValue.get(metric.id);
      cells[metric.id] = {
        value,
        delta:
          value === null || previous === undefined ? null : round1(value - previous),
      };
      if (value !== null) previousValue.set(metric.id, value);
    }

    return { assessment, number: index + 1, cells };
  });

  return rows.reverse();
}

export interface MetricSample {
  /** Índice da avaliação na ordem cronológica — posição no eixo X. */
  index: number;
  value: number;
  assessedOn: string;
}

export interface MetricSeries {
  metric: AssessmentMetric;
  /** Só as avaliações que mediram a métrica; a linha atravessa as lacunas. */
  samples: MetricSample[];
  min: number;
  max: number;
  latest: MetricSample | null;
  /** Variação entre as duas últimas amostras da própria métrica. */
  delta: number | null;
}

export function buildSeries(assessments: BodyAssessment[]): MetricSeries[] {
  const chronological = sortByDateAsc(assessments);

  return assessmentMetrics.map((metric) => {
    const samples: MetricSample[] = [];
    chronological.forEach((assessment, index) => {
      const value = metric.read(assessment);
      if (value !== null) {
        samples.push({ index, value, assessedOn: assessment.assessedOn });
      }
    });

    const values = samples.map((sample) => sample.value);
    const latest = samples.at(-1) ?? null;
    const previous = samples.at(-2) ?? null;

    return {
      metric,
      samples,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      latest,
      delta:
        latest && previous ? round1(latest.value - previous.value) : null,
    };
  });
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** "fev 25" — rótulo curto do eixo X e do período no subtítulo.
 * Montado por partes porque o pt-BR formata o conjunto como "fev. de 25". */
export function formatShortMonth(assessedOn: string) {
  const parsed = Date.parse(`${assessedOn}T00:00:00Z`);
  if (Number.isNaN(parsed)) return assessedOn;

  const parts = monthFormatter.formatToParts(parsed);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${month.replace(".", "").toLowerCase()} ${year}`;
}

export function formatPeriod(assessments: BodyAssessment[]) {
  const chronological = sortByDateAsc(assessments);
  const first = chronological[0];
  const last = chronological.at(-1);
  if (!first || !last) return null;

  const start = formatShortMonth(first.assessedOn);
  const end = formatShortMonth(last.assessedOn);
  return start === end ? start : `${start} – ${end}`;
}
