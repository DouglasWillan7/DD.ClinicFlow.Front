import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Appointment, PatientActionStatusView } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { PatientActionTokenPanel } from "./PatientActionTokenPanel";
import styles from "./PatientActions.module.css";

export function AppointmentPatientActionDialog({
  appointment,
  onClose,
  onUpdated,
}: {
  appointment: Appointment;
  onClose(): void;
  onUpdated(): void | Promise<void>;
}) {
  const { request } = useAuth();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const action = useQuery({
    queryKey: ["patient-actions", "appointment", appointment.id],
    queryFn: () =>
      request<PatientActionStatusView>(
        `/patient-actions/appointments/${encodeURIComponent(appointment.id)}`,
      ),
    refetchInterval: (query) =>
      query.state.data?.status === "Pending" ? 5_000 : false,
  });

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [onClose]);

  async function refresh() {
    await action.refetch();
    await onUpdated();
  }

  return (
    <div className={styles.dialogBackdrop}>
      <section
        className={styles.actionDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-action-dialog-title"
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="patient-action-dialog-title">Confirmação do paciente</h2>
            <p>
              Uma única confirmação libera o agendamento e o compartilhamento
              com o médico.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.dialogClose}
            aria-label="Fechar confirmação"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.dialogBody}>
          <dl className={styles.appointmentSummary}>
            <div>
              <dt>Paciente</dt>
              <dd>{appointment.patientName}</dd>
            </div>
          </dl>

          {action.isLoading ? (
            <LoadingBlock label="Carregando confirmação…" />
          ) : action.isError || !action.data ? (
            <ErrorBlock
              message="Não foi possível carregar a confirmação do paciente."
              retry={() => void action.refetch()}
            />
          ) : (
            <PatientActionTokenPanel action={action.data} onUpdated={refresh} />
          )}
        </div>
      </section>
    </div>
  );
}
