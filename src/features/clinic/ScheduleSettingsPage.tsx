import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Plus, Trash2, UserRoundPlus } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { Clinic, DoctorSchedule, Member, ScheduleDay } from "../../api/types";
import { Link } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { Field, SelectField } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { onboardingKey } from "../onboarding/onboarding";
import {
  buildScheduleRequest,
  emptyScheduleDraft,
  scheduleDays,
  scheduleToDraft,
  suggestedInterval,
  type ScheduleDraft,
} from "./scheduleForm";
import styles from "./ScheduleSettingsPage.module.css";

const clinicKey = ["clinic", "current"] as const;

function displayTimeZone(timeZoneId: string) {
  return timeZoneId.replaceAll("_", " ").replace("America/", "");
}

export function ScheduleSettingsPage() {
  const { request, session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [duration, setDuration] = useState(30);
  const [draft, setDraft] = useState<ScheduleDraft>(emptyScheduleDraft);
  const [validationError, setValidationError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const initializedDoctor = useRef<string | undefined>(undefined);
  const isAdmin = session?.isAdmin === true;

  const clinic = useQuery({
    queryKey: clinicKey,
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const members = useQuery({
    queryKey: ["clinic", "members"],
    enabled: Boolean(isAdmin && session?.clinicId),
    queryFn: () =>
      request<Member[]>(`/clinics/${session!.clinicId}/members/summary`),
  });
  const doctors = useMemo(
    () => (members.data ?? []).filter((member) => member.role === "Doctor"),
    [members.data],
  );
  const preferredDoctor = doctors.find(
    (doctor) => doctor.userId === session?.userId,
  ) ?? doctors[0];
  const doctorId = isAdmin
    ? doctors.some((doctor) => doctor.userId === selectedDoctorId)
      ? selectedDoctorId
      : preferredDoctor?.userId ?? ""
    : session?.clinicRole === "Doctor"
      ? session.userId
      : "";

  function selectDoctor(nextDoctorId: string) {
    initializedDoctor.current = undefined;
    setDraft(emptyScheduleDraft());
    setDuration(30);
    setValidationError(undefined);
    setSaved(false);
    setSelectedDoctorId(nextDoctorId);
  }

  const schedule = useQuery({
    queryKey: ["doctor-schedule", doctorId],
    enabled: Boolean(doctorId),
    queryFn: () => request<DoctorSchedule>(`/doctors/${doctorId}/schedule`),
  });

  useEffect(() => {
    if (!schedule.data || initializedDoctor.current === doctorId) return;
    setDuration(schedule.data.slotDurationMinutes);
    setDraft(scheduleToDraft(schedule.data));
    initializedDoctor.current = doctorId;
  }, [doctorId, schedule.data]);

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
      initializedDoctor.current = doctorId;
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

  const selectedDoctor = isAdmin
    ? doctors.find((doctor) => doctor.userId === doctorId)
    : session?.clinicRole === "Doctor"
      ? { displayName: session.name ?? "Seu perfil médico" }
      : undefined;
  const waitingForDoctors = isAdmin && members.isLoading;
  const noDoctors = isAdmin && !members.isLoading && doctors.length === 0;
  const loading = clinic.isLoading || waitingForDoctors || (doctorId && schedule.isLoading);
  const loadingError = clinic.isError || members.isError || schedule.isError;

  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Disponibilidade de atendimento"
        description="Defina a semana padrão do médico nesta clínica. Ausências e férias continuam sendo bloqueadas diretamente na Agenda."
      />
      <div className={styles.content}>
        {loading ? (
          <LoadingBlock label="Carregando os horários de atendimento…" />
        ) : loadingError ? (
          <ErrorBlock
            message="Não foi possível carregar a configuração da agenda."
            retry={() => {
              void clinic.refetch();
              if (isAdmin) void members.refetch();
              if (doctorId) void schedule.refetch();
            }}
          />
        ) : noDoctors ? (
          <section className={styles.emptyState}>
            <UserRoundPlus size={24} aria-hidden="true" />
            <div>
              <h2>Adicione um médico antes de configurar horários</h2>
              <p>A disponibilidade sempre pertence ao vínculo do médico com esta clínica.</p>
            </div>
            <Link to="/app/equipe/novo">Adicionar médico</Link>
          </section>
        ) : doctorId && schedule.data ? (
          <form className={styles.form} onSubmit={submit} noValidate>
            <section className={styles.configurationPanel}>
              <header className={styles.configurationHeader}>
                <div>
                  <span className={styles.contextLabel}>Agenda semanal</span>
                  <h2>{selectedDoctor?.displayName ?? "Médico selecionado"}</h2>
                  <p>
                    Horários interpretados no fuso de {displayTimeZone(clinic.data?.timeZoneId ?? "America/Sao_Paulo")}.
                  </p>
                </div>
                <div className={styles.headerFields}>
                  {isAdmin && doctors.length > 1 ? (
                    <SelectField
                      id="schedule-doctor"
                      label="Médico"
                      value={doctorId}
                      onChange={(event) => selectDoctor(event.target.value)}
                    >
                      {doctors.map((doctor) => (
                        <option key={doctor.userId} value={doctor.userId}>
                          {doctor.displayName}
                        </option>
                      ))}
                    </SelectField>
                  ) : null}
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

              <div className={styles.week}>
                {scheduleDays.map((day) => {
                  const intervals = draft[day.value];
                  const enabled = intervals.length > 0;
                  return (
                    <section className={styles.dayRow} key={day.value}>
                      <label className={styles.dayToggle}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) =>
                            changeDraft(day.value, () =>
                              event.target.checked
                                ? [suggestedInterval([], duration)]
                                : [],
                            )
                          }
                        />
                        <span>
                          <strong>{day.label}</strong>
                          <small>{enabled ? `${intervals.length} período${intervals.length === 1 ? "" : "s"}` : "Sem atendimento"}</small>
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
                                  aria-label={`${day.label}, período ${index + 1}, início`}
                                  onChange={(event) =>
                                    changeDraft(day.value, (current) =>
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
                                  aria-label={`${day.label}, período ${index + 1}, fim`}
                                  onChange={(event) =>
                                    changeDraft(day.value, (current) =>
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
                                aria-label={`Remover período ${index + 1} de ${day.label}`}
                                onClick={() =>
                                  changeDraft(day.value, (current) =>
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
                            onClick={() =>
                              changeDraft(day.value, (current) => [
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

              <footer className={styles.actions}>
                <div className={styles.feedback} aria-live="polite">
                  {validationError ? <p role="alert">{validationError}</p> : null}
                  {save.isError ? (
                    <p role="alert">
                      {save.error instanceof ApiError
                        ? save.error.message
                        : "Não foi possível salvar. Seus horários continuam nesta tela."}
                    </p>
                  ) : null}
                  {saved ? <SuccessNote>Disponibilidade atualizada.</SuccessNote> : null}
                </div>
                <Button type="submit" loading={save.isPending}>
                  Salvar disponibilidade
                </Button>
              </footer>
            </section>
          </form>
        ) : null}
      </div>
    </>
  );
}
