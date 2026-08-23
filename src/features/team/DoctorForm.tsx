import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import {
  cloneElement,
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { HealthInsurancePlan } from "../../api/types";
import { formatCpf } from "../patients/patientFormatters";
import {
  brazilianStates,
  doctorSchema,
  durationOptions,
  formatPhone,
  genderOptions,
  getChecklist,
  getCompletionPercent,
  getDoctorInitials,
  getSummaryName,
  getSummarySubtitle,
  specialtyOptions,
  type DoctorFormValue,
} from "./doctorRegistration";
import {
  DoctorScheduleDetail,
  DoctorScheduleFields,
  type DoctorScheduleValue,
} from "./DoctorScheduleFields";
import styles from "./DoctorForm.module.css";

/** Evita repetir `readOnly` nos onze campos do formulário. */
const ReadOnlyContext = createContext(false);

/** "salvar" fica na tela; "agenda" leva ao detalhe do médico com a agenda aberta. */
export type DoctorSubmitIntent = "salvar" | "agenda";

interface DoctorFormProps {
  breadcrumb: ReactNode;
  initialValue: DoctorFormValue;
  plans: HealthInsurancePlan[];
  primaryLabel: string;
  scheduleLabel: string;
  /** Ação outline do card de resumo — o convite de acesso, ausente quando não se aplica. */
  inviteAction?: { label: string; onClick: () => void; disabled?: boolean };
  onSubmit: (value: DoctorFormValue, intent: DoctorSubmitIntent) => void;
  /** Devolve o estado que substitui o formulário — o handoff limpa até os dias pré-marcados. */
  onDiscard: () => DoctorFormValue;
  /** Qualquer edição esconde o banner "Médico salvo". */
  onDirty?: () => void;
  pending: boolean;
  serverError: string | null;
  banner?: ReactNode;
  emailReadOnly?: boolean;
  /** Detalhe do médico para quem não pode editar: mostra o cadastro sem ações de escrita. */
  readOnly?: boolean;
}

export function DoctorForm({
  breadcrumb,
  initialValue,
  plans,
  primaryLabel,
  scheduleLabel,
  inviteAction,
  onSubmit,
  onDiscard,
  onDirty,
  pending,
  serverError,
  banner,
  emailReadOnly = false,
  readOnly = false,
}: DoctorFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DoctorFormValue>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      ...initialValue,
      cpf: formatCpf(initialValue.cpf),
      phone: formatPhone(initialValue.phone),
    },
  });

  // O resumo reage a cada tecla, como no protótipo.
  const current = useWatch({ control }) as DoctorFormValue;
  const percent = getCompletionPercent(current);
  const checklist = getChecklist(current);

  const schedule: DoctorScheduleValue = {
    mode: current.scheduleMode,
    days: current.days,
    startTime: current.startTime,
    endTime: current.endTime,
    intervals: current.intervals,
  };

  function applySchedule(next: DoctorScheduleValue) {
    onDirty?.();
    setValue("scheduleMode", next.mode, { shouldValidate: true });
    setValue("days", next.days, { shouldValidate: true });
    setValue("startTime", next.startTime, { shouldValidate: true });
    setValue("endTime", next.endTime, { shouldValidate: true });
    setValue("intervals", next.intervals, { shouldValidate: true });
  }

  const cpf = register("cpf", {
    onChange: (event) =>
      setValue("cpf", formatCpf(event.target.value), { shouldValidate: true }),
  });
  const phone = register("phone", {
    onChange: (event) =>
      setValue("phone", formatPhone(event.target.value), {
        shouldValidate: true,
      }),
  });

  /** Qual botão submeteu decide o destino; o próprio evento diz, sem estado extra. */
  function readIntent(event?: React.BaseSyntheticEvent): DoctorSubmitIntent {
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter;
    return submitter?.dataset.intent === "agenda" ? "agenda" : "salvar";
  }

  /** Pills são botões: o onChange do form não os alcança. */
  function togglePill<T>(change: (next: T) => void, next: T) {
    onDirty?.();
    change(next);
  }

  return (
    <ReadOnlyContext value={readOnly}>
    <form
      className={styles.layout}
      onSubmit={handleSubmit((value, event) => onSubmit(value, readIntent(event)))}
      onChange={() => onDirty?.()}
      noValidate
    >
      <div className={styles.contextRow}>
        {breadcrumb}
        <div className={styles.contextSpacer} />
        {readOnly ? null : (
          <>
            <button
              type="button"
              className={styles.discard}
              onClick={() => {
                reset(onDiscard());
              }}
            >
              Descartar
            </button>
            <button
              type="submit"
              data-intent="salvar"
              className={styles.primary}
              disabled={pending}
            >
              {pending ? "Salvando…" : primaryLabel}
            </button>
          </>
        )}
      </div>

      {banner}

      <div className={styles.columns}>
        <div className={styles.formColumn}>
          <section className={styles.card}>
            <h2>Dados pessoais</h2>
            <div className={styles.grid}>
              <Labelled
                className={styles.spanTwo}
                label="Nome completo"
                required
                error={errors.name?.message}
              >
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Como está no registro do conselho"
                  {...register("name")}
                />
              </Labelled>
              <Labelled label="CPF" required error={errors.cpf?.message}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  {...cpf}
                />
              </Labelled>
              <Labelled label="Nascimento" error={errors.birthDate?.message}>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  {...register("birthDate")}
                />
              </Labelled>
              <Labelled label="Celular" required error={errors.phone?.message}>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={16}
                  placeholder="(00) 00000-0000"
                  {...phone}
                />
              </Labelled>
              <Labelled label="E-mail" required error={errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="nome@clinica.com"
                  readOnly={emailReadOnly}
                  {...register("email")}
                />
              </Labelled>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <fieldset className={styles.pillField}>
                    <legend>Sexo</legend>
                    <div className={styles.pills}>
                      {genderOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={styles.pill}
                          aria-pressed={field.value === option}
                          disabled={readOnly}
                          onClick={() =>
                            togglePill(
                              field.onChange,
                              field.value === option ? "" : option,
                            )
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2>Registro profissional</h2>
            <div className={styles.grid}>
              <Labelled
                label="CRM"
                required
                error={errors.medicalLicense?.message}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={30}
                  placeholder="000000"
                  {...register("medicalLicense")}
                />
              </Labelled>
              <Labelled
                label="UF do CRM"
                required
                error={errors.medicalLicenseState?.message}
              >
                <select {...register("medicalLicenseState")}>
                  <option value="">Selecionar</option>
                  {brazilianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="RQE" optional error={errors.rqe?.message}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="00000"
                  {...register("rqe")}
                />
              </Labelled>
              <Labelled
                label="Especialidade"
                required
                error={errors.specialty?.message}
              >
                <select {...register("specialty")}>
                  <option value="">Selecionar</option>
                  {specialtyOptions.map((specialty) => (
                    <option key={specialty} value={specialty}>
                      {specialty}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled
                className={styles.spanTwo}
                label="Áreas de atuação"
                optional
                error={errors.practiceAreas?.message}
              >
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Doença do refluxo, endoscopia terapêutica, doenças inflamatórias intestinais"
                  {...register("practiceAreas")}
                />
              </Labelled>
              <Labelled
                className={styles.wide}
                label="Miniapresentação"
                note="exibida ao paciente"
                error={errors.bio?.message}
              >
                <textarea
                  rows={3}
                  maxLength={600}
                  placeholder="Formação, tempo de experiência e foco de atendimento, em 2 ou 3 frases."
                  {...register("bio")}
                />
              </Labelled>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Atendimento</h2>
            <div className={styles.grid}>
              <Controller
                control={control}
                name="scheduleMode"
                render={() => (
                  <DoctorScheduleFields
                    value={schedule}
                    readOnly={readOnly}
                    errors={{
                      days: errors.days?.message,
                      startTime: errors.startTime?.message,
                      endTime: errors.endTime?.message,
                    }}
                    onChange={applySchedule}
                  />
                )}
              />
              <Labelled
                label="Duração da consulta"
                required
                error={errors.slotDurationMinutes?.message}
              >
                <select {...register("slotDurationMinutes")}>
                  <option value="">Selecionar</option>
                  {durationOptions.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </Labelled>
              <DoctorScheduleDetail
                value={schedule}
                readOnly={readOnly}
                error={errors.intervals?.message}
                onChange={applySchedule}
              />
              <Controller
                control={control}
                name="healthInsurancePlanIds"
                render={({ field }) => (
                  <fieldset className={`${styles.pillField} ${styles.wide}`}>
                    <legend>Convênios atendidos</legend>
                    <div className={styles.pills}>
                      {plans.map((plan) => {
                        const selected = field.value.includes(plan.id);
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            className={styles.pill}
                            aria-pressed={selected}
                            disabled={readOnly}
                            onClick={() =>
                              togglePill(
                                field.onChange,
                                selected
                                  ? field.value.filter((item) => item !== plan.id)
                                  : [...field.value, plan.id],
                              )
                            }
                          >
                            {plan.name}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              />
            </div>
          </section>

          {serverError ? (
            <p className={styles.serverError} role="alert">
              {serverError}
            </p>
          ) : null}
        </div>

        <aside className={styles.summaryColumn} aria-label="Resumo do cadastro">
          <section className={styles.summaryCard}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">
                {getDoctorInitials(current.name ?? "")}
              </span>
              <span className={styles.identityText}>
                <strong>{getSummaryName(current.name ?? "")}</strong>
                <small>{getSummarySubtitle(current)}</small>
              </span>
            </div>

            <div className={styles.progressLabel}>
              <span>Cadastro</span>
              <span className={styles.progressValue}>{percent}% completo</span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do cadastro"
            >
              <span
                className={styles.progressFill}
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>

            <ul className={styles.checklist}>
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className={item.done ? styles.checklistDone : undefined}
                >
                  {item.done ? (
                    <span className={styles.checkIcon} aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className={styles.pendingIcon} aria-hidden="true" />
                  )}
                  <span>
                    {item.label}
                    <span className="srOnly">
                      {item.done ? " — concluído" : " — pendente"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.actionsCard}>
            {readOnly ? (
              <p className={styles.actionsNote}>
                Somente a administração da clínica edita este cadastro. O próprio
                médico ajusta os dados em Meu perfil.
              </p>
            ) : (
              <button
                type="submit"
                data-intent="agenda"
                className={styles.primary}
                disabled={pending}
              >
                {scheduleLabel}
              </button>
            )}
            {inviteAction ? (
              <>
                <button
                  type="button"
                  className={styles.outline}
                  disabled={inviteAction.disabled}
                  onClick={inviteAction.onClick}
                >
                  {inviteAction.label}
                </button>
                <p className={styles.actionsNote}>
                  O médico ativa o acesso pelo link do convite e completa a
                  própria agenda.
                </p>
              </>
            ) : null}
          </section>
        </aside>
      </div>
    </form>
    </ReadOnlyContext>
  );
}

function Labelled({
  label,
  required,
  optional,
  note,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  note?: string;
  error?: string;
  className?: string;
  children: ReactElement<{
    id?: string;
    name?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    readOnly?: boolean;
    disabled?: boolean;
  }>;
}) {
  const readOnly = useContext(ReadOnlyContext);
  const errorId = error ? `${children.props.name}-error` : undefined;
  return (
    <label className={[styles.field, className].filter(Boolean).join(" ")}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? (
          <>
            <span className={styles.required} aria-hidden="true">
              {" *"}
            </span>
            <span className="srOnly"> (obrigatório)</span>
          </>
        ) : null}
        {optional ? <span className={styles.soft}> (opcional)</span> : null}
        {note ? <span className={styles.soft}> ({note})</span> : null}
      </span>
      {cloneElement(children, {
        "aria-invalid": Boolean(error),
        "aria-describedby": errorId,
        // `readOnly` não vale para select: ali o jeito de travar é desabilitar.
        ...(readOnly
          ? { readOnly: true, disabled: children.type === "select" }
          : {}),
      })}
      {error ? (
        <small id={errorId} className={styles.error} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}
