import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "./Button";
import styles from "./Feedback.module.css";

export function LoadingBlock({ label = "Carregando" }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <LoaderCircle size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className={styles.error} role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <strong>Algo saiu do fluxo</strong>
        <p>{message}</p>
      </div>
      {retry ? (
        <Button type="button" variant="secondary" onClick={retry}>
          <RotateCcw size={16} aria-hidden="true" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function SuccessNote({ children }: { children: string }) {
  return (
    <div className={styles.success} role="status">
      <CheckCircle2 size={17} aria-hidden="true" />
      {children}
    </div>
  );
}
