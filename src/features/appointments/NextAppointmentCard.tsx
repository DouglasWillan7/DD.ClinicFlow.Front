import { differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Clock3, Video } from "lucide-react";
import type { Appointment } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { appointmentTypeLabels, getInitials } from "./appointmentLabels";
import styles from "./AgendaPage.module.css";

export function NextAppointmentCard({
  appointment,
  timeZone,
}: {
  appointment: Appointment;
  timeZone: string;
}) {
  const navigate = useNavigate();
  const durationMinutes = Math.max(
    0,
    differenceInMinutes(
      new Date(appointment.endUtc),
      new Date(appointment.startUtc),
    ),
  );
  const teleconsultation = appointment.type === "Teleconsultation";

  return (
    <section
      className={styles.card}
      aria-labelledby="next-appointment-title"
    >
      <h2 id="next-appointment-title" className={styles.cardTitle}>
        Próxima consulta
      </h2>

      <div className={styles.nextPatient}>
        <span className={styles.nextPatientAvatar} aria-hidden="true">
          {getInitials(appointment.patientName)}
        </span>
        <span className={styles.nextPatientCopy}>
          <strong>{appointment.patientName}</strong>
          <span>{appointment.notes?.trim() || "Consulta agendada"}</span>
        </span>
      </div>

      <div className={styles.nextAppointmentMeta}>
        <span className={styles.nextTimeBadge}>
          <Clock3 size={15} strokeWidth={1.7} aria-hidden="true" />
          {formatInTimeZone(appointment.startUtc, timeZone, "HH:mm")} ·{" "}
          {durationMinutes} min
        </span>
        <span className={styles.nextTypeBadge}>
          {teleconsultation ? (
            <Video size={15} strokeWidth={1.7} aria-hidden="true" />
          ) : null}
          {appointmentTypeLabels[appointment.type]}
        </span>
      </div>

      <button
        type="button"
        className={styles.openPatientRecord}
        onClick={() => navigate(`/app/pacientes/${appointment.patientId}`)}
      >
        Abrir prontuário
      </button>
    </section>
  );
}
