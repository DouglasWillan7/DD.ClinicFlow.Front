import clsx from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren, Ref } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * `pill` é só para a ação principal da página (linha de contexto e cabeçalho);
 * dentro de cartões, formulários e diálogos o botão usa o raio de controle.
 */
export type ButtonShape = "default" | "pill";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  loading?: boolean;
  /** Texto durante o carregamento; sem ele o rótulo fica estável. */
  loadingLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  children,
  className,
  variant = "primary",
  shape = "default",
  loading = false,
  loadingLabel,
  disabled,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={clsx(
        styles.button,
        styles[variant],
        shape === "pill" && styles.pill,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
