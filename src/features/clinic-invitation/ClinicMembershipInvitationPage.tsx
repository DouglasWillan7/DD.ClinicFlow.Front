import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../api/client";
import type {
  ClinicMembershipInvitationAcceptance,
  ClinicMembershipInvitationPublicView,
  ClinicRole,
} from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import {
  passwordRequirementsMessage,
  validPassword,
} from "../../auth/passwordPolicy";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import styles from "./ClinicMembershipInvitationPage.module.css";

const publicBase = "/public/clinic-membership-invitations";

function roleLabel(role: ClinicRole) {
  const labels: Record<ClinicRole, string> = {
    Doctor: "Médico",
    Nurse: "Enfermagem",
    Secretary: "Secretaria",
  };
  return labels[role];
}

function expirationLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo informado pela clínica";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function safeSubmissionError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "Não foi possível ativar agora. Tente novamente.";
  }
  if (error.status === 400) return passwordRequirementsMessage;
  if (error.status === 401) {
    return "Não foi possível confirmar sua senha atual.";
  }
  if (error.status === 403) return "Este convite pertence a outra conta.";
  if (error.status === 410) {
    return "Este convite não está mais disponível. Solicite um novo à clínica.";
  }
  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  }
  return "Não foi possível ativar agora. Tente novamente.";
}

export function ClinicMembershipInvitationPage({
  reference,
}: {
  reference: string;
}) {
  const { logout, persistInvitationSession, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [rememberConnection, setRememberConnection] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [wrongSession, setWrongSession] = useState(false);

  const invitation = useQuery({
    queryKey: ["clinic-membership-invitation", reference],
    queryFn: () =>
      apiRequest<ClinicMembershipInvitationPublicView>(`${publicBase}/resolve`, {
        method: "POST",
        body: JSON.stringify({ reference }),
      }),
    retry: false,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!invitation.data || submitting) return;

    const isNewIdentity = invitation.data.mode === "SetInitialPassword";
    if (isNewIdentity && !validPassword(password)) {
      setError(passwordRequirementsMessage);
      return;
    }
    if (isNewIdentity && password !== passwordConfirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!isNewIdentity && !session && !currentPassword) {
      setError("Informe sua senha atual.");
      return;
    }

    setSubmitting(true);
    setError("");
    setWrongSession(false);
    try {
      const path = isNewIdentity ? "accept-new" : "accept-existing";
      const body = isNewIdentity
        ? { reference, password }
        : { reference, currentPassword: session ? null : currentPassword };
      const init = { method: "POST", body: JSON.stringify(body) };
      const acceptance = session
        ? await apiRequest<ClinicMembershipInvitationAcceptance>(
            `${publicBase}/${path}`,
            init,
            session.tokens.accessToken,
          )
        : await apiRequest<ClinicMembershipInvitationAcceptance>(
            `${publicBase}/${path}`,
            init,
          );
      const resolution = persistInvitationSession(
        acceptance,
        rememberConnection,
      );
      navigate(
        resolution.kind === "authenticated" ? "/app/onboarding" : "/entrar",
        { replace: true },
      );
    } catch (submissionError) {
      if (submissionError instanceof ApiError && submissionError.status === 409) {
        setPassword("");
        setPasswordConfirmation("");
        setCurrentPassword("");
        await invitation.refetch();
      } else {
        setError(safeSubmissionError(submissionError));
        setWrongSession(
          submissionError instanceof ApiError && submissionError.status === 403,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (invitation.isLoading) {
    return (
      <PublicLayout>
        <section className={styles.stateCard} role="status" aria-label="Verificando convite">
          <span className={styles.stateIcon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <h1>Verificando seu convite…</h1>
          <p>Estamos confirmando as informações com segurança.</p>
          <span className={styles.loadingLine} aria-hidden="true" />
        </section>
      </PublicLayout>
    );
  }

  if (invitation.isError || !invitation.data) {
    return (
      <PublicLayout>
        <TerminalState
          alert
          icon={<TriangleAlert />}
          label="Convite inválido ou indisponível"
          title="Convite inválido ou indisponível"
          message="O link pode estar incorreto ou não estar mais disponível. Solicite um novo convite à clínica."
        />
      </PublicLayout>
    );
  }

  const view = invitation.data;
  if (view.mode === "Expired") {
    return (
      <PublicLayout>
        <TerminalState
          icon={<CalendarClock />}
          label="Este convite expirou"
          title="Este convite expirou"
          message="Solicite um novo convite à clínica."
        />
      </PublicLayout>
    );
  }
  if (view.mode === "Cancelled") {
    return (
      <PublicLayout>
        <TerminalState
          icon={<TriangleAlert />}
          label="Este convite foi cancelado"
          title="Este convite foi cancelado"
          message="Solicite um novo convite à clínica."
        />
      </PublicLayout>
    );
  }
  if (view.mode === "Accepted") {
    return (
      <PublicLayout>
        <TerminalState
          icon={<CheckCircle2 />}
          label="Convite já aceito"
          title="Este convite já foi aceito"
          message={
            session
              ? "Seu acesso está ativo. Continue para a clínica."
              : "Entre com sua conta para continuar no ClinicFlow."
          }
          action={
            <Button
              type="button"
              onClick={() => navigate(session ? "/app/onboarding" : "/entrar")}
            >
              {session ? "Continuar no ClinicFlow" : "Entrar no ClinicFlow"}
            </Button>
          }
        />
      </PublicLayout>
    );
  }

  const isNewIdentity = view.mode === "SetInitialPassword";
  return (
    <PublicLayout>
      <article className={styles.card}>
        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <LockKeyhole />
          </span>
          <div>
            <h1>Ative seu acesso à clínica</h1>
            <p>
              Confira os dados do convite e conclua sua identificação para entrar
              no ClinicFlow.
            </p>
          </div>
        </header>

        <section className={styles.invitationDetails} aria-labelledby="invitation-details-title">
          <h2 id="invitation-details-title">Seu convite</h2>
          <dl>
            <Detail icon={<Building2 />} label="Clínica" value={view.clinicName} />
            <Detail icon={<UserRound />} label="Convidado" value={view.inviteeName} />
            <Detail icon={<Stethoscope />} label="Função" value={roleLabel(view.role)} />
            <Detail icon={<Mail />} label="E-mail" value={view.emailMasked} />
            <Detail
              icon={<CalendarClock />}
              label="Válido até"
              value={expirationLabel(view.expiresAtUtc)}
            />
          </dl>
        </section>

        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.formIntro}>
            <h2>
              {isNewIdentity ? "Crie sua senha" : "Confirme sua identidade"}
            </h2>
            <p>
              {isNewIdentity
                ? "Esta será a senha usada nos próximos acessos."
                : session
                  ? `Você está conectado como ${session.name}. Confirme para adicionar a nova clínica.`
                  : "Use a senha atual da sua conta ClinicFlow. Ela não será alterada."}
            </p>
          </div>

          {isNewIdentity ? (
            <>
              <PasswordField
                id="invitation-password"
                label="Crie sua senha"
                autoComplete="new-password"
                value={password}
                show={showPassword}
                hint={passwordRequirementsMessage}
                onChange={(value) => {
                  setPassword(value);
                  setError("");
                }}
              />
              <PasswordField
                id="invitation-password-confirmation"
                label="Confirme sua senha"
                autoComplete="new-password"
                value={passwordConfirmation}
                show={showPassword}
                onChange={(value) => {
                  setPasswordConfirmation(value);
                  setError("");
                }}
              />
            </>
          ) : session ? (
            <div className={styles.currentSession} role="status">
              <ShieldCheck aria-hidden="true" />
              <span>
                Conectado como <strong>{session.name}</strong>
              </span>
            </div>
          ) : (
            <PasswordField
              id="invitation-current-password"
              label="Senha atual"
              autoComplete="current-password"
              value={currentPassword}
              show={showPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                setError("");
              }}
            />
          )}

          {isNewIdentity || !session ? (
            <button
              className={styles.showPassword}
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {showPassword ? "Ocultar senha" : "Mostrar senha"}
            </button>
          ) : null}

          <label className={styles.remember}>
            <input
              type="checkbox"
              aria-label="Manter minha conexão"
              checked={rememberConnection}
              onChange={(event) => setRememberConnection(event.target.checked)}
            />
            <span>
              <strong>Manter minha conexão</strong>
              <small>Use somente em um dispositivo pessoal.</small>
            </span>
          </label>

          {error ? (
            <div className={styles.error} role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {wrongSession ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                logout();
                setWrongSession(false);
                setError("");
              }}
            >
              Sair e usar a conta convidada
            </Button>
          ) : null}

          <Button type="submit" loading={submitting}>
            {isNewIdentity ? "Ativar meu acesso" : "Aceitar convite"}
          </Button>
        </form>
      </article>
    </PublicLayout>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <a className={styles.brand} href="/" aria-label="ClinicFlow — início">
        <img src="/clinicflow-logo.png" alt="" />
        <span>ClinicFlow</span>
      </a>
      {children}
      <p className={styles.privacyNote}>
        Sua referência e suas senhas não são exibidas nem armazenadas nesta página.
      </p>
    </main>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span aria-hidden="true">{icon}</span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function PasswordField({
  autoComplete,
  hint,
  id,
  label,
  onChange,
  show,
  value,
}: {
  autoComplete: string;
  hint?: string;
  id: string;
  label: string;
  onChange(value: string): void;
  show: boolean;
  value: string;
}) {
  return (
    <Field
      id={id}
      label={label}
      type={show ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      hint={hint}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TerminalState({
  action,
  alert = false,
  icon,
  label,
  message,
  title,
}: {
  action?: ReactNode;
  alert?: boolean;
  icon: ReactNode;
  label: string;
  message: string;
  title: string;
}) {
  return (
    <section
      className={styles.stateCard}
      data-tone={alert ? "attention" : "neutral"}
      role={alert ? "alert" : "status"}
      aria-label={label}
    >
      <span className={styles.stateIcon} aria-hidden="true">{icon}</span>
      <h1>{title}</h1>
      <p>{message}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </section>
  );
}
