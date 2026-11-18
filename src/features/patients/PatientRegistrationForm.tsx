import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
} from "../../auth/documentIdentity";
import { Button } from "../../components/Button";
import { InlineError } from "../../components/Feedback";
import { Field, SelectField, TextAreaField } from "../../components/Field";
import { bloodTypeOptions } from "./patientFormatters";
import { patientSchema, type PatientFormValue } from "./patientForm";
import { PatientPhoneField } from "./PatientPhoneField";
import styles from "./PatientRegistrationForm.module.css";

interface PatientRegistrationFormProps {
  initialValue: PatientFormValue;
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
    description: "Registre observações úteis. O acesso médico nasce apenas do consentimento do paciente.",
  },
] as const;

type RegistrationStep = 1 | 2 | 3;

export function PatientRegistrationForm({
  initialValue,
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
    trigger,
    formState: { errors },
  } = useForm<PatientFormValue>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialValue,
    mode: "onTouched",
  });
  const documentCountryCode = useWatch({ control, name: "documentCountryCode" });
  const documentType = useWatch({ control, name: "documentType" });
  const currentStep = steps[step - 1];

  async function continueRegistration() {
    const fields =
      step === 1
        ? (["name", "phone", "documentCountryCode", "documentType", "document", "email"] as const)
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
                />
              )}
            />
            <div className={styles.splitFields}>
              <SelectField label="País do documento" {...register("documentCountryCode")}>
                {documentCountries.map((country) => (
                  <option key={country.code} value={country.code}>{country.label}</option>
                ))}
              </SelectField>
              <SelectField label="Tipo de documento" {...register("documentType")}>
                {documentTypesFor(documentCountryCode).map((type) => (
                  <option key={type.code} value={type.code}>{type.label}</option>
                ))}
              </SelectField>
            </div>
            <Field
              label="Documento"
              inputMode={documentCountryCode === "BR" && documentType === "CPF" ? "numeric" : "text"}
              autoComplete="off"
              placeholder={documentPlaceholder(documentCountryCode, documentType)}
              maxLength={80}
              error={errors.document?.message}
              {...register("document")}
            />
            <Field
              label="E-mail"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.fields}>
            <div className={styles.splitFields}>
              <Field
                label="Data de nascimento"
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
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
            <TextAreaField
              id="patient-registration-notes"
              label="Observações"
              placeholder="Informações operacionais relevantes para o atendimento"
              error={errors.notes?.message}
              {...register("notes")}
            />
          </div>
        ) : null}

        {serverError ? <InlineError>{serverError}</InlineError> : null}

        <div className={styles.actions}>
          {step > 1 && !pending ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setStep((current) => Math.max(1, current - 1) as RegistrationStep)
              }
            >
              Voltar
            </Button>
          ) : null}
          <Button
            type="submit"
            className={styles.primary}
            loading={pending}
            loadingLabel="Salvando paciente…"
          >
            {step === 3 ? "Salvar paciente" : "Continuar"}
          </Button>
        </div>
      </form>

      <Button type="button" variant="ghost" className={styles.cancel} onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
