import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { LogIn, RotateCcw, TriangleAlert } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/Button";
import styles from "./AppErrorBoundary.module.css";

const SESSION_KEY = "clinicflow.session";

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro inesperado ao renderizar o ClinicFlow.", error, info);
  }

  private returnToLogin = () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.assign("/entrar");
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className={styles.page}>
        <section className={styles.card} role="alert">
          <BrandMark />
          <span className={styles.icon} aria-hidden="true">
            <TriangleAlert size={22} />
          </span>
          <h1>Não foi possível abrir esta tela.</h1>
          <p>
            O ClinicFlow encontrou uma informação incompatível ao navegar. Você
            pode tentar recarregar ou iniciar uma sessão limpa.
          </p>
          <div className={styles.actions}>
            <Button type="button" onClick={() => window.location.reload()}>
              <RotateCcw size={17} aria-hidden="true" />
              Tentar novamente
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={this.returnToLogin}
            >
              <LogIn size={17} aria-hidden="true" />
              Voltar para entrar
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
