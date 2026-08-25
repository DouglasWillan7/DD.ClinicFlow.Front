import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
} from "../../auth/documentIdentity";
import { Button } from "../../components/Button";
import { Field, SelectField } from "../../components/Field";
import { bloodTypeOptions } from "./patientFormatters";
import { patientSchema, type PatientFormValue } from "./patientForm";
import { PatientPhoneField } from "./PatientPhoneField";
import styles from "./PatientsPage.module.css";

interface PatientFormProps {
  initialValue: PatientFormValue;
  submitLabel: string;
  onSubmit: (value: PatientFormValue) => void;
  onCancel: () => void;
  pending: boolean;
  serverError: string | null;
}

export function PatientForm({
  initialValue,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
  serverError,
}: PatientFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormValue>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialValue,
  });
  const documentCountryCode = useWatch({ control, name: "documentCountryCode" });
  const documentType = useWatch({ control, name: "documentType" });

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit((value) => onSubmit(value))}
      noValidate
    >
      <Field
        className={styles.wide}
        label="Nome completo"
        autoComplete="name"
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
      <SelectField
        label="Tipo sanguíneo"
        error={errors.bloodType?.message}
        {...register("bloodType", { setValueAs: (value) => value || null })}
      >
        <option value="">Não informado</option>
        {bloodTypeOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Sexo para referência laboratorial"
        hint="Usado somente para selecionar faixas laboratoriais impressas no laudo."
        error={errors.sexForClinicalUse?.message}
        {...register("sexForClinicalUse", { setValueAs: (value) => value || null })}
      >
        <option value="">Não informado</option>
        <option value="Feminino">Feminino</option>
        <option value="Masculino">Masculino</option>
      </SelectField>
      <Field
        label="Data de nascimento"
        type="date"
        max={new Date().toISOString().slice(0, 10)}
        error={errors.birthDate?.message}
        {...register("birthDate")}
      />
      <label className={styles.notes} htmlFor="notes">
        <span>Observações</span>
        <textarea
          id="notes"
          placeholder="Informações operacionais relevantes para o atendimento"
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          {...register("notes")}
        />
        {errors.notes ? (
          <small id="notes-error" className={styles.fieldError}>
            {errors.notes.message}
          </small>
        ) : null}
      </label>
      {serverError ? (
        <span className={styles.serverError} role="alert">
          {serverError}
        </span>
      ) : null}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
