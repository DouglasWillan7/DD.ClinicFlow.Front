import type { AvailabilityDay } from "../../api/types";
import { availabilityStatusLabels } from "./appointmentLabels";

export interface CalendarAvailabilityState {
  available: boolean;
  selected: boolean;
  withoutSlots: boolean;
  status: string;
}

export function getDateOnlyInTimeZone(timeZoneId: string, instant: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZoneId,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const values = Object.fromEntries(
      parts
        .filter((part) => ["year", "month", "day"].includes(part.type))
        .map((part) => [part.type, part.value]),
    );
    if (!values.year || !values.month || !values.day) return null;
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return null;
  }
}

export function getCalendarAvailabilityState({
  date,
  availability,
  clinicToday,
  selectedDate,
  pastDatesSelectable = false,
}: {
  date: string;
  availability: AvailabilityDay | undefined;
  clinicToday: string | null;
  selectedDate: string | null;
  pastDatesSelectable?: boolean;
}): CalendarAvailabilityState {
  const past = clinicToday !== null && date < clinicToday;
  const hasRealSlots = Boolean(availability?.slots.length);
  const available = past
    ? pastDatesSelectable
    : availability?.status === "Available" && hasRealSlots;
  const withoutSlots =
    !past &&
    (availability?.status === "Full" ||
      (availability?.status === "Available" && !hasRealSlots));
  const status = past
    ? "data passada"
    : availability?.status === "Available" && !hasRealSlots
      ? "sem horários"
      : availability
        ? availabilityStatusLabels[availability.status].toLocaleLowerCase(
            "pt-BR",
          )
        : "indisponível";

  return {
    available,
    selected: available && date === selectedDate,
    withoutSlots,
    status,
  };
}
