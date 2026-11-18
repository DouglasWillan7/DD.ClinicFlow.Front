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
import { formatDateOnlyLong } from "./appointmentLabels";
import {
  getCalendarAvailabilityState,
  getDateOnlyInTimeZone,
} from "./calendarAvailability";
import styles from "./MonthCalendar.module.css";

export interface MonthCalendarProps {
  /** Id do título do cartão, usado em `aria-labelledby`. */
  titleId: string;
  /**
   * Título fixo do cartão ("Data", no agendamento). Sem ele, o próprio mês é o
   * título (Agenda).
   */
  heading?: string;
  month: Date;
  days: AvailabilityDay[];
  timeZoneId: string;
  selectedDate: string | null;
  /** Consultas por dia: marca o dia e entra no nome acessível. */
  countByDate?: Map<string, number>;
  /** Permite abrir dias passados que tenham consultas (Agenda). */
  pastDatesSelectable?: boolean;
  /**
   * Largura mínima de cada coluna. O padrão é o alvo de toque (44px); o
   * agendamento usa 48px para os dias não encostarem na coluna larga.
   */
  columnMinWidth?: number;
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

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function appointmentCountSummary(count: number) {
  if (count === 0) return "sem consultas";
  return count === 1 ? "1 consulta" : `${count} consultas`;
}

/** Calendário mensal de disponibilidade, usado pela Agenda e pelo novo agendamento. */
export function MonthCalendar({
  titleId,
  heading,
  month,
  days,
  timeZoneId,
  selectedDate,
  countByDate,
  pastDatesSelectable = false,
  columnMinWidth = 44,
  onMonthChange,
  onDateChange,
}: MonthCalendarProps) {
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

  const navigation = (
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
  );

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {heading ? (
        <>
          <h2 id={titleId} className={styles.cardTitle}>
            {heading}
          </h2>
          <div className={styles.monthHeader}>
            <strong className={styles.monthLabel}>{capitalize(monthLabel)}</strong>
            {navigation}
          </div>
        </>
      ) : (
        <div className={styles.cardHeader}>
          <h2 id={titleId} className={styles.cardTitle}>
            {capitalize(monthLabel)}
          </h2>
          {navigation}
        </div>
      )}

      <table
        className={styles.calendarTable}
        aria-label={`Calendário de ${monthLabel}`}
        // Abaixo disso o cartão rola em vez de encolher o alvo de toque.
        style={{ minWidth: weekDays.length * columnMinWidth }}
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

                const count = countByDate?.get(key) ?? 0;
                const { available, selected, withoutSlots, status } =
                  getCalendarAvailabilityState({
                    date: key,
                    availability: availabilityByDate.get(key),
                    clinicToday,
                    selectedDate,
                    pastDatesSelectable: pastDatesSelectable && count > 0,
                  });
                const accessibleName = [
                  formatDateOnlyLong(key),
                  status,
                  countByDate ? appointmentCountSummary(count) : null,
                  selected ? "selecionado" : null,
                ]
                  .filter(Boolean)
                  .join(", ");

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
        {countByDate ? (
          <span>
            <span className={styles.legendMark} aria-hidden="true" /> dias com
            consultas
          </span>
        ) : null}
      </p>
    </section>
  );
}
