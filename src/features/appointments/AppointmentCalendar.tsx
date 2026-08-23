import clsx from "clsx";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailabilityDay } from "../../api/types";
import {
  availabilityStatusLabels,
  formatDateOnlyLong,
} from "./appointmentLabels";
import styles from "./NewAppointmentPage.module.css";

export interface AppointmentCalendarProps {
  month: Date;
  days: AvailabilityDay[];
  timeZoneId: string;
  selectedDate: string | null;
  onMonthChange(month: Date): void;
  onDateChange(date: string): void;
}

const weekDays: Array<[initial: string, label: string]> = [
  ["D", "Domingo"],
  ["S", "Segunda-feira"],
  ["T", "Terça-feira"],
  ["Q", "Quarta-feira"],
  ["Q", "Quinta-feira"],
  ["S", "Sexta-feira"],
  ["S", "Sábado"],
];
const calendarMinimumWidth = weekDays.length * 48;

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function getDateOnlyInTimeZone(timeZoneId: string, instant: Date) {
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

export function AppointmentCalendar({
  month,
  days,
  timeZoneId,
  selectedDate,
  onMonthChange,
  onDateChange,
}: AppointmentCalendarProps) {
  const monthStart = startOfMonth(month);
  const availabilityByDate = new Map(days.map((day) => [day.date, day]));
  const cells = eachDayOfInterval({
    start: startOfWeek(monthStart, { locale: ptBR }),
    end: endOfWeek(endOfMonth(monthStart), { locale: ptBR }),
  });
  const rows = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const monthLabel = format(monthStart, "MMMM 'de' yyyy", { locale: ptBR });
  const clinicToday = getDateOnlyInTimeZone(timeZoneId, new Date());

  return (
    <section className={styles.card} aria-labelledby="date-title">
      <h2 id="date-title" className={styles.cardTitle}>
        Data
      </h2>

      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.calendarNavigation}
          aria-label="Mês anterior"
          onClick={() => onMonthChange(startOfMonth(addMonths(monthStart, -1)))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <strong className={styles.calendarMonth}>
          {capitalize(monthLabel)}
        </strong>
        <button
          type="button"
          className={styles.calendarNavigation}
          aria-label="Próximo mês"
          onClick={() => onMonthChange(startOfMonth(addMonths(monthStart, 1)))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <table
        className={styles.calendarTable}
        aria-label={`Calendário de ${monthLabel}`}
        style={{ minWidth: calendarMinimumWidth }}
      >
        <thead>
          <tr>
            {weekDays.map(([initial, label], index) => (
              <th key={`${label}-${index}`} scope="col" aria-label={label}>
                {initial}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={dateKey(row[0])}>
              {row.map((cell) => {
                const key = dateKey(cell);
                const dayNumber = format(cell, "d");
                const currentMonth = isSameMonth(cell, monthStart);
                if (!currentMonth) {
                  return (
                    <td
                      key={key}
                      className={styles.outsideMonth}
                      aria-disabled="true"
                      aria-label={`${formatDateOnlyLong(key)}, fora do mês`}
                    >
                      {dayNumber}
                    </td>
                  );
                }

                const availability = availabilityByDate.get(key);
                const past = clinicToday !== null && key < clinicToday;
                const hasRealSlots = Boolean(availability?.slots.length);
                const available =
                  !past && availability?.status === "Available" && hasRealSlots;
                const selected = available && key === selectedDate;
                const withoutSlots =
                  !past &&
                  (availability?.status === "Full" ||
                    (availability?.status === "Available" && !hasRealSlots));
                const status = past
                  ? "data passada"
                  : availability?.status === "Available" && !hasRealSlots
                    ? "sem horários"
                    : availability
                      ? availabilityStatusLabels[
                          availability.status
                        ].toLocaleLowerCase("pt-BR")
                      : "indisponível";
                const accessibleName = `${formatDateOnlyLong(key)}, ${status}${
                  selected ? ", selecionado" : ""
                }`;

                return (
                  <td key={key} className={styles.calendarCell}>
                    <button
                      type="button"
                      className={clsx(
                        styles.calendarDay,
                        withoutSlots && styles.busyDay,
                      )}
                      aria-label={accessibleName}
                      aria-pressed={selected}
                      disabled={!available}
                      onClick={() => onDateChange(key)}
                    >
                      <span className={styles.dayCircle}>{dayNumber}</span>
                      {selected ? (
                        <span className={styles.srOnly}>Selecionado</span>
                      ) : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.calendarLegend} aria-label="Legenda do calendário">
        <span>
          <span className={styles.legendDot} aria-hidden="true" /> selecionado
        </span>
        <span>
          <span
            className={`${styles.legendDot} ${styles.legendBusy}`}
            aria-hidden="true"
          />{" "}
          sem horários
        </span>
        <span>
          <span
            className={`${styles.legendDot} ${styles.legendOff}`}
            aria-hidden="true"
          />{" "}
          indisponível
        </span>
      </p>
    </section>
  );
}
