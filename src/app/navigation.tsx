/* eslint-disable react-refresh/only-export-components */
import {
  Link as WouterLink,
  useLocation as useWouterLocation,
  useSearchParams as useWouterSearchParams,
} from "wouter";
import type {
  AnchorHTMLAttributes,
  ReactNode,
} from "react";

export function Link({
  to,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  children: ReactNode;
}) {
  return (
    <WouterLink href={to} {...props}>
      {children}
    </WouterLink>
  );
}

export function NavLink({
  to,
  children,
  className,
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "onClick"> & {
  to: string;
  children: ReactNode;
  className?: string | ((state: { isActive: boolean }) => string);
  onClick?: () => void;
}) {
  const [location] = useWouterLocation();
  const isActive = location === to;
  const resolvedClassName =
    typeof className === "function" ? className({ isActive }) : className;

  return (
    <WouterLink
      href={to}
      {...props}
      className={resolvedClassName}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </WouterLink>
  );
}

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
