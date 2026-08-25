import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, Video } from "lucide-react";
import { ApiError } from "../../api/client";
import type { Appointment, Clinic, Patient } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { appointmentTypeLabels } from "../appointments/appointmentLabels";
import {
  appointmentStatusLabels,
  isAppointmentTerminal,
} from "../appointments/appointmentStatus";
import { usePatientClinicalSummary } from "./exams/clinicalReportQueries";
import { PatientClinicalOverview } from "./PatientClinicalOverview";
import { PatientHeader } from "./PatientHeader";
import {
  formatCpf,
  formatDateOnly,
  formatMedicalRecord,
} from "./patientFormatters";
import styles from "./PatientDetailPage.module.css";

function nextAppointment(items: Appointment[]) {
  const now = Date.now();
  return [...items]
    .filter(
      (appointment) =>
        !isAppointmentTerminal(appointment.status) &&
        new Date(appointment.startUtc).getTime() >= now,
    )
    .sort(
      (left, right) =>
        new Date(left.startUtc).getTime() - new Date(right.startUtc).getTime(),
    )[0] ?? null;
}

export function PatientDetailPage({ patientId }: { patientId: string }) {
  const { request } = useAuth();
  const navigate = useNavigate();
  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => request<Patient>(`/patients/${patientId}`),
  });
  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const appointments = useQuery({
    queryKey: ["patients", patientId, "appointments"],
    queryFn: () =>
      request<Appointment[]>(`/appointments/patients/${patientId}`),
  });
  const clinicalSummary = usePatientClinicalSummary(patientId);

  if (patient.isLoading) {
    return <LoadingBlock label="Carregando o paciente…" />;
  }

  if (patient.isError || !patient.data) {
    return (
      <ErrorBlock
        message={
          patient.error instanceof ApiError && patient.error.status === 404
            ? "Este paciente não existe ou não está no seu escopo de atendimento."
            : "Não foi possível carregar o paciente."
        }
        retry={() => void patient.refetch()}
      />
    );
  }

  const person = patient.data;
  const timeZone = clinic.data?.timeZoneId ?? "America/Sao_Paulo";
  const upcoming = nextAppointment(appointments.data ?? []);

  return (
    <div className={styles.content}>
      <PatientHeader
        patient={person}
        activeSection="overview"
        capabilities={clinicalSummary.data?.capabilities}
      />

      <div className={styles.workspace}>
        <aside className={styles.contextColumn} aria-label="Contexto do paciente">
          <section className={styles.panel} aria-labelledby="informacoes-titulo">
            <h2 id="informacoes-titulo">Informações do paciente</h2>
            <dl className={styles.patientData}>
              <div>
                <dt>Nascimento</dt>
                <dd>{formatDateOnly(person.birthDate)}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{formatCpf(person.cpf)}</dd>
              </div>
              <div>
                <dt>Prontuário</dt>
                <dd>{formatMedicalRecord(person.medicalRecordNumber)}</dd>
              </div>
              <div>
                <dt>Última coleta</dt>
                <dd>
                  {clinicalSummary.isLoading
                    ? "Carregando…"
                    : formatDateOnly(
                        clinicalSummary.data?.latestCollectionDate ?? null,
                      )}
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="proxima-consulta-titulo">
            <h2 id="proxima-consulta-titulo">Próxima consulta</h2>
            {appointments.isLoading ? (
              <LoadingBlock label="Carregando próxima consulta…" />
            ) : appointments.isError ? (
              <ErrorBlock
                message="Não foi possível carregar a próxima consulta."
                retry={() => void appointments.refetch()}
              />
            ) : upcoming ? (
              <div className={styles.appointment}>
                <p className={styles.appointmentDate}>
                  <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
                  {formatInTimeZone(
                    upcoming.startUtc,
                    timeZone,
                    "dd/MM/yyyy · HH:mm",
                  )}
                </p>
                <p className={styles.appointmentMeta}>
                  {upcoming.type === "Teleconsultation" ? (
                    <Video size={15} strokeWidth={1.8} aria-hidden="true" />
                  ) : null}
                  {appointmentTypeLabels[upcoming.type]} · {appointmentStatusLabels[upcoming.status]}
                </p>
                <button
                  type="button"
                  className={styles.contextAction}
                  onClick={() => navigate("/app/agenda")}
                >
                  Ver na agenda
                </button>
              </div>
            ) : (
              <div className={styles.emptyAppointment}>
                <p>Nenhuma consulta futura agendada.</p>
                <button
                  type="button"
                  className={styles.contextAction}
                  onClick={() =>
                    navigate(`/app/agenda/nova?patientId=${patientId}`)
                  }
                >
                  Agendar consulta
                </button>
              </div>
            )}
          </section>
        </aside>

        <div className={styles.clinicalColumn}>
          <PatientClinicalOverview
            patientId={patientId}
            summary={clinicalSummary.data}
            loading={clinicalSummary.isLoading}
            error={clinicalSummary.isError}
            onRetry={() => void clinicalSummary.refetch()}
          />
        </div>
      </div>
    </div>
  );
}
