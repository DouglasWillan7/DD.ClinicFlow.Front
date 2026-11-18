import clsx from "clsx";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { Link } from "../app/navigation";
import type { ButtonShape, ButtonVariant } from "./Button";
import styles from "./Button.module.css";

interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  variant?: ButtonVariant;
  shape?: ButtonShape;
}

/** Navegação com aparência de botão: é um link de verdade, não um botão com onClick. */
export function ButtonLink({
  children,
  className,
  to,
  variant = "primary",
  shape = "default",
  ...props
}: PropsWithChildren<ButtonLinkProps>) {
  return (
    <Link
      to={to}
      className={clsx(
        styles.button,
        styles[variant],
        shape === "pill" && styles.pill,
        className,
      )}
      {...props}
    >
      <span>{children}</span>
    </Link>
  );
}
