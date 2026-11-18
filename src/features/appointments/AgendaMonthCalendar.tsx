import type { AvailabilityDay } from "../../api/types";
import { MonthCalendar } from "./MonthCalendar";

export interface AgendaMonthCalendarProps {
  month: Date;
  selectedDate: string;
  days: AvailabilityDay[];
  timeZoneId: string;
  pastDatesSelectable: boolean;
  countByDate: Map<string, number>;
  onMonthChange(month: Date): void;
  onDateChange(date: string): void;
}

/** Calendário da Agenda: marca os dias com consultas e abre dias passados que as tenham. */
export function AgendaMonthCalendar(props: AgendaMonthCalendarProps) {
  return <MonthCalendar titleId="agenda-month-title" {...props} />;
}
