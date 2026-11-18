import type { AvailabilityDay } from "../../api/types";
import { MonthCalendar } from "./MonthCalendar";

export interface AppointmentCalendarProps {
  month: Date;
  days: AvailabilityDay[];
  timeZoneId: string;
  selectedDate: string | null;
  onMonthChange(month: Date): void;
  onDateChange(date: string): void;
}

/** Passo "Data" do novo agendamento: só dias com horário livre são escolhíveis. */
export function AppointmentCalendar(props: AppointmentCalendarProps) {
  return (
    <MonthCalendar titleId="date-title" heading="Data" columnMinWidth={48} {...props} />
  );
}
