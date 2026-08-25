import { useEffect, useRef } from "react";
import type { HealthcarePlan } from "../../api/types";
import { appointmentTypeLabels, formatDateOnlyLong } from "./appointmentLabels";
import {
  canConfirm,
  type NewAppointmentSelection,
} from "./newAppointmentState";
import styles from "./NewAppointmentPage.module.css";

export interface AppointmentSummaryProps {
  selection: NewAppointmentSelection;
  pending: boolean;
  error: string | null;
  healthcarePlans?: HealthcarePlan[];
  onConfirm(): void;
}

export function AppointmentSummary({
  selection,
  pending,
  error,
  healthcarePlans = [],
  onConfirm,
}: AppointmentSummaryProps) {
  const submissionLocked = useRef(false);
  const previousPending = useRef(pending);
  const selectionKey = JSON.stringify([
    selection.patient?.id,
    selection.doctor?.userId,
    selection.type,
    selection.date,
    selection.slot?.startUtc,
    selection.healthcarePlanId,
  ]);
  const previousSelectionKey = useRef(selectionKey);
  const complete = canConfirm(selection);

  useEffect(() => {
    if (
      (previousPending.current && !pending) ||
      previousSelectionKey.current !== selectionKey ||
      error
    ) {
      submissionLocked.current = false;
    }
    previousPending.current = pending;
    previousSelectionKey.current = selectionKey;
  }, [error, pending, selectionKey]);

  function confirm() {
    if (!complete || pending || submissionLocked.current) return;
    submissionLocked.current = true;
    onConfirm();
  }

  return (
    <section
      className={styles.card}
      aria-labelledby="appointment-summary-title"
      aria-busy={pending}
    >
      <h2 id="appointment-summary-title" className={styles.cardTitle}>
        Resumo
      </h2>

      <dl className={styles.summaryList}>
        <div className={styles.summaryRow}>
          <dt>Paciente</dt>
          <dd>{selection.patient?.name ?? "—"}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Médico</dt>
          <dd>{selection.doctor?.name ?? selection.doctor?.email ?? "—"}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Tipo</dt>
          <dd>
            {selection.type ? appointmentTypeLabels[selection.type] : "—"}
          </dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Data</dt>
          <dd>{formatDateOnlyLong(selection.date)}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Horário</dt>
          <dd>{selection.slot?.label ?? "—"}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Duração</dt>
          <dd>
            {selection.slot
              ? `${Math.max(
                  0,
                  Math.round(
                    (Date.parse(selection.slot.endUtc) -
                      Date.parse(selection.slot.startUtc)) /
                      60_000,
                  ),
                )} min`
              : "—"}
          </dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Plano</dt>
          <dd>
            {selection.healthcarePlanId
              ? healthcarePlans.find(
                  (plan) => plan.id === selection.healthcarePlanId,
                )?.name ?? "—"
              : "Particular"}
          </dd>
        </div>
      </dl>

      {pending ? (
        <p className={styles.pendingMessage} role="status" aria-live="polite">
          Criando consulta…
        </p>
      ) : null}
      {error ? (
        <p className={styles.confirmError} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.confirmButton}
        disabled={!complete || pending}
        aria-busy={pending}
        onClick={confirm}
      >
        Confirmar agendamento
      </button>
    </section>
  );
}
