import { X } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { BodyAssessment } from "../../api/types";
import { Button } from "../../components/Button";
import {
  emptyDraft,
  fieldLabel,
  parseAssessmentDraft,
  todayIso,
  type AssessmentDraft,
  type DraftErrors,
  type MeasurementPayload,
} from "./assessmentForm";
import {
  measurementInputOrder,
  measurementUnits,
  measurementValue,
} from "./bodyAssessments";
import { formatMetricValue } from "./assessmentMetrics";
import { formatDateOnly } from "./patientFormatters";
import styles from "./PatientAssessmentsPage.module.css";

export interface NewAssessmentDialogProps {
  open: boolean;
  patientName: string;
  /** Última avaliação: alimenta a referência mostrada em cada campo. */
  previous: BodyAssessment | null;
  previousHeightCm: number | null;
  pending: boolean;
  serverError: string | null;
  onClose(): void;
  onSubmit(payload: { assessedOn: string; measurements: MeasurementPayload[] }): void;
}

const noErrors: DraftErrors = { fields: {} };

export function NewAssessmentDialog({
  open,
  patientName,
  previous,
  previousHeightCm,
  pending,
  serverError,
  onClose,
  onSubmit,
}: NewAssessmentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [assessedOn, setAssessedOn] = useState(todayIso);
  const [draft, setDraft] = useState<AssessmentDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>(noErrors);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      if (!wasOpenRef.current) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setAssessedOn(todayIso());
        setDraft(emptyDraft);
        setErrors(noErrors);
      }
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      dateRef.current?.focus();
    } else if (wasOpenRef.current) {
      if (dialog?.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = parseAssessmentDraft(assessedOn, draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(noErrors);
    onSubmit({ assessedOn, measurements: result.measurements });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function referenceFor(type: (typeof measurementInputOrder)[number]) {
    const value =
      type === "Altura"
        ? (measurementValue(previous, "Altura") ?? previousHeightCm)
        : measurementValue(previous, type);
    if (value === null) return null;
    return `${formatMetricValue(value)} ${measurementUnits[type]}`;
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="nova-avaliacao-titulo"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <form className={styles.dialogPanel} onSubmit={handleSubmit} noValidate>
        <header className={styles.dialogHeader}>
          <h2 id="nova-avaliacao-titulo" className={styles.dialogTitle}>
            Nova avaliação
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            aria-label="Fechar nova avaliação"
          >
            <X size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </header>

        <p className={styles.dialogNote}>
          Paciente: {patientName}
          {previous
            ? ` · última avaliação em ${formatDateOnly(previous.assessedOn)}`
            : " · primeira avaliação"}
          . Campos em branco não são registrados nesta data.
        </p>

        <div className={styles.dialogDate}>
          <label htmlFor="assessedOn">Data da avaliação</label>
          <input
            ref={dateRef}
            id="assessedOn"
            name="assessedOn"
            type="date"
            value={assessedOn}
            max={todayIso()}
            aria-invalid={Boolean(errors.assessedOn)}
            aria-describedby={errors.assessedOn ? "assessedOn-error" : undefined}
            onChange={(event) => setAssessedOn(event.target.value)}
          />
          {errors.assessedOn ? (
            <small id="assessedOn-error" className={styles.fieldError}>
              {errors.assessedOn}
            </small>
          ) : null}
        </div>

        <div className={styles.dialogGrid}>
          {measurementInputOrder.map((type) => {
            const error = errors.fields[type];
            const reference = referenceFor(type);
            const describedBy = error
              ? `${type}-error`
              : reference
                ? `${type}-hint`
                : undefined;

            return (
              <div key={type} className={styles.measureField}>
                <label htmlFor={type}>{fieldLabel(type)}</label>
                <div className={styles.measureInput}>
                  <input
                    id={type}
                    name={type}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft[type]}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [type]: event.target.value,
                      }))
                    }
                  />
                  <span aria-hidden="true">{measurementUnits[type]}</span>
                </div>
                {error ? (
                  <small id={`${type}-error`} className={styles.fieldError}>
                    {error}
                  </small>
                ) : reference ? (
                  <small id={`${type}-hint`}>Anterior: {reference}</small>
                ) : null}
              </div>
            );
          })}
        </div>

        {errors.summary || serverError ? (
          <p className={styles.formError} role="alert">
            {errors.summary ?? serverError}
          </p>
        ) : null}

        <footer className={styles.dialogFooter}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar avaliação
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
