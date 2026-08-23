import type {
  ClinicalExamHistoryPoint,
  ClinicalReferenceState,
} from "../../api/types";
import { referenceStateLabel } from "./exams/clinicalReport";
import { formatDateOnly } from "./patientFormatters";

const width = 240;
const height = 64;
const padding = 6;

export function ClinicalSparkline({
  label,
  points,
  unit,
  referenceState,
}: {
  label: string;
  points: ClinicalExamHistoryPoint[];
  unit?: string | null;
  referenceState?: ClinicalReferenceState;
}) {
  const numericPoints = points.flatMap((point, index) =>
    point.numericValue === null
      ? []
      : [{ index, value: point.numericValue, outOfRange: point.outOfRange }],
  );
  const values = numericPoints.map((point) => point.value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum;
  const denominator = Math.max(points.length - 1, 1);
  const coordinates = numericPoints.map((point) => ({
    x:
      points.length === 1
        ? width / 2
        : padding + (point.index / denominator) * (width - padding * 2),
    y:
      range === 0
        ? height / 2
        : padding +
          ((maximum - point.value) / range) * (height - padding * 2),
    outOfRange: point.outOfRange,
  }));
  const lastPoint = coordinates.at(-1);
  const accessibleSeries = points.length > 0
    ? points
        .map(
          (point) =>
            `${formatDateOnly(point.date)}, ${point.valueText}${unit ? ` ${unit}` : ""}`,
        )
        .join("; ")
    : "sem histórico";
  const accessibleState = referenceState
    ? `. Resultado mais recente: ${referenceStateLabel(referenceState)}`
    : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}. Série histórica: ${accessibleSeries}${accessibleState}`}
    >
      {coordinates.length > 1 ? (
        <polyline
          points={coordinates
            .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {lastPoint ? (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="4"
          fill={lastPoint.outOfRange ? "var(--color-danger)" : "var(--color-primary)"}
        />
      ) : null}
    </svg>
  );
}
