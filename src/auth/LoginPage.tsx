import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Check, FileText } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../api/client";
import { Link, useLocation, useNavigate } from "../app/navigation";
import { useAuth } from "./AuthProvider";
import styles from "./LoginPage.module.css";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe e-mail e senha para continuar."),
  password: z.string().trim().min(1, "Informe e-mail e senha para continuar."),
  rememberConnection: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberConnection: true },
  });

  const [email, password] = useWatch({
    control,
    name: ["email", "password"],
  });
  const hasEmptyField = !email.trim() || !password.trim();
  const validationError = errors.email?.message ?? errors.password?.message;

  const clearFeedback = () => {
    clearErrors();
    setServerError(undefined);
  };

  const submit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      await login(values.email.trim(), values.password, values.rememberConnection);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/app/agenda", { replace: true });
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status === 401
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Verifique sua conexão e tente novamente.",
      );
    }
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.showcase} aria-label="Conheça o ClinicFlow">
          <div className={styles.glow} aria-hidden="true" />
          <img
            className={styles.logo}
            src="/clinicflow-logo.png"
            alt="ClinicFlow"
          />
          <h1>A rotina clínica da sua equipe, do agendamento ao laudo.</h1>

          <div className={styles.featureStack} aria-hidden="true">
            <div className={`${styles.featureCard} ${styles.patientCard}`}>
              <span className={styles.avatar}>JP</span>
              <span className={styles.featureText}>
                <strong>João Pedro Almeida</strong>
                <small>Consulta de retorno · 09:30</small>
              </span>
              <span className={styles.confirmed}>Confirmada</span>
            </div>

            <div className={`${styles.featureCard} ${styles.transcriptionCard}`}>
              <span className={styles.recordingDot} />
              <strong>Transcrevendo consulta</strong>
              <span className={styles.equalizer}>
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className={`${styles.featureCard} ${styles.reportCard}`}>
              <span className={styles.documentIcon}>
                <FileText size={22} strokeWidth={1.8} />
              </span>
              <span className={styles.featureText}>
                <strong>Laudo de endoscopia</strong>
                <small>Análise de documentos · laudo lido pela IA</small>
              </span>
              <div className={styles.chips}>
                <span>Sintoma</span>
                <span>Conduta</span>
                <span>Exame</span>
                <span>+5 pontos</span>
              </div>
            </div>

            <div className={`${styles.featureCard} ${styles.agendaCard}`}>
              <CalendarDays size={21} strokeWidth={1.8} />
              <strong>12</strong>
              <span>consultas na sua agenda de hoje</span>
            </div>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.mobileLogo}>
            <img src="/clinicflow-logo.png" alt="ClinicFlow" />
          </div>
          <div className={styles.formContent}>
            <header>
              <h2>Acesse sua conta</h2>
              <p>Entre com suas credenciais institucionais.</p>
            </header>

            <form className={styles.form} onSubmit={submit} noValidate>
              {serverError || validationError ? (
                <div className={styles.errorBanner} role="alert">
                  {serverError ?? "Informe e-mail e senha para continuar."}
                </div>
              ) : null}

              <label className={styles.field} htmlFor="login-email">
                <span>E-mail</span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@clinica.com.br"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email", { onChange: clearFeedback })}
                />
              </label>

              <div className={styles.passwordField}>
                <div className={styles.fieldHeading}>
                  <label htmlFor="login-password">Senha</label>
                  <button
                    type="button"
                    onClick={() =>
                      setServerError(
                        "A recuperação de senha ainda não está disponível. Peça acesso ao administrador da sua clínica.",
                      )
                    }
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className={styles.passwordInput}>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(errors.password)}
                    {...register("password", { onChange: clearFeedback })}
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
                <input type="checkbox" {...register("rememberConnection")} />
                <span className={styles.checkbox} aria-hidden="true">
                  <Check size={15} strokeWidth={2.4} />
                </span>
                <span>Manter conectado neste computador</span>
              </label>

              <button
                className={styles.submit}
                type="submit"
                disabled={isSubmitting}
                data-incomplete={hasEmptyField || undefined}
              >
                {isSubmitting ? <span className={styles.spinner} aria-hidden="true" /> : null}
                <span>{isSubmitting ? "Entrando..." : "Entrar"}</span>
              </button>
            </form>

            <p className={styles.footer}>
              Novo por aqui? <Link to="/cadastro">Criar conta</Link>
              <span aria-hidden="true"> · </span>
              ou peça acesso ao administrador da sua clínica.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
