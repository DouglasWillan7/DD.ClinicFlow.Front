import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  Check,
  KeyRound,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ApiError } from "../api/client";
import type {
  AccountRecoveryOptions,
  AuthV2ClinicSelectionRequired,
} from "../api/types";
import { useLocation, useNavigate } from "../app/navigation";
import { useAuth } from "./AuthProvider";
import { ClinicContextSelector } from "../features/clinic-context/ClinicContextSelector";
import {
  type DocumentCredentials,
  type RecoveryIdentity,
  documentCountries,
  documentCredentialsSchema,
  documentPlaceholder,
  documentTypesFor,
  recoveryIdentitySchema,
} from "./documentIdentity";
import styles from "./LoginPage.module.css";

type PageMode = "login" | "recovery" | "recovery-success";

const identityDefaults = {
  countryCode: "BR",
  documentType: "CPF",
  document: "",
};

function firstMessage(errors: Record<string, { message?: string } | undefined>) {
  return Object.values(errors).find((error) => error?.message)?.message;
}

export function LoginPage() {
  const {
    getRecoveryOptions,
    loginWithDocument,
    requestRecoveryChallenge,
    selectClinic,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<PageMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const [selection, setSelection] = useState<AuthV2ClinicSelectionRequired>();
  const [rememberSelection, setRememberSelection] = useState(false);
  const [selectingClinicId, setSelectingClinicId] = useState<string>();
  const [recoveryOptions, setRecoveryOptions] = useState<AccountRecoveryOptions>();
  const [recoveryStatus, setRecoveryStatus] = useState<string>();
  const [sendingRecoveryTo, setSendingRecoveryTo] = useState<string>();

  const loginForm = useForm<DocumentCredentials>({
    resolver: zodResolver(documentCredentialsSchema),
    defaultValues: { ...identityDefaults, password: "", rememberConnection: true },
  });
  const recoveryForm = useForm<RecoveryIdentity>({
    resolver: zodResolver(recoveryIdentitySchema),
    defaultValues: identityDefaults,
  });

  const [countryCode, documentType, document, password] = useWatch({
    control: loginForm.control,
    name: ["countryCode", "documentType", "document", "password"],
  });
  const recoveryCountryCode = useWatch({
    control: recoveryForm.control,
    name: "countryCode",
  });
  const recoveryDocumentType = useWatch({
    control: recoveryForm.control,
    name: "documentType",
  });

  useEffect(() => {
    const types = documentTypesFor(countryCode);
    if (!types.some(({ code }) => code === documentType)) {
      loginForm.setValue("documentType", types[0].code);
    }
  }, [countryCode, documentType, loginForm]);

  useEffect(() => {
    const types = documentTypesFor(recoveryCountryCode);
    if (!types.some(({ code }) => code === recoveryDocumentType)) {
      recoveryForm.setValue("documentType", types[0].code);
    }
  }, [recoveryCountryCode, recoveryDocumentType, recoveryForm]);

  const destination = () => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? "/app/agenda", { replace: true });
  };

  const clearFeedback = () => {
    loginForm.clearErrors();
    setServerError(undefined);
  };

  const submitLogin = loginForm.handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const outcome = await loginWithDocument({
        ...values,
        document: values.document.trim(),
      });
      if (outcome.kind === "clinic_selection_required") {
        setRememberSelection(values.rememberConnection);
        setSelection(outcome);
        return;
      }
      destination();
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status === 401
          ? "Documento ou senha incorretos."
          : "Não foi possível entrar. Verifique sua conexão e tente novamente.",
      );
    }
  });

  const chooseClinic = async (userClinicId: string) => {
    if (!selection) return;
    setSelectingClinicId(userClinicId);
    setServerError(undefined);
    try {
      await selectClinic(selection.selectionToken, userClinicId, rememberSelection);
      destination();
    } catch (error) {
      setServerError(
        error instanceof ApiError && (error.status === 400 || error.status === 401)
          ? "A seleção expirou. Entre novamente para continuar."
          : "Não foi possível acessar esta clínica. Tente novamente.",
      );
    } finally {
      setSelectingClinicId(undefined);
    }
  };

  const openRecovery = () => {
    const currentDocument = loginForm.getValues("document");
    recoveryForm.reset({
      countryCode: loginForm.getValues("countryCode"),
      documentType: loginForm.getValues("documentType"),
      document: currentDocument,
    });
    setRecoveryOptions(undefined);
    setRecoveryStatus(undefined);
    setServerError(undefined);
    setMode("recovery");
  };

  const closeRecovery = () => {
    setMode("login");
    setRecoveryOptions(undefined);
    setRecoveryStatus(undefined);
    setServerError(undefined);
  };

  const submitRecovery = recoveryForm.handleSubmit(async (values) => {
    setServerError(undefined);
    setRecoveryStatus(undefined);
    try {
      const options = await getRecoveryOptions({
        ...values,
        document: values.document.trim(),
      });
      setRecoveryOptions(options);
      if (options.supportRequired || options.destinations.length === 0) {
        setRecoveryStatus(
          "Procure o administrador da sua clínica ou o suporte do ClinicFlow.",
        );
      }
    } catch {
      setServerError("Não foi possível continuar. Confira os dados e tente novamente.");
    }
  });

  const sendRecovery = async (opaqueSelection: string) => {
    setSendingRecoveryTo(opaqueSelection);
    setServerError(undefined);
    try {
      await requestRecoveryChallenge(opaqueSelection);
      setMode("recovery-success");
    } catch {
      setServerError("Não foi possível enviar as instruções. Tente novamente.");
    } finally {
      setSendingRecoveryTo(undefined);
    }
  };

  const loginValidationError = firstMessage(loginForm.formState.errors);
  const recoveryValidationError = firstMessage(recoveryForm.formState.errors);
  const hasEmptyLoginField = !document.trim() || !password;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.showcase} aria-label="Acesso seguro ao ClinicFlow">
          <img className={styles.logo} src="/clinicflow-logo.png" alt="ClinicFlow" />
          <div className={styles.showcaseContent}>
            <p className={styles.eyebrow}>Identidade única, contexto correto</p>
            <h1>Seu acesso acompanha você. Os dados da clínica, não.</h1>
            <p className={styles.intro}>
              Entre com seu documento e escolha o vínculo de trabalho quando necessário.
            </p>
            <ul className={styles.benefits}>
              <li><UserRoundCheck aria-hidden="true" /> Um único acesso por pessoa</li>
              <li><Building2 aria-hidden="true" /> Contatos e função definidos por clínica</li>
              <li><ShieldCheck aria-hidden="true" /> Permissões aplicadas ao contexto selecionado</li>
            </ul>
          </div>
          <p className={styles.showcaseNote}>
            O ClinicFlow protege a separação entre identidade, clínica e dados assistenciais.
          </p>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.mobileLogo}>
            <img src="/clinicflow-logo.png" alt="ClinicFlow" />
          </div>
          <div className={styles.formContent}>
            {selection ? (
              <>
                <header>
                  <p className={styles.stepLabel}>Acesso verificado</p>
                  <h2>Escolha onde entrar</h2>
                  <p>Você possui acesso a mais de uma clínica.</p>
                </header>

                {serverError ? <div className={styles.errorBanner} role="alert">{serverError}</div> : null}

                <div className={styles.contextSelector}>
                  <ClinicContextSelector
                    clinics={selection.clinics}
                    busyUserClinicId={selectingClinicId}
                    focusFirstOnMount
                    onSelect={(userClinicId) => void chooseClinic(userClinicId)}
                  />
                </div>

                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => {
                    setSelection(undefined);
                    setServerError(undefined);
                  }}
                >
                  <ArrowLeft aria-hidden="true" /> Voltar ao acesso
                </button>
              </>
            ) : mode === "recovery-success" ? (
              <div className={styles.successState}>
                <span className={styles.successIcon}><Check aria-hidden="true" /></span>
                <header>
                  <h2>Confira suas mensagens</h2>
                  <p>Se os dados estiverem corretos, você receberá as próximas instruções.</p>
                </header>
                <button className={styles.submit} type="button" onClick={closeRecovery}>
                  Voltar para o acesso
                </button>
              </div>
            ) : mode === "recovery" ? (
              <>
                <header>
                  <button className={styles.backButton} type="button" onClick={closeRecovery}>
                    <ArrowLeft aria-hidden="true" /> Voltar
                  </button>
                  <h2>Recuperar acesso</h2>
                  <p>Informe o mesmo documento usado para entrar.</p>
                </header>

                {serverError || recoveryValidationError ? (
                  <div className={styles.errorBanner} role="alert">
                    {serverError ?? recoveryValidationError}
                  </div>
                ) : null}

                {!recoveryOptions ? (
                  <form className={styles.form} onSubmit={submitRecovery} noValidate>
                    <div className={styles.identityGrid}>
                      <label className={styles.field} htmlFor="recovery-country">
                        <span>País</span>
                        <select id="recovery-country" {...recoveryForm.register("countryCode")}>
                          {documentCountries.map((country) => (
                            <option key={country.code} value={country.code}>{country.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field} htmlFor="recovery-document-type">
                        <span>Tipo de documento</span>
                        <select id="recovery-document-type" {...recoveryForm.register("documentType")}>
                          {documentTypesFor(recoveryCountryCode).map((type) => (
                            <option key={type.code} value={type.code}>{type.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className={styles.field} htmlFor="recovery-document">
                      <span>Documento</span>
                      <input
                        id="recovery-document"
                        autoFocus
                        autoComplete="username"
                        placeholder={documentPlaceholder(recoveryCountryCode, recoveryDocumentType)}
                        aria-invalid={Boolean(recoveryForm.formState.errors.document)}
                        {...recoveryForm.register("document", {
                          onChange: () => {
                            recoveryForm.clearErrors();
                            setServerError(undefined);
                          },
                        })}
                      />
                    </label>
                    <button className={styles.submit} type="submit" disabled={recoveryForm.formState.isSubmitting}>
                      {recoveryForm.formState.isSubmitting ? "Verificando..." : "Continuar"}
                    </button>
                  </form>
                ) : recoveryOptions.destinations.length > 0 ? (
                  <div className={styles.recoveryChoices}>
                    <p>Onde você quer receber as instruções?</p>
                    {recoveryOptions.destinations.map((destinationOption) => (
                      <button
                        key={destinationOption.selection}
                        type="button"
                        disabled={Boolean(sendingRecoveryTo)}
                        onClick={() => void sendRecovery(destinationOption.selection)}
                      >
                        <span className={styles.clinicIcon}><KeyRound aria-hidden="true" /></span>
                        <span>
                          <small>{destinationOption.kind === "sms" ? "Mensagem de texto" : "E-mail"}</small>
                          <strong>{destinationOption.masked}</strong>
                        </span>
                        <span className={styles.optionAction}>
                          {sendingRecoveryTo === destinationOption.selection ? "Enviando..." : "Enviar"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {recoveryStatus ? <p className={styles.supportMessage} role="status">{recoveryStatus}</p> : null}
              </>
            ) : (
              <>
                <header>
                  <h2>Acesse sua conta</h2>
                  <p>Use seu documento e senha. A clínica será definida em seguida, se necessário.</p>
                </header>

                <form className={styles.form} onSubmit={submitLogin} noValidate>
                  {serverError || loginValidationError ? (
                    <div className={styles.errorBanner} role="alert">
                      {serverError ?? loginValidationError}
                    </div>
                  ) : null}

                  <div className={styles.identityGrid}>
                    <label className={styles.field} htmlFor="login-country">
                      <span>País</span>
                      <select id="login-country" {...loginForm.register("countryCode", { onChange: clearFeedback })}>
                        {documentCountries.map((country) => (
                          <option key={country.code} value={country.code}>{country.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field} htmlFor="login-document-type">
                      <span>Tipo de documento</span>
                      <select id="login-document-type" {...loginForm.register("documentType", { onChange: clearFeedback })}>
                        {documentTypesFor(countryCode).map((type) => (
                          <option key={type.code} value={type.code}>{type.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className={styles.field} htmlFor="login-document">
                    <span>Documento</span>
                    <input
                      id="login-document"
                      autoComplete="username"
                      inputMode={countryCode === "BR" && documentType === "CPF" ? "numeric" : "text"}
                      placeholder={documentPlaceholder(countryCode, documentType)}
                      aria-invalid={Boolean(loginForm.formState.errors.document)}
                      {...loginForm.register("document", { onChange: clearFeedback })}
                    />
                  </label>

                  <div className={styles.passwordField}>
                    <div className={styles.fieldHeading}>
                      <label htmlFor="login-password">Senha</label>
                      <button type="button" onClick={openRecovery}>Esqueci minha senha</button>
                    </div>
                    <div className={styles.passwordInput}>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        aria-invalid={Boolean(loginForm.formState.errors.password)}
                        {...loginForm.register("password", { onChange: clearFeedback })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </div>

                  <label className={styles.remember}>
                    <input type="checkbox" {...loginForm.register("rememberConnection")} />
                    <span className={styles.checkbox} aria-hidden="true"><Check /></span>
                    <span>Manter conectado neste computador</span>
                  </label>

                  <button
                    className={styles.submit}
                    type="submit"
                    disabled={loginForm.formState.isSubmitting}
                    data-incomplete={hasEmptyLoginField || undefined}
                  >
                    {loginForm.formState.isSubmitting ? "Entrando..." : "Entrar"}
                  </button>
                </form>

                <p className={styles.footer}>
                  Seu acesso é criado pela clínica. Em caso de dúvida, fale com a administração.
                  <span aria-hidden="true"> · </span>
                  ou peça acesso ao administrador da sua clínica.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
