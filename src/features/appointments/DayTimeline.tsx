import clsx from "clsx";
import { Plus, Video } from "lucide-react";
import type { AvailabilitySlot, Member } from "../../api/types";
import { appointmentTypeLabels, getInitials } from "./appointmentLabels";
import { appointmentStatusLabels } from "./appointmentStatus";
import { formatFreeSlots, getDoctorName } from "./agendaDoctors";
import type { TimelineRow, TimelineTone } from "./agendaTimeline";
import styles from "./AgendaPage.module.css";
import { useNavigate } from "../../app/navigation";

export interface DayTimelineProps {
  doctor: Member;
  dayTitle: string;
  freeSlots: number;
  rows: TimelineRow[];
  emptyMessage: string;
  personal?: boolean;
  canOpenConsultation?: boolean;
  onSelectFreeSlot(slot: AvailabilitySlot): void;
}

const toneClass: Record<TimelineTone, string | undefined> = {
  confirmed: undefined,
  pending: styles.pending,
  done: styles.done,
  canceled: styles.canceled,
};

export function DayTimeline({
  doctor,
  dayTitle,
  freeSlots,
  rows,
  emptyMessage,
  personal = false,
  canOpenConsultation = false,
  onSelectFreeSlot,
}: DayTimelineProps) {
  const navigate = useNavigate();
  const hasAppointments = rows.some((row) => row.kind === "appointment");
  const doctorName = getDoctorName(doctor);
  const specialty = doctor.specialty?.trim();

  return (
    <section
      className={clsx(styles.card, styles.timelineCard)}
      aria-labelledby="agenda-doctor-title"
    >
      {personal ? (
        <header className={styles.personalTimelineHeader}>
          <h1 id="agenda-doctor-title" className={styles.personalTimelineTitle}>
            {dayTitle}
          </h1>
        </header>
      ) : (
        <header className={styles.doctorHeader}>
          <span className={styles.doctorAvatar} aria-hidden="true">
            {getInitials(doctorName)}
          </span>
          <span className={styles.doctorIdentity}>
            <h1 id="agenda-doctor-title" className={styles.doctorName}>
              {doctorName}
            </h1>
            <span className={styles.doctorMeta}>
              {specialty ? `${specialty} · ` : ""}
              {dayTitle}
            </span>
          </span>
          <span className={styles.freeSlotsPill}>
            {formatFreeSlots(freeSlots)}
          </span>
        </header>
      )}

      {rows.length ? (
        <ul className={styles.timeline}>
          {rows.map((row) => {
            if (row.kind === "appointment") {
              const { appointment } = row;
              return (
                <li
                  key={row.key}
                  className={clsx(styles.timelineRow, toneClass[row.tone])}
                >
                  <span className={clsx(styles.rowTime, styles.rowTimeBooked)}>
                    {row.start}
                  </span>
                  {canOpenConsultation ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/consultas/${appointment.id}`)}
                      aria-label={`Abrir consulta de ${appointment.patientName}`}
                      className={clsx(
                        styles.appointmentCard,
                        row.durationMinutes >= 60 && styles.long,
                      )}
                    >
                      <AppointmentCardContent row={row} />
                    </button>
                  ) : (
                    <div
                      className={clsx(
                        styles.appointmentCard,
                        styles.appointmentCardStatic,
                        row.durationMinutes >= 60 && styles.long,
                      )}
                    >
                      <AppointmentCardContent row={row} />
                    </div>
                  )}
                </li>
              );
            }

            if (row.kind === "hidden") {
              return (
                <li key={row.key} className={styles.timelineRow}>
                  <span className={styles.rowTime}>{row.start}</span>
                  <div className={styles.busyBand}>
                    Ocupado ·{" "}
                    {appointmentTypeLabels[row.type].toLocaleLowerCase("pt-BR")}{" "}
                    (fora do filtro)
                  </div>
                </li>
              );
            }

            if (row.kind === "break") {
              return (
                <li key={row.key} className={styles.timelineRow}>
                  <span className={styles.rowTime}>{row.start}</span>
                  <div className={styles.breakBand}>
                    Intervalo · {row.start} – {row.end}
                  </div>
                </li>
              );
            }

            return (
              <li key={row.key} className={styles.timelineRow}>
                <span className={styles.rowTime}>{row.start}</span>
                <button
                  type="button"
                  className={styles.freeSlot}
                  aria-label={`${row.start}, disponível — agendar`}
                  onClick={() => onSelectFreeSlot(row.slot)}
                >
                  <Plus size={16} aria-hidden="true" />
                  Disponível — agendar
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasAppointments ? null : (
        <p className={styles.emptyMessage} role="status">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function AppointmentCardContent({
  row,
}: {
  row: Extract<TimelineRow, { kind: "appointment" }>;
}) {
  const { appointment } = row;
  const teleconsultation = appointment.type === "Teleconsultation";

  return (
    <>
      <span className={styles.appointmentAvatar} aria-hidden="true">
        {getInitials(appointment.patientName)}
      </span>
      <span className={styles.appointmentIdentity}>
        <span className={styles.appointmentName}>{appointment.patientName}</span>
        <span className={styles.appointmentMeta}>
          {appointment.notes?.trim() ? `${appointment.notes.trim()} · ` : ""}
          {row.durationMinutes} min
        </span>
      </span>
      <span className={styles.typeBadge}>
        {teleconsultation ? <Video size={15} aria-hidden="true" /> : null}
        {appointmentTypeLabels[appointment.type]}
      </span>
      <span className={styles.statusLabel}>
        {appointmentStatusLabels[appointment.status]}
      </span>
    </>
  );
}
