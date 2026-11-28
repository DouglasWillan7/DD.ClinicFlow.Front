import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
} from "../../auth/documentIdentity";
import { Button } from "../../components/Button";
import { InlineError } from "../../components/Feedback";
import { Field, SelectField } from "../../components/Field";
import { patientDocumentSchema, type PatientDocumentValue } from "./patientForm";
import styles from "./PatientRegistrationForm.module.css";

interface PatientDocumentStepProps {
  initialValue: PatientDocumentValue;
  onSubmit: (value: PatientDocumentValue) => void;
  onCancel: () => void;
  /** Chamado quando o documento muda, para descartar o resultado da consulta anterior. */
  onChange?: () => void;
  pending: boolean;
  serverError: string | null;
  /** Resultado da consulta que mantém a pessoa nesta etapa (ex.: já é paciente da clínica). */
  notice?: ReactNode;
}

/**
 * O cadastro começa pelo documento: é ele que diz se a pessoa já existe no
 * ClinicFlow, antes de a recepção digitar qualquer outro dado.
 */
export function PatientDocumentStep({
  initialValue,
  onSubmit,
  onCancel,
  onChange,
  pending,
  serverError,
  notice,
}: PatientDocumentStepProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PatientDocumentValue>({
    resolver: zodResolver(patientDocumentSchema),
    defaultValues: initialValue,
    mode: "onTouched",
  });
  const documentCountryCode = useWatch({ control, name: "documentCountryCode" });
  const documentType = useWatch({ control, name: "documentType" });

  // O tipo anterior pode não existir no país novo (ex.: CPF fora do Brasil). A troca
  // acontece depois do render, quando o <select> já tem as opções do país escolhido.
  useEffect(() => {
    const types = documentTypesFor(documentCountryCode);
    if (!types.some((type) => type.code === documentType)) {
      setValue("documentType", types[0].code);
    }
  }, [documentCountryCode, documentType, setValue]);

  return (
    <div className={styles.registration}>
      <form
        className={styles.card}
        onSubmit={(event) => void handleSubmit((value) => onSubmit(value))(event)}
        onChangeCapture={() => onChange?.()}
        aria-busy={pending}
        noValidate
      >
        <header className={styles.header}>
          <h1>Comece pelo documento</h1>
          <p>
            O documento mostra se a pessoa já tem cadastro no ClinicFlow. Se tiver,
            você só confirma os dados e ela passa a ser paciente desta clínica.
          </p>
        </header>

        <div className={styles.fields}>
          <div className={styles.splitFields}>
            <SelectField label="País do documento" {...register("documentCountryCode")}>
              {documentCountries.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
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
        </div>

        {notice}
        {serverError ? <InlineError>{serverError}</InlineError> : null}

        <div className={styles.actions}>
          <Button
            type="submit"
            className={styles.primary}
            loading={pending}
            loadingLabel="Consultando documento…"
          >
            Continuar
          </Button>
        </div>
      </form>

      <Button type="button" variant="ghost" className={styles.cancel} onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
