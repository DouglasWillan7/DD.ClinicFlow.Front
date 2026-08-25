import type {
  DoctorSchedule,
  ScheduleDay,
  UpdateDoctorScheduleRequest,
} from "../../api/types";

export interface EditableScheduleInterval {
  id: string;
  startLocal: string;
  endLocal: string;
}

export type ScheduleDraft = Record<ScheduleDay, EditableScheduleInterval[]>;

export const scheduleDays: Array<{ value: ScheduleDay; label: string }> = [
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
  { value: "Sunday", label: "Domingo" },
];

export function emptyScheduleDraft(): ScheduleDraft {
  return scheduleDays.reduce<ScheduleDraft>(
    (draft, day) => ({ ...draft, [day.value]: [] }),
    {} as ScheduleDraft,
  );
}

export function scheduleToDraft(schedule: DoctorSchedule): ScheduleDraft {
  const draft = emptyScheduleDraft();
  for (const [index, interval] of schedule.intervals.entries()) {
    draft[interval.dayOfWeek].push({
      id: interval.id || `${interval.dayOfWeek}-${index}`,
      startLocal: interval.startLocal.slice(0, 5),
      endLocal: interval.endLocal.slice(0, 5),
    });
  }
  return draft;
}

function timeToMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildScheduleRequest(
  draft: ScheduleDraft,
  duration: number,
): { request?: UpdateDoctorScheduleRequest; error?: string } {
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    return { error: "A duração padrão deve estar entre 5 e 480 minutos." };
  }

  const intervals: UpdateDoctorScheduleRequest["intervals"] = [];
  for (const day of scheduleDays) {
    const ordered = [...draft[day.value]].sort((left, right) =>
      left.startLocal.localeCompare(right.startLocal),
    );
    let previousEnd = -1;
    for (const interval of ordered) {
      const start = timeToMinutes(interval.startLocal);
      const end = timeToMinutes(interval.endLocal);
      if (start === null || end === null || end <= start) {
        return {
          error: `Em ${day.label}, o horário final deve ser posterior ao inicial.`,
        };
      }
      if (end - start < duration) {
        return {
          error: `Em ${day.label}, cada período deve ter ao menos ${duration} minutos.`,
        };
      }
      if (start < previousEnd) {
        return {
          error: `Os períodos de ${day.label} não podem se sobrepor.`,
        };
      }
      previousEnd = end;
      intervals.push({
        dayOfWeek: day.value,
        startLocal: interval.startLocal,
        endLocal: interval.endLocal,
      });
    }
  }

  return {
    request: {
      defaultAppointmentDurationMinutes: duration,
      intervals,
    },
  };
}

export function suggestedInterval(
  intervals: EditableScheduleInterval[],
  duration: number,
): EditableScheduleInterval {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${intervals.length}`;
  if (intervals.length === 0) {
    return { id, startLocal: "08:00", endLocal: "12:00" };
  }

  const last = [...intervals].sort((left, right) =>
    left.endLocal.localeCompare(right.endLocal),
  ).at(-1)!;
  const lastEnd = timeToMinutes(last.endLocal) ?? 13 * 60;
  const start = Math.min(lastEnd, 22 * 60);
  const end = Math.min(start + Math.max(duration, 60), 23 * 60 + 59);
  const format = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { id, startLocal: format(start), endLocal: format(end) };
}
