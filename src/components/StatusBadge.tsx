import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import styles from "./StatusBadge.module.css";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Estado em pílula: sempre rótulo, ícone e cor juntos. Não tem `role="status"`:
 * é um rótulo estático, e anunciar cada badge de uma lista seria ruído.
 */
export function StatusBadge({
  tone,
  icon: Icon,
  children,
  className,
  ...props
}: {
  tone: StatusTone;
  icon: LucideIcon;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={clsx(styles.badge, styles[tone], className)} {...props}>
      <Icon size={13} aria-hidden="true" />
      {children}
    </span>
  );
}
