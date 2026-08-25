import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, Stethoscope } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ClinicMember, ClinicRole } from "../../api/types";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
} from "../../auth/documentIdentity";
import { Button } from "../../components/Button";
import { Field, SelectField } from "../../components/Field";
import { InternationalPhoneField } from "../../components/InternationalPhoneField";
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
import { useState } from "react";

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
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  member?: ClinicMember;
  initialRole?: ClinicRole;
  pending: boolean;
  serverError?: string;
  onCancel(): void;
  onSubmit(payload: ClinicMemberPayload): void;
}) {
  const [pendingRole, setPendingRole] = useState<Exclude<ClinicRole, "Doctor">>();
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClinicMemberFormValue>({
    resolver: zodResolver(createClinicMemberSchema(mode)),
    defaultValues: {
      ...toClinicMemberFormValue(member),
      role: member?.role ?? initialRole ?? "Secretary",
    },
  });
  const [countryCode, documentType, role] = useWatch({
    control,
    name: ["countryCode", "documentType", "role"],
  });

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
      onSubmit={handleSubmit((value) => onSubmit(toClinicMemberPayload(value, mode)))}
      noValidate
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            {mode === "create" ? "Novo vínculo" : "Vínculo com a clínica"}
          </span>
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
              <h3 id="member-identity-heading">Identidade global</h3>
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
        <section className={styles.identitySummary} aria-label="Identidade global">
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
              <p>Registro, apresentação e duração pertencem a este vínculo.</p>
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
            <Field label="Especialidade" {...register("specialty")} />
            <SelectField
              label="Duração padrão da consulta"
              error={errors.defaultAppointmentDurationMinutes?.message}
              {...register("defaultAppointmentDurationMinutes")}
            >
              <option value="">Selecionar</option>
              {[15, 20, 30, 40, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutos</option>
              ))}
            </SelectField>
            <Field className={styles.wide} label="Áreas de atuação" {...register("practiceAreas")} />
            <label className={styles.textareaField}>
              <span>Biografia profissional</span>
              <textarea rows={4} maxLength={600} {...register("bio")} />
            </label>
          </div>
        </section>
      ) : null}

      {pendingRole ? (
        <section
          className={styles.confirmation}
          role="alertdialog"
          aria-modal="true"
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

      {serverError ? <p className={styles.serverError} role="alert">{serverError}</p> : null}

      <footer className={styles.actions}>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Adicionar integrante" : "Salvar vínculo"}
        </Button>
      </footer>
    </form>
  );
}
