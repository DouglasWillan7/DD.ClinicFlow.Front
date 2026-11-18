import { useId, useState, type FormEvent } from "react";
import type { BodyAssessment } from "../../api/types";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
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

/**
 * O formulário só existe enquanto o diálogo está aberto: cada abertura começa
 * com a data de hoje e os campos vazios, sem efeito para limpar o estado.
 */
export function NewAssessmentDialog(props: NewAssessmentDialogProps) {
  return props.open ? <NewAssessmentForm {...props} /> : null;
}

function NewAssessmentForm({
  patientName,
  previous,
  previousHeightCm,
  pending,
  serverError,
  onClose,
  onSubmit,
}: NewAssessmentDialogProps) {
  const formId = useId();
  const [assessedOn, setAssessedOn] = useState(todayIso);
  const [draft, setDraft] = useState<AssessmentDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>(noErrors);

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

  function referenceFor(type: (typeof measurementInputOrder)[number]) {
    const value =
      type === "Altura"
        ? (measurementValue(previous, "Altura") ?? previousHeightCm)
        : measurementValue(previous, type);
    if (value === null) return null;
    return `${formatMetricValue(value)} ${measurementUnits[type]}`;
  }

  return (
    <Dialog
      size="lg"
      title="Nova avaliação"
      description={`Paciente: ${patientName}${
        previous
          ? ` · última avaliação em ${formatDateOnly(previous.assessedOn)}`
          : " · primeira avaliação"
      }. Campos em branco não são registrados nesta data.`}
      closeLabel="Fechar nova avaliação"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            Salvar avaliação
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} onSubmit={handleSubmit} noValidate>
        <Field
          className={styles.dialogDate}
          label="Data da avaliação"
          name="assessedOn"
          type="date"
          autoFocus
          value={assessedOn}
          max={todayIso()}
          error={errors.assessedOn}
          onChange={(event) => setAssessedOn(event.target.value)}
        />

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

      </form>
    </Dialog>
  );
}
