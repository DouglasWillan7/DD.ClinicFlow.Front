import clsx from "clsx";
import anatomyBody from "../../assets/anatomy-body.png";
import {
  formatCm,
  measurementAnchors,
  type MeasurementReading,
} from "./bodyAssessments";
import styles from "./PatientDetailPage.module.css";

/**
 * Figura do handoff: pontos e cards ancorados em % do box da imagem, então tudo
 * escala junto. Ilustração e conectores são decorativos; os cards ficam na ordem
 * de leitura de cima para baixo e são a fonte textual das medidas — abaixo de
 * 960px a imagem sai e eles viram uma lista simples (ver o CSS).
 */
export function BodyFigure({
  readings,
  assessedOnLabel,
}: {
  readings: MeasurementReading[];
  assessedOnLabel: string | null;
}) {
  return (
    <figure
      className={styles.figure}
      role="group"
      aria-label={
        assessedOnLabel
          ? `Circunferências medidas em ${assessedOnLabel}`
          : "Circunferências ainda não medidas"
      }
    >
      <img className={styles.figureImage} src={anatomyBody} alt="" />

      <svg
        className={styles.connectors}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
        aria-hidden="true"
      >
        {readings.map(({ type }) => {
          const { point, card } = measurementAnchors[type];
          return (
            <line
              key={type}
              x1={point.x}
              y1={point.y}
              x2={card.x}
              y2={card.y}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {readings.map(({ type, label, valueCm }) => {
        const { point, card, side } = measurementAnchors[type];
        return (
          <div key={type}>
            <span
              className={styles.figurePoint}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-hidden="true"
            />
            <div
              className={clsx(
                styles.callout,
                side === "left" && styles.calloutLeft,
                valueCm === null && styles.calloutEmpty,
              )}
              style={{ left: `${card.x}%`, top: `${card.y}%` }}
            >
              <span className={styles.calloutLabel}>{label}</span>
              <strong className={styles.calloutValue}>{formatCm(valueCm)}</strong>
              <span className={styles.calloutDate}>
                {valueCm === null ? "Sem registro" : assessedOnLabel}
              </span>
            </div>
          </div>
        );
      })}
    </figure>
  );
}
