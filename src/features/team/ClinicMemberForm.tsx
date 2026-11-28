import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, IdCard, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  useConfirmDiscard,
  useUnsavedChangesGuard,
} from "../../app/unsavedChanges";
import type {
  ClinicMember,
  ClinicRole,
  HealthcarePlan,
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
import { DoctorPlansEditor } from "../clinic/DoctorPlansEditor";
import {
  type ClinicDraft,
  type DoctorDraft,
  doctorSelectedIds,
  isDoctorDirty,
} from "../clinic/healthcarePlansDraft";
import {
  buildScheduleRequest,
  emptyScheduleDraft,
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
 * Convênios oferecidos no cadastro de um médico, que parte do padrão da clínica. Sem esta
 * prop a seção de convênios não aparece. Depois do cadastro eles têm aba própria no
 * perfil do médico.
 */
export type MemberPlansSource =
  | { status: "loading" }
  | { status: "error"; retry(): void }
  | {
      status: "ready";
      catalog: HealthcarePlan[];
      /** Convênios aceitos e padrão salvos na clínica: o teto da lista do médico. */
      clinic: ClinicDraft;
    };

const clinicDefaultPlans: DoctorDraft = { mode: "ClinicDefault", planIds: [] };

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
  plans,
  timeZone,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  member?: ClinicMember;
  initialRole?: ClinicRole;
  plans?: MemberPlansSource;
  /** Fuso da clínica, só para dizer em que horário a semana é interpretada. */
  timeZone?: string;
  pending: boolean;
  serverError?: string;
  onCancel(): void;
  /**
   * `schedule` e `plans` só existem no cadastro e só vêm quando foram alterados; na
   * edição a disponibilidade e os convênios são abas do perfil, com salvar próprio.
   */
  onSubmit(
    payload: ClinicMemberPayload,
    schedule?: UpdateDoctorScheduleRequest,
    plans?: DoctorDraft,
  ): void;
}) {
  const [pendingRole, setPendingRole] = useState<Exclude<ClinicRole, "Doctor">>();
  // A semana e os convênios só entram no cadastro: no perfil do médico são abas.
  const withScheduling = mode === "create";
  const [draft, setDraft] = useState<ScheduleDraft>(emptyScheduleDraft);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [scheduleError, setScheduleError] = useState<string>();
  // Sem rascunho a seção mostra o padrão da clínica; ele só nasce quando alguém mexe.
  const [plansDraft, setPlansDraft] = useState<DoctorDraft | null>(null);
  const readyPlans = withScheduling && plans?.status === "ready" ? plans : undefined;
  const currentPlans = plansDraft ?? clinicDefaultPlans;
  const plansDirty = Boolean(
    readyPlans && isDoctorDirty(currentPlans, clinicDefaultPlans, readyPlans.clinic),
  );
  // Na edição a duração mora na aba Disponibilidade e segue gravada no vínculo. Aqui ela
  // só aparece quando falta para o vínculo ser de médico: promoção a médico ou dados
  // médicos removidos neste formulário.
  const [doctorDataCleared, setDoctorDataCleared] = useState(false);
  const durationInProfile =
    mode === "edit" &&
    (!member?.doctorProfile?.defaultAppointmentDurationMinutes || doctorDataCleared);
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
  useUnsavedChangesGuard(isDirty || scheduleDirty || plansDirty);
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
    if (!withScheduling || value.role !== "Doctor") {
      onSubmit(payload);
      return;
    }
    // Convênios só vão junto quando mudaram, já limitados ao que a clínica aceita.
    const plansRequest: DoctorDraft | undefined =
      readyPlans && plansDirty
        ? {
            mode: currentPlans.mode,
            planIds:
              currentPlans.mode === "Custom"
                ? doctorSelectedIds(currentPlans, readyPlans.clinic)
                : [],
          }
        : undefined;
    const send = (scheduleRequest?: UpdateDoctorScheduleRequest) =>
      plansRequest
        ? onSubmit(payload, scheduleRequest, plansRequest)
        : scheduleRequest
          ? onSubmit(payload, scheduleRequest)
          : onSubmit(payload);
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
    send(scheduleDirty ? result.request : undefined);
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
    setDoctorDataCleared(true);
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
          <h2>{mode === "create" ? "Adicionar integrante" : "Editar vínculo"}</h2>
          <p>
            O papel define a hierarquia operacional. A administração é uma
            permissão independente.
            {/* Na edição a identidade está no cabeçalho do perfil, logo acima. */}
            {mode === "edit"
              ? " A identidade e o documento não mudam neste vínculo."
              : null}
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
      ) : null}

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
            {durationInProfile ? (
              <SelectField
                label="Duração padrão da consulta"
                hint="Os horários de atendimento ficam na aba Disponibilidade, depois de salvar."
                error={errors.defaultAppointmentDurationMinutes?.message}
                {...register("defaultAppointmentDurationMinutes")}
              >
                <option value="">Selecionar</option>
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutos</option>
                ))}
              </SelectField>
            ) : null}
          </div>
        </section>
      ) : null}

      {withScheduling && role === "Doctor" ? (
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
              {durationOptions.map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutos</option>
              ))}
            </SelectField>
          </div>
          <ScheduleWeekEditor
            draft={draft}
            duration={Number(durationValue) || 30}
            disabled={pending}
            onChange={changeDraft}
          />
          <p className={styles.scheduleNote}>
            Os horários passam a ser oferecidos na agenda quando o convite for aceito.
          </p>
          {scheduleError ? <InlineError>{scheduleError}</InlineError> : null}
        </section>
      ) : null}

      {withScheduling && role === "Doctor" && plans ? (
        <section className={styles.section} aria-labelledby="member-plans-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.doctorIcon} aria-hidden="true"><IdCard /></span>
            <div>
              <h3 id="member-plans-heading">Convênios</h3>
              <p>
                Quais convênios o médico atende nesta clínica. É a lista oferecida ao
                agendar uma consulta com ele.
              </p>
            </div>
          </div>
          {plans.status === "loading" ? (
            <LoadingBlock label="Carregando os convênios…" />
          ) : plans.status === "error" ? (
            <div className={styles.scheduleUnavailable}>
              <InlineError>
                Não foi possível carregar os convênios. O restante do vínculo pode ser
                salvo normalmente.
              </InlineError>
              <Button type="button" variant="secondary" onClick={plans.retry}>
                <RotateCcw size={16} aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <DoctorPlansEditor
                doctorName="este médico"
                plans={plans.catalog}
                clinic={plans.clinic}
                draft={currentPlans}
                savedCustomPlanIds={null}
                disabled={pending}
                listHeadingAs="h4"
                onChange={setPlansDraft}
              />
              <p className={styles.scheduleNote}>
                Os convênios passam a ser oferecidos na agenda quando o convite for aceito.
              </p>
            </>
          )}
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
