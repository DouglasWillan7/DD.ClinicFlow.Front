import { formatInTimeZone } from "date-fns-tz";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  AvailabilitySlot,
} from "../../api/types";

export type TimelineTone = "confirmed" | "pending" | "done" | "canceled";
export type TypeFilter = "all" | AppointmentType;

export function appointmentTimelineTone(
  status: AppointmentStatus,
): TimelineTone {
  if (status === "Confirmada") return "confirmed";
  if (status === "Realizada") return "done";
  if (status === "Cancelada" || status === "NoShow") return "canceled";
  return "pending";
}

export interface TimelineBase {
  key: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

export type TimelineRow =
  | (TimelineBase & {
      kind: "appointment";
      appointment: Appointment;
      tone: TimelineTone;
    })
  /** Consulta escondida pelo filtro de tipo: o horário segue ocupado. */
  | (TimelineBase & { kind: "hidden"; type: AppointmentType })
  | (TimelineBase & { kind: "free"; slot: AvailabilitySlot })
  | (TimelineBase & { kind: "break" });

function toMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(minutes: number) {
  const normalized = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

function localTime(instant: string, timeZone: string) {
  return formatInTimeZone(instant, timeZone, "HH:mm");
}

function overlaps(first: TimelineBase, second: TimelineBase) {
  return (
    first.startMinutes < second.endMinutes &&
    second.startMinutes < first.endMinutes
  );
}

function byStart(first: TimelineRow, second: TimelineRow) {
  if (first.startMinutes !== second.startMinutes) {
    return first.startMinutes - second.startMinutes;
  }
  return first.kind === "free" || first.kind === "break" ? 1 : -1;
}

/**
 * Monta a linha do tempo do dia a partir das consultas reais e dos horários
 * livres do médico. Lacunas entre um item e o seguinte viram um intervalo.
 *
 * O filtro de tipo nunca apaga o horário: a consulta escondida vira uma faixa
 * "ocupado", para o dia não parecer mais vago do que é.
 */
export function buildDayTimeline({
  appointments,
  slots,
  timeZone,
  typeFilter = "all",
}: {
  appointments: Appointment[];
  slots: AvailabilitySlot[];
  timeZone: string;
  typeFilter?: TypeFilter;
}): TimelineRow[] {
  const appointmentRows = appointments
    .map((appointment): TimelineRow => {
      const start = localTime(appointment.startUtc, timeZone);
      const end = localTime(appointment.endUtc, timeZone);
      const startMinutes = toMinutes(start);
      const endMinutes = Math.max(toMinutes(end), startMinutes);
      const base = {
        key: appointment.id,
        start,
        end,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
      };
      return typeFilter === "all" || appointment.type === typeFilter
        ? {
            ...base,
            kind: "appointment",
            appointment,
            tone: appointmentTimelineTone(appointment.status),
          }
        : { ...base, kind: "hidden", type: appointment.type };
    })
    .filter((row) => Number.isFinite(row.startMinutes));

  const freeRows = slots
    .map((slot): TimelineRow => {
      const start = slot.label || localTime(slot.startUtc, timeZone);
      const end = localTime(slot.endUtc, timeZone);
      const startMinutes = toMinutes(start);
      const endMinutes = Math.max(toMinutes(end), startMinutes);
      return {
        kind: "free",
        key: `free-${slot.startUtc}`,
        slot,
        start,
        end,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
      };
    })
    .filter(
      (row) =>
        Number.isFinite(row.startMinutes) &&
        !appointmentRows.some((appointment) => overlaps(appointment, row)),
    );

  const rows = [...appointmentRows, ...freeRows].sort(byStart);

  const withBreaks: TimelineRow[] = [];
  for (const row of rows) {
    const previous = withBreaks[withBreaks.length - 1];
    if (previous && row.startMinutes > previous.endMinutes) {
      withBreaks.push({
        kind: "break",
        key: `break-${previous.endMinutes}-${row.startMinutes}`,
        start: formatMinutes(previous.endMinutes),
        end: formatMinutes(row.startMinutes),
        startMinutes: previous.endMinutes,
        endMinutes: row.startMinutes,
        durationMinutes: row.startMinutes - previous.endMinutes,
      });
    }
    withBreaks.push(row);
  }

  return withBreaks;
}

export interface DayStats {
  total: number;
  teleconsultations: number;
  pending: number;
}

/** Resumo do dia do médico ativo; independe do filtro de tipo (handoff). */
export function getDayStats(appointments: Appointment[]): DayStats {
  const active = appointments.filter(
    (appointment) => appointmentTimelineTone(appointment.status) !== "canceled",
  );
  return {
    total: active.length,
    teleconsultations: active.filter(
      (appointment) => appointment.type === "Teleconsultation",
    ).length,
    pending: appointments.filter(
      (appointment) => appointmentTimelineTone(appointment.status) === "pending",
    ).length,
  };
}

/** Horários ainda agendáveis: a faixa "ocupado" do filtro nunca conta. */
export function countFreeSlots(rows: TimelineRow[]) {
  return rows.filter((row) => row.kind === "free").length;
}
