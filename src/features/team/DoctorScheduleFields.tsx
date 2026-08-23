import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { ScheduleDay } from "../../api/types";
import styles from "./DoctorForm.module.css";
import {
  attendanceDays,
  collapseSchedule,
  expandUniformSchedule,
  type DoctorScheduleDraftInterval,
  type ScheduleMode,
} from "./doctorRegistration";

export interface DoctorScheduleValue {
  mode: ScheduleMode;
  days: ScheduleDay[];
  startTime: string;
  endTime: string;
  intervals: DoctorScheduleDraftInterval[];
}

interface DoctorScheduleFieldsProps {
  value: DoctorScheduleValue;
  readOnly: boolean;
  errors: {
    days?: string;
    startTime?: string;
    endTime?: string;
    intervals?: string;
  };
  onChange: (next: DoctorScheduleValue) => void;
}

/**
 * Recorrência semanal do médico — a única do produto. O modo simples resolve o caso comum em três
 * campos; o detalhe por dia existe para pausa de almoço e sábado mais curto, sem virar outro
 * formulário com outro botão de salvar.
 */
export function DoctorScheduleFields({
  value,
  readOnly,
  errors,
  onChange,
}: DoctorScheduleFieldsProps) {
  const perDay = value.mode === "perDay";

  return (
    <>
      <fieldset className={`${styles.pillField} ${styles.wide}`}>
        <legend>
          Dias de atendimento
          <span className={styles.required} aria-hidden="true">
            {" *"}
          </span>
          <span className="srOnly"> (obrigatório)</span>
        </legend>
        <div className={styles.pills}>
          {attendanceDays.map((day) => {
            const selected = perDay
              ? value.intervals.some(
                  (interval) => interval.dayOfWeek === day.value,
                )
              : value.days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                className={styles.pill}
                aria-pressed={selected}
                aria-label={day.accessibleLabel}
                disabled={readOnly}
                onClick={() =>
                  perDay
                    ? onChange({
                        ...value,
                        intervals: selected
                          ? value.intervals.filter(
                              (interval) => interval.dayOfWeek !== day.value,
                            )
                          : [
                              ...value.intervals,
                              {
                                dayOfWeek: day.value,
                                startLocal: "08:00",
                                endLocal: "18:00",
                              },
                            ],
                      })
                    : onChange({
                        ...value,
                        days: selected
                          ? value.days.filter((item) => item !== day.value)
                          : [...value.days, day.value],
                      })
                }
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {errors.days ? (
          <small className={styles.error} role="alert">
            {errors.days}
          </small>
        ) : null}
      </fieldset>

      {perDay ? null : (
        <>
          <TimeField
            label="Início"
            value={value.startTime}
            readOnly={readOnly}
            error={errors.startTime}
            onChange={(startTime) => onChange({ ...value, startTime })}
          />
          <TimeField
            label="Fim"
            value={value.endTime}
            readOnly={readOnly}
            error={errors.endTime}
            onChange={(endTime) => onChange({ ...value, endTime })}
          />
        </>
      )}
    </>
  );
}

/** Vive fora de DoctorScheduleFields para ficar depois da duração na ordem do card. */
export function DoctorScheduleDetail({
  value,
  readOnly,
  error,
  onChange,
}: {
  value: DoctorScheduleValue;
  readOnly: boolean;
  error?: string;
  onChange: (next: DoctorScheduleValue) => void;
}) {
  const toggleId = useId();
  const perDay = value.mode === "perDay";

  function setIntervals(intervals: DoctorScheduleDraftInterval[]) {
    onChange({ ...value, intervals });
  }

  function switchMode(toPerDay: boolean) {
    if (toPerDay) {
      onChange({
        ...value,
        mode: "perDay",
        intervals: expandUniformSchedule(
          value.days,
          value.startTime,
          value.endTime,
        ),
      });
      return;
    }

    const collapsed = collapseSchedule(value.intervals);
    if (
      !collapsed &&
      value.intervals.length > 0 &&
      !window.confirm(
        "Voltar ao horário único substitui os horários definidos por dia. Continuar?",
      )
    ) {
      return;
    }
    onChange({
      ...value,
      mode: "uniform",
      days: collapsed?.days ?? value.days,
      startTime: collapsed?.startTime ?? value.startTime,
      endTime: collapsed?.endTime ?? value.endTime,
    });
  }

  return (
    <>
      <label className={`${styles.modeToggle} ${styles.wide}`} htmlFor={toggleId}>
        <input
          id={toggleId}
          type="checkbox"
          checked={perDay}
          disabled={readOnly}
          onChange={(event) => switchMode(event.target.checked)}
        />
        <span>
          <strong>Horários diferentes por dia</strong>
          <small>Use para pausa de almoço ou um sábado mais curto.</small>
        </span>
      </label>

      {perDay ? (
        <div className={`${styles.scheduleDetail} ${styles.wide}`}>
          {attendanceDays.map((day) => {
            const rows = value.intervals
              .map((interval, index) => ({ interval, index }))
              .filter(({ interval }) => interval.dayOfWeek === day.value);
            return (
              <div className={styles.scheduleDay} key={day.value}>
                <span className={styles.scheduleDayName}>{day.label}</span>
                <div className={styles.scheduleDayRows}>
                  {rows.length === 0 ? (
                    <span className={styles.scheduleClosed}>Sem atendimento</span>
                  ) : (
                    rows.map(({ interval, index }, position) => (
                      <div className={styles.scheduleRow} key={index}>
                        <label>
                          <span className="srOnly">
                            Início {position + 1} de {day.accessibleLabel}
                          </span>
                          <input
                            type="time"
                            value={interval.startLocal}
                            readOnly={readOnly}
                            onChange={(event) =>
                              setIntervals(
                                value.intervals.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, startLocal: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <span aria-hidden="true">–</span>
                        <label>
                          <span className="srOnly">
                            Fim {position + 1} de {day.accessibleLabel}
                          </span>
                          <input
                            type="time"
                            value={interval.endLocal}
                            readOnly={readOnly}
                            onChange={(event) =>
                              setIntervals(
                                value.intervals.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, endLocal: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        {readOnly ? null : (
                          <button
                            type="button"
                            className={styles.scheduleAction}
                            aria-label={`Remover intervalo ${position + 1} de ${day.accessibleLabel}`}
                            onClick={() =>
                              setIntervals(
                                value.intervals.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {readOnly ? null : (
                  <button
                    type="button"
                    className={styles.scheduleAdd}
                    aria-label={`Adicionar intervalo de ${day.accessibleLabel}`}
                    onClick={() =>
                      setIntervals([
                        ...value.intervals,
                        {
                          dayOfWeek: day.value,
                          startLocal: rows.at(-1)?.interval.endLocal || "08:00",
                          endLocal: "",
                        },
                      ])
                    }
                  >
                    <Plus size={15} aria-hidden="true" />
                    intervalo
                  </button>
                )}
              </div>
            );
          })}
          {error ? (
            <small className={styles.error} role="alert">
              {error}
            </small>
          ) : null}
        </div>
      ) : null}
    </>
  );

}

function TimeField({
  label,
  value,
  readOnly,
  error,
  onChange,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  error?: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.required} aria-hidden="true">
          {" *"}
        </span>
        <span className="srOnly"> (obrigatório)</span>
      </span>
      <input
        type="time"
        value={value}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <small className={styles.error} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}
