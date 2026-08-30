import { Check } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { RegisterClinicOwnerRequest } from "../api/types";
import { ApiError } from "../api/client";
import { Link, useNavigate } from "../app/navigation";
import { InternationalPhoneField } from "../components/InternationalPhoneField";
import { useAuth } from "./AuthProvider";
import {
  documentCountries,
  documentPlaceholder,
  documentTypesFor,
  recoveryIdentitySchema,
} from "./documentIdentity";
import { validPassword } from "./passwordPolicy";
import styles from "./RegisterPage.module.css";

const termsVersion = "clinicflow-terms-v1";

const specialties = [
  "Gastroenterologia",
  "Clínica médica",
  "Endoscopia digestiva",
  "Hepatologia",
  "Cirurgia digestiva",
  "Nutrologia",
  "Coloproctologia",
];

const clinicRegistrationTypes: Record<string, Array<{ code: string; label: string }>> = {
  BR: [{ code: "CNPJ", label: "CNPJ" }],
  PT: [{ code: "NIPC", label: "NIPC" }],
  US: [{ code: "EIN", label: "EIN" }],
  AR: [{ code: "CUIT", label: "CUIT" }],
  UY: [{ code: "RUT", label: "RUT" }],
};

interface RegisterValues {
  countryCode: string;
  documentType: string;
  document: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
  professionalAuthority: string;
  professionalRegistrationNumber: string;
  professionalRegistrationRegion: string;
  professionalRegistrationCountryCode: string;
  specialty: string;
  defaultAppointmentDurationMinutes: string;
  clinicName: string;
  clinicRegistrationCountryCode: string;
  clinicRegistrationType: string;
  clinicRegistrationNumber: string;
  clinicAddress: string;
}

const initialValues: RegisterValues = {
  countryCode: "BR",
  documentType: "CPF",
  document: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirmation: "",
  professionalAuthority: "CRM",
  professionalRegistrationNumber: "",
  professionalRegistrationRegion: "",
  professionalRegistrationCountryCode: "BR",
  specialty: "",
  defaultAppointmentDurationMinutes: "30",
  clinicName: "",
  clinicRegistrationCountryCode: "BR",
  clinicRegistrationType: "CNPJ",
  clinicRegistrationNumber: "",
  clinicAddress: "",
};

function registrationTypesFor(countryCode: string) {
  return clinicRegistrationTypes[countryCode] ?? [{ code: "TAX", label: "Registro fiscal" }];
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  return score;
}

export function RegisterPage() {
  const { registerClinicOwner } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(values.password), [values.password]);
  const passwordsDiffer = values.passwordConfirmation.length > 0 &&
    values.passwordConfirmation !== values.password;
  const passwordsMatch = validPassword(values.password) &&
    values.passwordConfirmation === values.password;

  const update =
    (field: keyof RegisterValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setError("");
    };

  const updateDocumentCountry = (event: ChangeEvent<HTMLSelectElement>) => {
    const countryCode = event.target.value;
    const documentType = documentTypesFor(countryCode)[0].code;
    setValues((current) => ({ ...current, countryCode, documentType }));
    setError("");
  };

  const updateClinicCountry = (event: ChangeEvent<HTMLSelectElement>) => {
    const clinicRegistrationCountryCode = event.target.value;
    const clinicRegistrationType = registrationTypesFor(clinicRegistrationCountryCode)[0].code;
    setValues((current) => ({
      ...current,
      clinicRegistrationCountryCode,
      clinicRegistrationType,
    }));
    setError("");
  };

  const continueRegistration = async () => {
    if (loading) return;

    if (step === 1) {
      const identity = recoveryIdentitySchema.safeParse({
        countryCode: values.countryCode,
        documentType: values.documentType,
        document: values.document,
      });
      if (!values.name.trim()) {
        setError("Informe seu nome para continuar.");
        return;
      }
      if (!identity.success) {
        setError(identity.error.issues[0]?.message ?? "Informe seu documento.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
        setError("Informe um e-mail válido.");
        return;
      }
      if (!/^\+[1-9]\d{7,14}$/.test(values.phone)) {
        setError("Informe um telefone válido com DDI e número.");
        return;
      }
      if (!validPassword(values.password)) {
        setError("Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.");
        return;
      }
      if (values.passwordConfirmation !== values.password) {
        setError("As senhas não coincidem — confira e tente de novo.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const duration = Number(values.defaultAppointmentDurationMinutes);
      if (!values.professionalAuthority.trim() ||
          !values.professionalRegistrationNumber.trim() ||
          !values.professionalRegistrationCountryCode) {
        setError("Informe a autoridade, o número e o país do registro profissional.");
        return;
      }
      if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
        setError("A duração padrão deve ficar entre 5 e 480 minutos.");
        return;
      }
      setStep(3);
      return;
    }

    if (!values.clinicName.trim() || !values.clinicRegistrationNumber.trim()) {
      setError("Informe o nome e o registro da clínica.");
      return;
    }
    if (!termsAccepted) {
      setError("É preciso aceitar os Termos de Uso para concluir.");
      return;
    }

    const request: RegisterClinicOwnerRequest = {
      countryCode: values.countryCode,
      documentType: values.documentType,
      document: values.document.trim(),
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone,
      password: values.password,
      plan: "Clinic",
      clinicName: values.clinicName.trim(),
      clinicRegistrationCountryCode: values.clinicRegistrationCountryCode,
      clinicRegistrationType: values.clinicRegistrationType,
      clinicRegistrationNumber: values.clinicRegistrationNumber.trim(),
      clinicAddress: values.clinicAddress.trim() || null,
      professionalAuthority: values.professionalAuthority.trim(),
      professionalRegistrationNumber: values.professionalRegistrationNumber.trim(),
      professionalRegistrationRegion: values.professionalRegistrationRegion.trim() || null,
      professionalRegistrationCountryCode: values.professionalRegistrationCountryCode,
      specialty: values.specialty || null,
      defaultAppointmentDurationMinutes: Number(values.defaultAppointmentDurationMinutes),
      termsAccepted,
      termsVersion,
    };

    setLoading(true);
    setError("");
    try {
      await registerClinicOwner(request);
      navigate("/app/onboarding", { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Não foi possível criar a conta. Verifique sua conexão e tente novamente.",
      );
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <img className={styles.logo} src="/clinicflow-logo.png" alt="ClinicFlow" />

      <ol className={styles.stepper} aria-label="Etapas do cadastro">
        {["Conta", "Perfil profissional", "Clínica"].map((label, index) => {
          const number = index + 1;
          const completed = number < step;
          return (
            <li key={label} className={number <= step ? styles.reached : undefined}>
              {index > 0 ? <span className={styles.connector} aria-hidden="true" /> : null}
              <span className={styles.stepCircle} aria-hidden="true">
                {completed ? <Check size={13} strokeWidth={2.4} /> : number}
              </span>
              <span className={number === step ? styles.activeLabel : undefined}>{label}</span>
            </li>
          );
        })}
      </ol>

      <section className={styles.card} aria-live="polite">
        {step === 1 ? (
          <>
            <RegisterHeader
              title="Comece pela sua conta"
              subtitle="O documento será seu login. E-mail e telefone pertencem a esta clínica."
            />
            <Field label="Nome completo">
              <input
                autoComplete="name"
                placeholder="Dra. Marina Lopes"
                value={values.name}
                onChange={update("name")}
              />
            </Field>
            <div className={styles.splitFields}>
              <Field label="País do documento">
                <select value={values.countryCode} onChange={updateDocumentCountry}>
                  {documentCountries.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo">
                <select value={values.documentType} onChange={update("documentType")}>
                  {documentTypesFor(values.countryCode).map((type) => (
                    <option key={type.code} value={type.code}>{type.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Documento">
              <input
                autoComplete="username"
                inputMode={values.countryCode === "BR" && values.documentType === "CPF" ? "numeric" : "text"}
                placeholder={documentPlaceholder(values.countryCode, values.documentType)}
                value={values.document}
                onChange={update("document")}
              />
            </Field>
            <Field label="E-mail nesta clínica">
              <input
                type="email"
                autoComplete="email"
                placeholder="nome@clinica.com.br"
                value={values.email}
                onChange={update("email")}
              />
            </Field>
            <InternationalPhoneField
              id="register-phone"
              name="phone"
              value={values.phone}
              label="Telefone nesta clínica"
              countrySelectLabel="País do telefone"
              hint="Será armazenado com DDI, código de área e número."
              autoComplete="tel"
              onChange={(phone) => {
                setValues((current) => ({ ...current, phone }));
                setError("");
              }}
            />
            <Field label="Senha">
              <span className={styles.passwordControl}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  value={values.password}
                  onChange={update("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senhas" : "Mostrar senhas"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </span>
            </Field>
            {values.password ? <PasswordMeter strength={strength} /> : null}
            <Field label="Repita sua senha">
              <input
                className={passwordsDiffer ? styles.invalidInput : undefined}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Digite a senha novamente"
                value={values.passwordConfirmation}
                onChange={update("passwordConfirmation")}
              />
              {passwordsDiffer ? (
                <small className={styles.invalidHint}>As senhas não coincidem.</small>
              ) : passwordsMatch ? (
                <small className={styles.validHint}>As senhas coincidem.</small>
              ) : null}
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <RegisterHeader
              title="Seu perfil profissional"
              subtitle="Esses dados pertencem ao seu vínculo médico com esta clínica."
            />
            <div className={styles.splitFields}>
              <Field label="Conselho ou autoridade">
                <input
                  placeholder="CRM"
                  value={values.professionalAuthority}
                  onChange={update("professionalAuthority")}
                />
              </Field>
              <Field label="País do registro">
                <select
                  value={values.professionalRegistrationCountryCode}
                  onChange={update("professionalRegistrationCountryCode")}
                >
                  {documentCountries.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className={styles.splitFields}>
              <Field label="Número do registro">
                <input
                  placeholder="123456"
                  value={values.professionalRegistrationNumber}
                  onChange={update("professionalRegistrationNumber")}
                />
              </Field>
              <Field label="Região / UF">
                <input
                  placeholder="SP"
                  value={values.professionalRegistrationRegion}
                  onChange={update("professionalRegistrationRegion")}
                />
              </Field>
            </div>
            <Field label="Especialidade">
              <select
                value={values.specialty}
                onChange={update("specialty")}
                className={values.specialty ? undefined : styles.placeholderSelect}
              >
                <option value="">Selecione, se aplicável</option>
                {specialties.map((specialty) => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
            </Field>
            <Field label="Duração padrão da consulta (minutos)">
              <input
                type="number"
                inputMode="numeric"
                min="5"
                max="480"
                step="5"
                value={values.defaultAppointmentDurationMinutes}
                onChange={update("defaultAppointmentDurationMinutes")}
              />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <RegisterHeader
              title="Sua clínica"
              subtitle="Crie o espaço inicial da clínica. Você poderá ajustar o perfil depois."
            />
            <Field label="Nome da clínica">
              <input
                autoComplete="organization"
                placeholder="Clínica Horizonte"
                value={values.clinicName}
                onChange={update("clinicName")}
              />
            </Field>
            <div className={styles.splitFields}>
              <Field label="País do registro">
                <select value={values.clinicRegistrationCountryCode} onChange={updateClinicCountry}>
                  {documentCountries.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo">
                <select
                  value={values.clinicRegistrationType}
                  onChange={update("clinicRegistrationType")}
                >
                  {registrationTypesFor(values.clinicRegistrationCountryCode).map((type) => (
                    <option key={type.code} value={type.code}>{type.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Registro da clínica">
              <input
                placeholder={values.clinicRegistrationType === "CNPJ" ? "00.000.000/0000-00" : "Número do registro"}
                value={values.clinicRegistrationNumber}
                onChange={update("clinicRegistrationNumber")}
              />
            </Field>
            <Field label="Endereço">
              <input
                autoComplete="street-address"
                placeholder="Rua, número, cidade, região e país"
                value={values.clinicAddress}
                onChange={update("clinicAddress")}
              />
            </Field>
            <label className={styles.terms}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setError("");
                }}
              />
              <span className={styles.checkbox} aria-hidden="true">
                <Check size={13} strokeWidth={2.4} />
              </span>
              <span>
                Li e aceito os <button type="button">Termos de Uso</button> e a{" "}
                <button type="button">Política de Privacidade</button>.
              </span>
            </label>
          </>
        ) : null}

        {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

        <div className={styles.actions}>
          {step > 1 && !loading ? (
            <button
              type="button"
              className={styles.back}
              onClick={() => {
                setStep((current) => current - 1);
                setError("");
              }}
            >
              Voltar
            </button>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            disabled={loading}
            onClick={() => void continueRegistration()}
          >
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
            {loading ? "Criando conta..." : step === 3 ? "Concluir cadastro" : "Continuar"}
          </button>
        </div>
      </section>

      <p className={styles.loginLink}>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </main>
  );
}

function RegisterHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PasswordMeter({ strength }: { strength: number }) {
  const tone = strength <= 1 ? "weak" : strength === 2 ? "fair" : "strong";
  const label = strength <= 1
    ? "Senha fraca"
    : strength === 2
      ? "Senha razoável"
      : strength === 3
        ? "Senha boa"
        : "Senha forte";
  return (
    <div className={styles.passwordMeter} data-tone={tone}>
      <div>{[0, 1, 2, 3].map((index) => (
        <i key={index} data-filled={index < strength || undefined} />
      ))}</div>
      <small>{label}</small>
    </div>
  );
}
