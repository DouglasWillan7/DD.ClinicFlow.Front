import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  useConfirmDiscard,
  useUnsavedChangesGuard,
} from "../../app/unsavedChanges";
import type {
  ClinicMember,
  ClinicRole,
  DoctorSchedule,
  ScheduleDay,
  UpdateDoctorScheduleRequest,
} from "../../api/types";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
} from "../../auth/documentIdentity";
import { Button } from "../../components/Button";
import { InlineError, LoadingBlock } from "../../components/Feedback";
import { Field, SelectField, TextAreaField } from "../../components/Field";
import { InternationalPhoneField } from "../../components/InternationalPhoneField";
import { timeZoneLabel } from "../clinic/clinicTimeZone";
import {
  buildScheduleRequest,
  emptyScheduleDraft,
  scheduleToDraft,
  type ScheduleDraft,
} from "../clinic/scheduleForm";
import { ScheduleWeekEditor } from "../clinic/ScheduleWeekEditor";
import {
  clearDoctorData,
  createClinicMemberSchema,
  hasDoctorData,
  toClinicMemberFormValue,
  toClinicMemberPayload,
  type ClinicMemberFormValue,
  type ClinicMemberPayload,
} from "./memberFormModel";
import styles from "./ClinicMemberForm.module.css";

/**
 * Agenda semanal de quem já é médico na clínica. Sem esta prop (cadastro novo ou
 * integrante que ainda não é médico) o formulário parte de uma semana vazia.
 */
export type MemberScheduleSource =
  | { status: "loading" }
  | { status: "error"; retry(): void }
  | { status: "ready"; data?: DoctorSchedule };

const durationOptions = [15, 20, 30, 40, 45, 60, 90, 120];

const roles: Array<{
  value: ClinicRole;
  label: string;
  description: string;
}> = [
  {
    value: "Doctor",
    label: "Médico",
    description: "Agenda, atendimento e acesso clínico autorizado.",
  },
  {
    value: "Nurse",
    label: "Enfermagem",
    description: "Agenda, preparação e apoio ao atendimento.",
  },
  {
    value: "Secretary",
    label: "Secretaria",
    description: "Agenda e dados operacionais dos pacientes.",
  },
];

export function ClinicMemberForm({
  mode,
  member,
  initialRole,
  schedule,
  timeZone,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  member?: ClinicMember;
  initialRole?: ClinicRole;
  schedule?: MemberScheduleSource;
  /** Fuso da clínica, só para dizer em que horário a semana é interpretada. */
  timeZone?: string;
  pending: boolean;
  serverError?: string;
  onCancel(): void;
  /** `schedule` só vem quando a semana foi alterada; sem ele os horários ficam como estão. */
  onSubmit(payload: ClinicMemberPayload, schedule?: UpdateDoctorScheduleRequest): void;
}) {
  const [pendingRole, setPendingRole] = useState<Exclude<ClinicRole, "Doctor">>();
  const loadedSchedule = schedule?.status === "ready" ? schedule.data : undefined;
  const [syncedSchedule, setSyncedSchedule] = useState(loadedSchedule);
  const [draft, setDraft] = useState<ScheduleDraft>(() =>
    loadedSchedule ? scheduleToDraft(loadedSchedule) : emptyScheduleDraft(),
  );
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [scheduleError, setScheduleError] = useState<string>();
  // A agenda chega depois do formulário; quem já mexeu na semana não perde o rascunho.
  if (loadedSchedule !== syncedSchedule) {
    setSyncedSchedule(loadedSchedule);
    if (loadedSchedule && !scheduleDirty) setDraft(scheduleToDraft(loadedSchedule));
  }
  const scheduleReady = !schedule || schedule.status === "ready";
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ClinicMemberFormValue>({
    resolver: zodResolver(createClinicMemberSchema(mode)),
    defaultValues: {
      ...toClinicMemberFormValue(member),
      role: member?.role ?? initialRole ?? "Secretary",
    },
  });
  // Cancelar e os links do menu só descartam o que foi digitado após confirmação.
  useUnsavedChangesGuard(isDirty || scheduleDirty);
  const confirmDiscard = useConfirmDiscard();
  const [countryCode, documentType, role, durationValue] = useWatch({
    control,
    name: [
      "countryCode",
      "documentType",
      "role",
      "defaultAppointmentDurationMinutes",
    ],
  });
  // Duração gravada fora da lista (definida em Configurações) continua selecionável.
  const savedDuration = member?.doctorProfile?.defaultAppointmentDurationMinutes;
  const durations =
    savedDuration && !durationOptions.includes(savedDuration)
      ? [...durationOptions, savedDuration].sort((left, right) => left - right)
      : durationOptions;

  function changeDraft(
    day: ScheduleDay,
    transform: (intervals: ScheduleDraft[ScheduleDay]) => ScheduleDraft[ScheduleDay],
  ) {
    setDraft((current) => ({ ...current, [day]: transform(current[day]) }));
    setScheduleDirty(true);
    setScheduleError(undefined);
  }

  function submit(value: ClinicMemberFormValue) {
    const payload = toClinicMemberPayload(value, mode);
    if (value.role !== "Doctor" || !scheduleReady) {
      onSubmit(payload);
      return;
    }
    // Valida mesmo sem mudança na semana: uma duração maior pode deixar um período curto.
    const result = buildScheduleRequest(
      draft,
      Number(value.defaultAppointmentDurationMinutes),
    );
    if (!result.request) {
      setScheduleError(result.error);
      return;
    }
    setScheduleError(undefined);
    onSubmit(payload, scheduleDirty ? result.request : undefined);
  }

  function chooseRole(nextRole: ClinicRole) {
    const current = getValues();
    if (
      current.role === "Doctor" &&
      nextRole !== "Doctor" &&
      hasDoctorData(current)
    ) {
      setPendingRole(nextRole);
      return;
    }
    setValue("role", nextRole, { shouldDirty: true, shouldValidate: true });
  }

  function confirmRoleChange() {
    if (!pendingRole) return;
    reset(clearDoctorData(getValues(), pendingRole), { keepDirty: true });
    setPendingRole(undefined);
  }

  const country = register("countryCode", {
    onChange: (event) => {
      const nextCountry = event.target.value as string;
      const availableTypes = documentTypesFor(nextCountry);
      if (!availableTypes.some((type) => type.code === getValues("documentType"))) {
        setValue("documentType", availableTypes[0].code);
      }
    },
  });

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <header className={styles.heading}>
        <div>
          {/* No cadastro a linha de contexto já diz "Novo integrante". */}
          {mode === "edit" ? (
            <span className={styles.eyebrow}>Vínculo com a clínica</span>
          ) : null}
          <h2>{mode === "create" ? "Adicionar integrante" : "Editar vínculo"}</h2>
          <p>
            O papel define a hierarquia operacional. A administração é uma
            permissão independente.
          </p>
        </div>
      </header>

      {mode === "create" ? (
        <section className={styles.section} aria-labelledby="member-identity-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.step}>1</span>
            <div>
              <h3 id="member-identity-heading">Identificação</h3>
              <p>O documento localiza ou cria a pessoa sem usar e-mail como login.</p>
            </div>
          </div>
          <div className={styles.grid}>
            <Field
              className={styles.wide}
              label="Nome completo"
              autoComplete="name"
              error={errors.name?.message}
              {...register("name")}
            />
            <SelectField label="País do documento" {...country}>
              {documentCountries.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </SelectField>
            <SelectField label="Tipo de documento" {...register("documentType")}>
              {documentTypesFor(countryCode).map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </SelectField>
            <Field
              className={styles.wide}
              label="Documento"
              inputMode={countryCode === "BR" && documentType === "CPF" ? "numeric" : "text"}
              placeholder={documentPlaceholder(countryCode, documentType)}
              error={errors.document?.message}
              {...register("document")}
            />
          </div>
        </section>
      ) : (
        <section className={styles.identitySummary} aria-label="Identificação">
          <span className={styles.avatar} aria-hidden="true">
            {(member?.displayName ?? member?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{member?.displayName ?? "Nome não informado"}</strong>
            <small>A identidade e o documento não mudam neste vínculo.</small>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="member-context-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.step}>{mode === "create" ? "2" : "1"}</span>
          <div>
            <h3 id="member-context-heading">Dados nesta clínica</h3>
            <p>E-mail e telefone podem ser diferentes em cada clínica.</p>
          </div>
        </div>
        <div className={styles.grid}>
          <Field
            label="E-mail na clínica"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <InternationalPhoneField
                name={field.name}
                value={field.value}
                label="Telefone"
                countrySelectLabel="País ou região do telefone"
                hint="Armazenado em formato internacional: DDI, código de área e número."
                error={errors.phone?.message}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="member-access-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.step}>{mode === "create" ? "3" : "2"}</span>
          <div>
            <h3 id="member-access-heading">Papel e administração</h3>
            <p>Escolha exatamente um papel na hierarquia.</p>
          </div>
        </div>
        <fieldset className={styles.roleFieldset}>
          <legend className="srOnly">Papel na clínica</legend>
          {roles.map((option) => (
            <label key={option.value} className={styles.roleOption}>
              <input
                type="radio"
                name="clinic-role"
                value={option.value}
                checked={role === option.value}
                disabled={pending}
                onChange={() => chooseRole(option.value)}
              />
              <span className={styles.radioMark} aria-hidden="true" />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <label className={styles.adminOption}>
          <input
            type="checkbox"
            disabled={pending || member?.isOwner}
            {...register("isAdmin")}
          />
          <span className={styles.adminIcon} aria-hidden="true"><ShieldCheck /></span>
          <span>
            <strong>Administrador da clínica</strong>
            <small>Gerencia equipe e configurações; não concede acesso clínico.</small>
          </span>
        </label>
        {member?.isOwner ? (
          <p className={styles.ownerNote}>
            O proprietário precisa permanecer ativo e administrador da clínica.
          </p>
        ) : null}
      </section>

      {role === "Doctor" ? (
        <section className={styles.section} aria-labelledby="member-doctor-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.doctorIcon} aria-hidden="true"><Stethoscope /></span>
            <div>
              <h3 id="member-doctor-heading">Perfil médico nesta clínica</h3>
              <p>Registro e apresentação pertencem a este vínculo.</p>
            </div>
          </div>
          <div className={styles.grid}>
            <Field label="Conselho profissional" placeholder="CRM" {...register("professionalAuthority")} />
            <Field label="Número do registro" {...register("professionalRegistrationNumber")} />
            <Field label="Região do registro" placeholder="SP" {...register("professionalRegistrationRegion")} />
            <Field
              label="País do registro"
              maxLength={2}
              placeholder="BR"
              {...register("professionalRegistrationCountryCode")}
            />
            <Field className={styles.wide} label="Especialidade" {...register("specialty")} />
            <Field className={styles.wide} label="Áreas de atuação" {...register("practiceAreas")} />
            <TextAreaField
              className={styles.wide}
              label="Biografia profissional"
              rows={4}
              maxLength={600}
              {...register("bio")}
            />
          </div>
        </section>
      ) : null}

      {role === "Doctor" ? (
        <section className={styles.section} aria-labelledby="member-availability-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.doctorIcon} aria-hidden="true"><CalendarClock /></span>
            <div>
              <h3 id="member-availability-heading">Disponibilidade de atendimento</h3>
              <p>
                Semana padrão do médico nesta clínica
                {timeZone ? `, no fuso de ${timeZoneLabel(timeZone)}` : ""}. Ausências e
                férias são bloqueadas direto na Agenda.
              </p>
            </div>
          </div>
          <div className={styles.grid}>
            <SelectField
              label="Duração padrão da consulta"
              error={errors.defaultAppointmentDurationMinutes?.message}
              {...register("defaultAppointmentDurationMinutes", {
                onChange: () => setScheduleError(undefined),
              })}
            >
              <option value="">Selecionar</option>
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutos</option>
              ))}
            </SelectField>
          </div>
          {schedule?.status === "loading" ? (
            <LoadingBlock label="Carregando os horários de atendimento…" />
          ) : schedule?.status === "error" ? (
            <div className={styles.scheduleUnavailable}>
              <InlineError>
                Não foi possível carregar os horários. O restante do vínculo pode ser
                salvo normalmente.
              </InlineError>
              <Button type="button" variant="secondary" onClick={schedule.retry}>
                <RotateCcw size={16} aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <ScheduleWeekEditor
                draft={draft}
                duration={Number(durationValue) || 30}
                disabled={pending}
                onChange={changeDraft}
              />
              {mode === "create" || member?.status === "Pending" ? (
                <p className={styles.scheduleNote}>
                  Os horários passam a ser oferecidos na agenda quando o convite for aceito.
                </p>
              ) : member?.status !== "Active" ? (
                <p className={styles.scheduleNote}>
                  Os horários voltam a ser oferecidos na agenda quando o vínculo for reativado.
                </p>
              ) : null}
            </>
          )}
          {scheduleError ? <InlineError>{scheduleError}</InlineError> : null}
        </section>
      ) : null}

      {pendingRole ? (
        <section
          className={styles.confirmation}
          role="alertdialog"
          aria-labelledby="remove-doctor-data-title"
        >
          <div>
            <strong id="remove-doctor-data-title">Remover dados médicos?</strong>
            <p>
              Registro, especialidade, áreas, biografia e duração serão removidos
              deste vínculo ao alterar o papel.
            </p>
          </div>
          <div className={styles.confirmationActions}>
            <Button type="button" variant="secondary" onClick={() => setPendingRole(undefined)}>
              Manter como médico
            </Button>
            <Button type="button" variant="danger" onClick={confirmRoleChange}>
              Alterar e remover
            </Button>
          </div>
        </section>
      ) : null}

      {serverError ? <InlineError>{serverError}</InlineError> : null}

      <footer className={styles.actions}>
        <Button type="button" variant="secondary" disabled={pending}
          onClick={() => confirmDiscard(onCancel)}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Adicionar integrante" : "Salvar vínculo"}
        </Button>
      </footer>
    </form>
  );
}
