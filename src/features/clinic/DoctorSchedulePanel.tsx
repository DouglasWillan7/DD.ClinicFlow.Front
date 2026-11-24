import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useState } from "react";
import { ApiError } from "../../api/client";
import type { DoctorSchedule, ScheduleDay } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import {
  ErrorBlock,
  InlineError,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { Field } from "../../components/Field";
import { onboardingKey } from "../onboarding/onboarding";
import {
  buildScheduleRequest,
  scheduleToDraft,
  type ScheduleDraft,
} from "./scheduleForm";
import { ScheduleWeekEditor } from "./ScheduleWeekEditor";
import styles from "./DoctorSchedulePanel.module.css";

interface PanelCopy {
  eyebrow?: string;
  title: string;
  description: string;
  /** Campo extra ao lado da duração, como o seletor de médico da administração. */
  headerField?: ReactNode;
}

/**
 * Cartão da disponibilidade semanal de um médico, com o próprio salvar. É o mesmo em
 * Configurações › Disponibilidade e em Meu perfil. Quem troca de médico remonta o
 * cartão com `key`, para o rascunho de um não vazar para o outro.
 */
export function DoctorSchedulePanel({
  doctorId,
  ...copy
}: PanelCopy & { doctorId: string }) {
  const { request } = useAuth();
  const schedule = useQuery({
    queryKey: ["doctor-schedule", doctorId],
    queryFn: () => request<DoctorSchedule>(`/doctors/${doctorId}/schedule`),
  });

  if (schedule.isLoading) {
    return <LoadingBlock label="Carregando os horários de atendimento…" />;
  }
  if (schedule.isError || !schedule.data) {
    return (
      <ErrorBlock
        message="Não foi possível carregar a configuração da agenda."
        retry={() => void schedule.refetch()}
      />
    );
  }
  return <ScheduleForm doctorId={doctorId} initial={schedule.data} {...copy} />;
}

function ScheduleForm({
  doctorId,
  initial,
  eyebrow,
  title,
  description,
  headerField,
}: PanelCopy & { doctorId: string; initial: DoctorSchedule }) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState(initial.slotDurationMinutes);
  const [draft, setDraft] = useState<ScheduleDraft>(() => scheduleToDraft(initial));
  const [validationError, setValidationError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (payload: ReturnType<typeof buildScheduleRequest>["request"]) =>
      request<DoctorSchedule>(`/doctors/${doctorId}/schedule`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onMutate: () => {
      setSaved(false);
      setValidationError(undefined);
    },
    onSuccess: (value) => {
      queryClient.setQueryData(["doctor-schedule", doctorId], value);
      setDuration(value.slotDurationMinutes);
      setDraft(scheduleToDraft(value));
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      void queryClient.invalidateQueries({ queryKey: ["availability", doctorId] });
    },
  });

  function changeDraft(
    day: ScheduleDay,
    transform: (intervals: ScheduleDraft[ScheduleDay]) => ScheduleDraft[ScheduleDay],
  ) {
    setDraft((current) => ({ ...current, [day]: transform(current[day]) }));
    setSaved(false);
    setValidationError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildScheduleRequest(draft, duration);
    if (!result.request) {
      setValidationError(result.error);
      setSaved(false);
      return;
    }
    save.mutate(result.request);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className={styles.headerFields}>
            {headerField}
            <Field
              id="schedule-duration"
              label="Duração da consulta (minutos)"
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(event) => {
                setDuration(event.target.valueAsNumber);
                setSaved(false);
                setValidationError(undefined);
              }}
            />
          </div>
        </header>

        <ScheduleWeekEditor
          className={styles.week}
          draft={draft}
          duration={duration}
          onChange={changeDraft}
        />

        <footer className={styles.actions}>
          <div className={styles.feedback} aria-live="polite">
            {validationError ? <InlineError>{validationError}</InlineError> : null}
            {save.isError ? (
              <InlineError>
                {save.error instanceof ApiError
                  ? save.error.message
                  : "Não foi possível salvar. Seus horários continuam nesta tela."}
              </InlineError>
            ) : null}
            {saved ? <SuccessNote>Disponibilidade atualizada.</SuccessNote> : null}
          </div>
          <Button type="submit" loading={save.isPending}>
            Salvar disponibilidade
          </Button>
        </footer>
      </section>
    </form>
  );
}
