/* eslint-disable react-refresh/only-export-components */
import {
  Link as WouterLink,
  Redirect as WouterRedirect,
  useLocation as useWouterLocation,
  useSearchParams as useWouterSearchParams,
} from "wouter";
import type {
  AnchorHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { useConfirmDiscard, useHasUnsavedChanges } from "./unsavedChanges";

/**
 * Clique em link com formulário alterado: segura a navegação e só a conclui
 * depois que a pessoa confirma o descarte (regra geral do portal).
 */
function useGuardedLinkClick(to: string, target?: string) {
  const [, navigate] = useWouterLocation();
  const hasUnsavedChanges = useHasUnsavedChanges();
  const confirmDiscard = useConfirmDiscard();

  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || target === "_blank" || !hasUnsavedChanges()) {
      return;
    }
    event.preventDefault();
    confirmDiscard(() => navigate(to));
  };
}

export function Link({
  to,
  children,
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  children: ReactNode;
}) {
  const guardClick = useGuardedLinkClick(to, props.target);

  return (
    <WouterLink
      href={to}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        guardClick(event);
      }}
    >
      {children}
    </WouterLink>
  );
}

export function NavLink({
  to,
  children,
  className,
  onClick,
  matchChildren = false,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "onClick"> & {
  to: string;
  children: ReactNode;
  className?: string | ((state: { isActive: boolean }) => string);
  onClick?: () => void;
  /** Mantém o destino ativo nas páginas filhas (`/app/pacientes/:id`). */
  matchChildren?: boolean;
}) {
  const [location] = useWouterLocation();
  const guardClick = useGuardedLinkClick(to, props.target);
  const isCurrentPage = location === to;
  const isActive =
    isCurrentPage || (matchChildren && location.startsWith(`${to}/`));
  const resolvedClassName =
    typeof className === "function" ? className({ isActive }) : className;

  return (
    <WouterLink
      href={to}
      {...props}
      className={resolvedClassName}
      onClick={(event) => {
        onClick?.();
        guardClick(event);
      }}
      // "page" só no caminho exato; numa página filha o destino é o ancestral ativo.
      aria-current={isCurrentPage ? "page" : isActive ? "true" : undefined}
    >
      {children}
    </WouterLink>
  );
}

/** Mesmo `Redirect` do roteador, exposto aqui para as páginas não importarem wouter. */
export const Redirect = WouterRedirect;

export function useNavigate() {
  const [, navigate] = useWouterLocation();
  return (
    to: string,
    options?: { replace?: boolean; state?: Record<string, unknown> },
  ) => navigate(to, options);
}

export function useLocation() {
  const [pathname] = useWouterLocation();
  return {
    pathname,
    state: window.history.state as Record<string, unknown> | null,
  };
}

export function useSearchParams() {
  return useWouterSearchParams();
}
