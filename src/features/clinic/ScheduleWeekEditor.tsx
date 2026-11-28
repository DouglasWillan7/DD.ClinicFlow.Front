import { Plus, X } from "lucide-react";
import type { ScheduleDay } from "../../api/types";
import {
  scheduleDays,
  suggestedInterval,
  type ScheduleDraft,
} from "./scheduleForm";
import styles from "./ScheduleWeekEditor.module.css";

/**
 * Semana padrão de atendimento: um dia por linha, com os períodos lado a lado na mesma
 * linha. É o mesmo editor nas abas Disponibilidade (Meu perfil e o perfil do médico em
 * Equipe) e no cadastro do médico; quem o usa guarda o rascunho e decide quando salvar.
 *
 * Os campos de hora não têm rótulo visível (o nome do dia e o "até" já dizem o que
 * são): cada um leva o próprio `aria-label` com dia, período e início ou fim.
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
              <strong>{day.label}</strong>
            </label>

            {enabled ? (
              <div className={styles.periods}>
                {intervals.map((interval, index) => (
                  <div className={styles.period} key={interval.id}>
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
                    <span className={styles.periodSeparator} aria-hidden="true">
                      até
                    </span>
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
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addPeriod}
                  disabled={disabled}
                  // Um botão por dia: o nome acessível diz de qual dia é.
                  aria-label={`Adicionar período em ${day.label}`}
                  onClick={() =>
                    onChange(day.value, (current) => [
                      ...current,
                      suggestedInterval(current, duration),
                    ])
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  Período
                </button>
              </div>
            ) : (
              <p className={styles.closedDay}>Sem atendimento</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
