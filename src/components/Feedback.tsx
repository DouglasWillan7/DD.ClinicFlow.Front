import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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

/**
 * Vazio de uma região: diz o que não há e ensina a próxima ação. `action` é um
 * Button (ou ButtonLink) secundário; sem ação possível, fica só a explicação.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {Icon ? <Icon size={24} aria-hidden="true" /> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
