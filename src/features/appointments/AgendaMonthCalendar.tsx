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
import { formatDateOnlyLong } from "./appointmentLabels";
import styles from "./AgendaPage.module.css";

export interface AgendaMonthCalendarProps {
  month: Date;
  selectedDate: string;
  countByDate: Map<string, number>;
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
const calendarMinimumWidth = weekDays.length * 44;

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function AgendaMonthCalendar({
  month,
  selectedDate,
  countByDate,
  onMonthChange,
  onDateChange,
}: AgendaMonthCalendarProps) {
  const monthStart = startOfMonth(month);
  const cells = eachDayOfInterval({
    start: startOfWeek(monthStart, { locale: ptBR }),
    end: endOfWeek(endOfMonth(monthStart), { locale: ptBR }),
  });
  const rows = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const monthLabel = format(monthStart, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <section className={styles.card} aria-labelledby="agenda-month-title">
      <div className={styles.cardHeader}>
        <h2 id="agenda-month-title" className={styles.cardTitle}>
          {capitalize(monthLabel)}
        </h2>
        <div className={styles.monthActions}>
          <button
            type="button"
            className={styles.monthNavigation}
            aria-label="Mês anterior"
            onClick={() => onMonthChange(startOfMonth(addMonths(monthStart, -1)))}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.monthNavigation}
            aria-label="Próximo mês"
            onClick={() => onMonthChange(startOfMonth(addMonths(monthStart, 1)))}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
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
                if (!isSameMonth(cell, monthStart)) {
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

                const count = countByDate.get(key) ?? 0;
                const selected = key === selectedDate;
                const summary =
                  count === 0
                    ? "sem consultas"
                    : count === 1
                      ? "1 consulta"
                      : `${count} consultas`;

                return (
                  <td key={key} className={styles.calendarCell}>
                    <button
                      type="button"
                      className={styles.calendarDay}
                      aria-label={`${formatDateOnlyLong(key)}, ${summary}${
                        selected ? ", selecionado" : ""
                      }`}
                      aria-pressed={selected}
                      onClick={() => onDateChange(key)}
                    >
                      <span className={styles.dayCircle}>
                        {dayNumber}
                        {count > 0 ? (
                          <span className={styles.dayMark} aria-hidden="true" />
                        ) : null}
                      </span>
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

      <p className={styles.calendarLegend}>
        <span className={styles.legendMark} aria-hidden="true" /> dias com
        consultas
      </p>
    </section>
  );
}
