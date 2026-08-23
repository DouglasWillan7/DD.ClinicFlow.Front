import clsx from "clsx";
import { Trash2 } from "lucide-react";
import {
  assessmentMetrics,
  describeDelta,
  deltaTone,
  formatMetricValue,
  formatSignedDelta,
  type AssessmentRow,
} from "./assessmentMetrics";
import { formatDateOnly } from "./patientFormatters";
import styles from "./PatientAssessmentsPage.module.css";

export function AssessmentsTable({
  rows,
  patientName,
  onRemove,
  removing,
}: {
  rows: AssessmentRow[];
  patientName: string;
  onRemove(assessmentId: string): void;
  removing: boolean;
}) {
  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Avaliações físicas de {patientName}, da mais recente para a mais antiga.
            Cada valor traz a variação em relação à avaliação anterior.
          </caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              {assessmentMetrics.map((metric) => (
                <th key={metric.id} scope="col" className={styles.numericHead}>
                  <span className={styles.metricName}>{metric.label}</span>
                  <span className={styles.metricUnit}>{metric.unit}</span>
                </th>
              ))}
              <th scope="col">
                <span className={styles.srOnly}>Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assessment.id}>
                <th scope="row">
                  <span className={styles.rowDate}>
                    {formatDateOnly(row.assessment.assessedOn)}
                  </span>
                  <span className={styles.rowNumber}>Avaliação {row.number}</span>
                </th>

                {assessmentMetrics.map((metric) => {
                  const cell = row.cells[metric.id];
                  const tone = cell.delta === null ? null : deltaTone(metric, cell.delta);
                  return (
                    <td key={metric.id} className={styles.numeric}>
                      <span className={styles.cellValue}>
                        {formatMetricValue(cell.value)}
                      </span>
                      {cell.delta !== null && tone ? (
                        <span className={clsx(styles.delta, styles[tone])}>
                          {formatSignedDelta(cell.delta)}
                          <span className={styles.srOnly}> {describeDelta(tone)}</span>
                        </span>
                      ) : null}
                    </td>
                  );
                })}

                <td>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemove(row.assessment.id)}
                    disabled={removing}
                    aria-label={`Remover avaliação de ${formatDateOnly(row.assessment.assessedOn)}`}
                  >
                    <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.tableNote}>
        Variação relativa à avaliação anterior. Verde indica evolução favorável para a
        métrica — perder peso, IMC, gordura e cintura; ganhar braço, antebraço, coxa e
        panturrilha. O IMC é calculado a partir do peso e da altura registrados.
      </p>
    </>
  );
}
