import { useQuery } from "@tanstack/react-query";
import type { Appointment, PatientActionStatusView } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Dialog } from "../../components/Dialog";
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
  const action = useQuery({
    queryKey: ["patient-actions", "appointment", appointment.id],
    queryFn: () =>
      request<PatientActionStatusView>(
        `/patient-actions/appointments/${encodeURIComponent(appointment.id)}`,
      ),
    refetchInterval: (query) =>
      query.state.data?.status === "Pending" ? 5_000 : false,
  });

  async function refresh() {
    await action.refetch();
    await onUpdated();
  }

  // <dialog> nativo: o foco fica preso no diálogo e volta ao gatilho ao fechar.
  return (
    <Dialog
      title="Confirmação do paciente"
      description="Uma única confirmação libera o agendamento e o compartilhamento com o médico."
      closeLabel="Fechar confirmação"
      onClose={onClose}
    >
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
    </Dialog>
  );
}
