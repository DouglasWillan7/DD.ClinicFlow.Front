import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Member } from "../../api/types";
import { Field, SelectField } from "../../components/Field";
import { bloodTypeOptions, formatCpf } from "./patientFormatters";
import { patientSchema, type PatientFormValue } from "./patientForm";
import { PatientPhoneField } from "./PatientPhoneField";
import styles from "./PatientRegistrationForm.module.css";

interface PatientRegistrationFormProps {
  initialValue: PatientFormValue;
  doctors: Member[];
  onSubmit: (value: PatientFormValue) => void;
  onCancel: () => void;
  onResetServerError?: () => void;
  pending: boolean;
  serverError: string | null;
}

const steps = [
  {
    label: "Identificação",
    title: "Identifique o paciente",
    description: "Comece pelos dados usados para localizar e contatar a pessoa.",
  },
  {
    label: "Dados clínicos",
    title: "Dados clínicos",
    description: "Complete o que estiver disponível. Estes dados podem ser editados depois.",
  },
  {
    label: "Atendimento",
    title: "Organize o atendimento",
    description: "Defina o médico responsável e registre observações úteis para a equipe.",
  },
] as const;

type RegistrationStep = 1 | 2 | 3;

export function PatientRegistrationForm({
  initialValue,
  doctors,
  onSubmit,
  onCancel,
  onResetServerError,
  pending,
  serverError,
}: PatientRegistrationFormProps) {
  const [step, setStep] = useState<RegistrationStep>(1);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<PatientFormValue>({
    resolver: zodResolver(patientSchema),
    defaultValues: { ...initialValue, cpf: formatCpf(initialValue.cpf) },
    mode: "onTouched",
  });
  const cpf = register("cpf", {
    onChange: (event) => {
      setValue("cpf", formatCpf(event.target.value), { shouldValidate: true });
    },
  });
  const currentStep = steps[step - 1];

  async function continueRegistration() {
    const fields =
      step === 1
        ? (["name", "phone", "cpf"] as const)
        : (["birthDate", "bloodType", "sexForClinicalUse"] as const);
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;
    setStep((current) => Math.min(3, current + 1) as RegistrationStep);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (step < 3) {
      event.preventDefault();
      void continueRegistration();
      return;
    }
    void handleSubmit((value) => onSubmit(value))(event);
  }

  return (
    <div className={styles.registration}>
      <ol className={styles.stepper} aria-label="Etapas do cadastro do paciente">
        {steps.map((item, index) => {
          const number = (index + 1) as RegistrationStep;
          const completed = number < step;
          const reached = number <= step;
          return (
            <li
              key={item.label}
              className={reached ? styles.reached : undefined}
              aria-current={number === step ? "step" : undefined}
            >
              {index > 0 ? (
                <span className={styles.connector} aria-hidden="true" />
              ) : null}
              <span className={styles.stepCircle} aria-hidden="true">
                {completed ? <Check size={13} strokeWidth={2.4} /> : number}
              </span>
              <span className={styles.stepLabel}>{item.label}</span>
            </li>
          );
        })}
      </ol>

      <form
        className={styles.card}
        onSubmit={submit}
        onChangeCapture={() => {
          if (serverError) onResetServerError?.();
        }}
        aria-busy={pending}
        noValidate
      >
        <header className={styles.header} aria-live="polite">
          <span className={styles.srOnly}>Etapa {step} de 3.</span>
          <h1>{currentStep.title}</h1>
          <p>{currentStep.description}</p>
        </header>

        {step === 1 ? (
          <div className={styles.fields}>
            <Field
              label="Nome completo"
              autoComplete="name"
              placeholder="Marina Oliveira"
              error={errors.name?.message}
              {...register("name")}
            />
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PatientPhoneField
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.phone?.message}
                  className={styles.registrationPhone}
                />
              )}
            />
            <Field
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              error={errors.cpf?.message}
              {...cpf}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.fields}>
            <div className={styles.splitFields}>
              <Field
                label="Data de nascimento"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                error={errors.birthDate?.message}
                {...register("birthDate")}
              />
              <SelectField
                label="Tipo sanguíneo"
                error={errors.bloodType?.message}
                {...register("bloodType", {
                  setValueAs: (value) => value || null,
                })}
              >
                <option value="">Não informado</option>
                {bloodTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
            <SelectField
              label="Sexo para referência laboratorial"
              hint="Usado somente para selecionar as faixas impressas no laudo."
              error={errors.sexForClinicalUse?.message}
              {...register("sexForClinicalUse", {
                setValueAs: (value) => value || null,
              })}
            >
              <option value="">Não informado</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
            </SelectField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.fields}>
            <SelectField
              label="Médico responsável"
              error={errors.doctorUserId?.message}
              {...register("doctorUserId")}
            >
              <option value="">Selecione</option>
              {doctors.map((doctor) => (
                <option key={doctor.userId} value={doctor.userId}>
                  {doctor.name ?? doctor.email}
                </option>
              ))}
            </SelectField>
            <label className={styles.notes} htmlFor="patient-registration-notes">
              <span>Observações</span>
              <textarea
                id="patient-registration-notes"
                placeholder="Informações operacionais relevantes para o atendimento"
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={errors.notes ? "patient-registration-notes-error" : undefined}
                {...register("notes")}
              />
              {errors.notes ? (
                <small
                  id="patient-registration-notes-error"
                  className={styles.fieldError}
                >
                  {errors.notes.message}
                </small>
              ) : null}
            </label>
          </div>
        ) : null}

        {serverError ? (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        ) : null}

        <div className={styles.actions}>
          {step > 1 && !pending ? (
            <button
              type="button"
              className={styles.back}
              onClick={() =>
                setStep((current) => Math.max(1, current - 1) as RegistrationStep)
              }
            >
              Voltar
            </button>
          ) : null}
          <button
            type="submit"
            className={styles.primary}
            disabled={pending}
          >
            {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
            {pending
              ? "Salvando paciente…"
              : step === 3
                ? "Salvar paciente"
                : "Continuar"}
          </button>
        </div>
      </form>

      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
