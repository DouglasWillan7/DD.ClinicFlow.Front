import { Clock3, Plus, Trash2 } from "lucide-react";
import type { ScheduleDay } from "../../api/types";
import {
  scheduleDays,
  suggestedInterval,
  type ScheduleDraft,
} from "./scheduleForm";
import styles from "./ScheduleWeekEditor.module.css";

/**
 * Semana padrão de atendimento: um dia por linha, cada um com N períodos. É o mesmo
 * editor em Configurações › Disponibilidade e no cadastro do médico em Equipe; quem o
 * usa guarda o rascunho e decide quando salvar.
 */
export function ScheduleWeekEditor({
  draft,
  duration,
  disabled = false,
  className,
  onChange,
}: {
  draft: ScheduleDraft;
  /** Duração da consulta em minutos, usada para sugerir o próximo período. */
  duration: number;
  disabled?: boolean;
  className?: string;
  onChange(
    day: ScheduleDay,
    transform: (intervals: ScheduleDraft[ScheduleDay]) => ScheduleDraft[ScheduleDay],
  ): void;
}) {
  return (
    <div className={className ? `${styles.week} ${className}` : styles.week}>
      {scheduleDays.map((day) => {
        const intervals = draft[day.value];
        const enabled = intervals.length > 0;
        return (
          <section className={styles.dayRow} key={day.value}>
            <label className={styles.dayToggle}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={disabled}
                onChange={(event) =>
                  onChange(day.value, () =>
                    event.target.checked ? [suggestedInterval([], duration)] : [],
                  )
                }
              />
              <span>
                <strong>{day.label}</strong>
                <small>
                  {enabled
                    ? `${intervals.length} período${intervals.length === 1 ? "" : "s"}`
                    : "Sem atendimento"}
                </small>
              </span>
            </label>

            {enabled ? (
              <div className={styles.periods}>
                {intervals.map((interval, index) => (
                  <div className={styles.period} key={interval.id}>
                    <label>
                      <span>Início</span>
                      <input
                        type="time"
                        value={interval.startLocal}
                        disabled={disabled}
                        aria-label={`${day.label}, período ${index + 1}, início`}
                        onChange={(event) =>
                          onChange(day.value, (current) =>
                            current.map((item) =>
                              item.id === interval.id
                                ? { ...item, startLocal: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <span className={styles.periodSeparator}>até</span>
                    <label>
                      <span>Fim</span>
                      <input
                        type="time"
                        value={interval.endLocal}
                        disabled={disabled}
                        aria-label={`${day.label}, período ${index + 1}, fim`}
                        onChange={(event) =>
                          onChange(day.value, (current) =>
                            current.map((item) =>
                              item.id === interval.id
                                ? { ...item, endLocal: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.removePeriod}
                      disabled={disabled}
                      aria-label={`Remover período ${index + 1} de ${day.label}`}
                      onClick={() =>
                        onChange(day.value, (current) =>
                          current.filter((item) => item.id !== interval.id),
                        )
                      }
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addPeriod}
                  disabled={disabled}
                  onClick={() =>
                    onChange(day.value, (current) => [
                      ...current,
                      suggestedInterval(current, duration),
                    ])
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  Adicionar período
                </button>
              </div>
            ) : (
              <p className={styles.closedDay}>
                <Clock3 size={16} aria-hidden="true" />
                Nenhum horário será oferecido neste dia.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
