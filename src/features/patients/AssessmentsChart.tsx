import clsx from "clsx";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { BodyAssessment } from "../../api/types";
import {
  describeDelta,
  deltaTone,
  formatMetricValue,
  formatShortMonth,
  formatSignedDelta,
  type MetricSeries,
} from "./assessmentMetrics";
import { formatDateOnly } from "./patientFormatters";
import styles from "./PatientAssessmentsPage.module.css";

const PLOT = { width: 1040, height: 400, padX: 20, top: 18, bottom: 352 };
const GRIDLINES = [0, 1, 2, 3, 4];

function xAt(index: number, count: number) {
  if (count <= 1) return PLOT.width / 2;
  return PLOT.padX + (index * (PLOT.width - 2 * PLOT.padX)) / (count - 1);
}

/** Escala normalizada por série: o gráfico agrupado compara tendências, não grandezas. */
function yAt(value: number, min: number, max: number) {
  const span = max - min || 1;
  return PLOT.bottom - ((value - min) / span) * (PLOT.bottom - PLOT.top);
}

function linePath(series: MetricSeries, count: number) {
  return series.samples
    .map(
      (sample, position) =>
        `${position === 0 ? "M" : "L"}${xAt(sample.index, count).toFixed(1)},${yAt(
          sample.value,
          series.min,
          series.max,
        ).toFixed(1)}`,
    )
    .join(" ");
}

function metricStyle(color: string) {
  return { "--metric-color": color } as CSSProperties;
}

function DeltaTag({ series }: { series: MetricSeries }) {
  if (series.delta === null) {
    return <span className={styles.deltaEmpty}>primeira medição</span>;
  }

  const tone = deltaTone(series.metric, series.delta);
  return (
    <span className={styles.deltaLine}>
      <span className={clsx(styles.delta, styles[tone])}>
        {formatSignedDelta(series.delta)}
        <span className={styles.srOnly}> {describeDelta(tone)}</span>
      </span>{" "}
      vs anterior
    </span>
  );
}

/** Painel único com todas as séries ativas sobrepostas em escala normalizada. */
function GroupedChart({
  series,
  assessments,
}: {
  series: MetricSeries[];
  assessments: BodyAssessment[];
}) {
  const count = assessments.length;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(count - 1);
  const hitRefs = useRef<Array<SVGRectElement | null>>([]);
  // Uma avaliação nova encurta ou alonga o eixo; o tab stop é recortado na renderização
  // para nunca ficar apontando para uma coluna que sumiu.
  const tabStop = Math.max(0, Math.min(focusIndex, count - 1));

  function moveFocus(next: number) {
    const clamped = Math.max(0, Math.min(count - 1, next));
    setFocusIndex(clamped);
    setActiveIndex(clamped);
    hitRefs.current[clamped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<SVGRectElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(count - 1);
    } else if (event.key === "Escape") {
      setActiveIndex(null);
    }
  }

  const active = activeIndex === null ? null : assessments[activeIndex];
  const columnWidth =
    count <= 1 ? PLOT.width : (PLOT.width - 2 * PLOT.padX) / (count - 1);

  return (
    <figure className={styles.chartPanel}>
      <div className={styles.chartArea}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
          role="img"
          aria-label={`Evolução de ${series.map((s) => s.metric.label).join(", ")} em ${count} avaliações`}
        >
          {GRIDLINES.map((line) => {
            const y = PLOT.top + ((PLOT.bottom - PLOT.top) * line) / 4;
            return (
              <line
                key={line}
                className={styles.gridline}
                x1={PLOT.padX}
                y1={y}
                x2={PLOT.width - PLOT.padX}
                y2={y}
              />
            );
          })}

          {assessments.map((assessment, index) => (
            <text
              key={assessment.id}
              className={styles.axisLabel}
              x={xAt(index, count)}
              y={PLOT.height - 16}
              textAnchor="middle"
            >
              {formatShortMonth(assessment.assessedOn)}
            </text>
          ))}

          {activeIndex !== null ? (
            <line
              className={styles.marker}
              x1={xAt(activeIndex, count)}
              y1={PLOT.top}
              x2={xAt(activeIndex, count)}
              y2={PLOT.bottom}
            />
          ) : null}

          {series.map((item) => (
            <g key={item.metric.id} style={metricStyle(item.metric.color)}>
              <path className={styles.line} d={linePath(item, count)} />
              {item.samples.map((sample) => (
                <circle
                  key={sample.index}
                  className={styles.point}
                  cx={xAt(sample.index, count)}
                  cy={yAt(sample.value, item.min, item.max)}
                  r={3.2}
                />
              ))}
            </g>
          ))}

          {assessments.map((assessment, index) => (
            <rect
              key={assessment.id}
              ref={(node) => {
                hitRefs.current[index] = node;
              }}
              className={styles.hitArea}
              x={xAt(index, count) - columnWidth / 2}
              y={PLOT.top}
              width={columnWidth}
              height={PLOT.bottom - PLOT.top}
              tabIndex={index === tabStop ? 0 : -1}
              role="button"
              aria-label={`${formatDateOnly(assessment.assessedOn)}: ${series
                .map(
                  (item) =>
                    `${item.metric.label} ${formatMetricValue(item.metric.read(assessment))} ${item.metric.unit}`,
                )
                .join(", ")}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => {
                setFocusIndex(index);
                setActiveIndex(index);
              }}
              onBlur={() => setActiveIndex(null)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          ))}
        </svg>

        {active ? (
          <div
            className={styles.tooltip}
            style={{ left: `${(xAt(activeIndex ?? 0, count) / PLOT.width) * 100}%` }}
            aria-hidden="true"
          >
            <strong>{formatDateOnly(active.assessedOn)}</strong>
            <ul>
              {series.map((item) => (
                <li key={item.metric.id} style={metricStyle(item.metric.color)}>
                  <span className={styles.tooltipDot} />
                  {item.metric.label}
                  <b>
                    {formatMetricValue(item.metric.read(active))} {item.metric.unit}
                  </b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <figcaption className={styles.chartNote}>
        Escala normalizada por métrica (mínimo–máximo do período) para comparar
        tendências. Use a vista Tabela para os valores absolutos.
      </figcaption>
    </figure>
  );
}

function Sparkline({ series, count }: { series: MetricSeries; count: number }) {
  const width = 320;
  const height = 110;
  const padX = 4;
  const top = 8;
  const bottom = height - 8;

  const x = (index: number) =>
    count <= 1 ? width / 2 : padX + (index * (width - 2 * padX)) / (count - 1);
  const y = (value: number) => {
    const span = series.max - series.min || 1;
    return bottom - ((value - series.min) / span) * (bottom - top);
  };

  const path = series.samples
    .map(
      (sample, position) =>
        `${position === 0 ? "M" : "L"}${x(sample.index).toFixed(1)},${y(sample.value).toFixed(1)}`,
    )
    .join(" ");
  const first = series.samples[0];
  const last = series.samples.at(-1);

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {first && last ? (
        <path
          className={styles.sparkArea}
          d={`${path} L${x(last.index).toFixed(1)},${bottom + 8} L${x(first.index).toFixed(1)},${bottom + 8} Z`}
        />
      ) : null}
      <path className={styles.sparkLine} d={path} />
      {last ? (
        <circle className={styles.sparkPoint} cx={x(last.index)} cy={y(last.value)} r={4} />
      ) : null}
    </svg>
  );
}

/** Um card por métrica, cada um na sua escala real. */
function IndividualCharts({
  series,
  assessments,
}: {
  series: MetricSeries[];
  assessments: BodyAssessment[];
}) {
  const count = assessments.length;

  return (
    <ul className={styles.cardGrid}>
      {series.map((item) => (
        <li
          key={item.metric.id}
          className={styles.metricCard}
          style={metricStyle(item.metric.color)}
        >
          <div className={styles.metricCardHead}>
            <span className={styles.metricCardName}>{item.metric.label}</span>
            <span className={styles.metricCardValue}>
              {formatMetricValue(item.latest?.value ?? null)}
              <small>{item.metric.unit}</small>
            </span>
          </div>

          <DeltaTag series={item} />

          {item.samples.length > 0 ? (
            <>
              <Sparkline series={item} count={count} />
              <div className={styles.metricCardRange}>
                <span>{formatShortMonth(item.samples[0].assessedOn)}</span>
                <span>{formatShortMonth(item.samples.at(-1)!.assessedOn)}</span>
              </div>
            </>
          ) : (
            <p className={styles.metricCardEmpty}>
              Nenhuma medição de {item.metric.label.toLowerCase()} registrada.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AssessmentsChart({
  mode,
  series,
  assessments,
}: {
  mode: "agrupado" | "individual";
  series: MetricSeries[];
  assessments: BodyAssessment[];
}) {
  if (mode === "individual") {
    return <IndividualCharts series={series} assessments={assessments} />;
  }
  return <GroupedChart series={series} assessments={assessments} />;
}
