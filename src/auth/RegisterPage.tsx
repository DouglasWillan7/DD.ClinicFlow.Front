import { Check } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { ApiError } from "../api/client";
import { Link, useNavigate } from "../app/navigation";
import { useAuth } from "./AuthProvider";
import styles from "./RegisterPage.module.css";

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const specialties = [
  "Gastroenterologia",
  "Clínica médica",
  "Endoscopia digestiva",
  "Hepatologia",
  "Cirurgia digestiva",
  "Nutrologia",
  "Coloproctologia",
];

const termsVersion = "clinicflow-terms-v1";

interface RegisterValues {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  medicalLicense: string;
  medicalLicenseState: string;
  specialty: string;
  clinicName: string;
  clinicCity: string;
  clinicState: string;
}

const initialValues: RegisterValues = {
  name: "",
  email: "",
  password: "",
  passwordConfirmation: "",
  medicalLicense: "",
  medicalLicenseState: "",
  specialty: "",
  clinicName: "",
  clinicCity: "",
  clinicState: "",
};

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  return score;
}

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(values.password), [values.password]);
  const passwordsDiffer =
    values.passwordConfirmation.length > 0 &&
    values.passwordConfirmation !== values.password;
  const passwordsMatch =
    values.password.length >= 8 &&
    values.passwordConfirmation === values.password;

  const update =
    (field: keyof RegisterValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setError("");
    };

  const continueRegistration = async () => {
    if (loading) return;

    if (step === 1) {
      if (!values.name.trim() || !values.email.trim()) {
        setError("Informe seu nome e e-mail para continuar.");
        return;
      }
      if (values.password.length < 8) {
        setError("A senha precisa ter no mínimo 8 caracteres.");
        return;
      }
      if (passwordsDiffer || !values.passwordConfirmation) {
        setError("As senhas não coincidem — confira e tente de novo.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (
        !values.medicalLicense.trim() ||
        !values.medicalLicenseState ||
        !values.specialty
      ) {
        setError("Informe CRM, UF e especialidade para continuar.");
        return;
      }
      if (!/^\d+$/.test(values.medicalLicense.trim())) {
        setError("O CRM deve conter apenas números.");
        return;
      }
      setStep(3);
      return;
    }

    if (!values.clinicName.trim() || !values.clinicCity.trim() || !values.clinicState) {
      setError("Informe o nome, a cidade e a UF da clínica.");
      return;
    }
    if (!termsAccepted) {
      setError("É preciso aceitar os Termos de Uso para concluir.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await createAccount(
        values.name.trim(),
        values.email.trim(),
        values.password,
        "Clinic",
        true,
        {
          clinicName: values.clinicName.trim(),
          clinicCity: values.clinicCity.trim(),
          clinicState: values.clinicState,
          medicalLicense: values.medicalLicense.trim(),
          medicalLicenseState: values.medicalLicenseState,
          specialty: values.specialty,
          termsAccepted,
          termsVersion,
        },
      );
      navigate("/app/pacientes", { replace: true });
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
              subtitle="Você poderá convidar a equipe depois."
            />
            <Field label="Nome completo">
              <input
                type="text"
                autoComplete="name"
                placeholder="Dr. Ibrahim Kadri"
                value={values.name}
                onChange={update("name")}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                autoComplete="email"
                placeholder="nome@clinica.com.br"
                value={values.email}
                onChange={update("email")}
              />
            </Field>
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
              subtitle="Usado no prontuário, nos laudos e na agenda."
            />
            <div className={styles.splitFields}>
              <Field label="CRM">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={values.medicalLicense}
                  onChange={update("medicalLicense")}
                />
              </Field>
              <Field label="UF">
                <Select
                  value={values.medicalLicenseState}
                  onChange={update("medicalLicenseState")}
                  placeholder="UF"
                  options={brazilianStates}
                />
              </Field>
            </div>
            <Field label="Especialidade">
              <Select
                value={values.specialty}
                onChange={update("specialty")}
                placeholder="Selecione a especialidade"
                options={specialties}
              />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <RegisterHeader
              title="Sua clínica"
              subtitle="Crie o espaço da clínica — dá para editar tudo depois."
            />
            <Field label="Nome da clínica">
              <input
                type="text"
                autoComplete="organization"
                placeholder="Clínica Gastro Vida"
                value={values.clinicName}
                onChange={update("clinicName")}
              />
            </Field>
            <div className={styles.splitFields}>
              <Field label="Cidade">
                <input
                  type="text"
                  autoComplete="address-level2"
                  placeholder="São Paulo"
                  value={values.clinicCity}
                  onChange={update("clinicCity")}
                />
              </Field>
              <Field label="UF">
                <Select
                  value={values.clinicState}
                  onChange={update("clinicState")}
                  placeholder="UF"
                  options={brazilianStates}
                />
              </Field>
            </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <select value={value} onChange={onChange} className={value ? undefined : styles.placeholderSelect}>
      <option value="" disabled>{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function PasswordMeter({ strength }: { strength: number }) {
  const tone = strength <= 1 ? "weak" : strength === 2 ? "fair" : "strong";
  const label =
    strength <= 1 ? "Senha fraca" : strength === 2 ? "Senha razoável" : strength === 3 ? "Senha boa" : "Senha forte";
  return (
    <div className={styles.passwordMeter} data-tone={tone}>
      <div>{[0, 1, 2, 3].map((index) => <i key={index} data-filled={index < strength || undefined} />)}</div>
      <small>{label}</small>
    </div>
  );
}
