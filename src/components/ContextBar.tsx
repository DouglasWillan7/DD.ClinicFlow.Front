import { ArrowLeft } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Link } from "../app/navigation";
import styles from "./ContextBar.module.css";

export interface ContextCrumb {
  label: string;
  /** Com `to`, o item é um link real; sem, é só texto de contexto. */
  to?: string;
  /** Marca o item atual quando ele não é o último (Agenda: "Por médico › Dra. Ana"). */
  current?: boolean;
  /** Item que pode encolher com reticências (nomes longos). */
  truncate?: boolean;
}

type BackTarget =
  | { label: string; to: string; onClick?: undefined }
  | { label: string; onClick: () => void; to?: undefined };

/**
 * Linha de contexto das telas de trabalho: trilha, contador, filtros e a ação
 * da página. Substitui o título grande; Início e Configurações usam PageHeader.
 */
export function ContextBar({
  crumbs,
  back,
  currentAs = "text",
  counter,
  children,
  action,
}: {
  crumbs: ContextCrumb[];
  /** Voltar das telas filhas. Com `to` passa pelo aviso de alterações não salvas. */
  back?: BackTarget;
  /** "h1" quando a tela não tem outro título; "text" quando o h1 está no conteúdo. */
  currentAs?: "h1" | "text";
  counter?: ReactNode;
  /** Filtros da lista (FilterChips). No celular vão para a segunda linha. */
  children?: ReactNode;
  action?: ReactNode;
}) {
  const currentIndex = crumbs.some((crumb) => crumb.current)
    ? crumbs.findIndex((crumb) => crumb.current)
    : crumbs.length - 1;

  return (
    <div className={styles.bar}>
      {back ? (
        back.to !== undefined ? (
          <Link className={styles.back} to={back.to} aria-label={back.label}>
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            className={styles.back}
            aria-label={back.label}
            onClick={back.onClick}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )
      ) : null}

      <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === currentIndex;
          const className = crumb.truncate ? styles.truncate : undefined;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              {index > 0 ? (
                <span className={styles.separator} aria-hidden="true">
                  ›
                </span>
              ) : null}
              {isCurrent ? (
                currentAs === "h1" ? (
                  <h1 className={className}>{crumb.label}</h1>
                ) : (
                  <strong className={className} aria-current="page">
                    {crumb.label}
                  </strong>
                )
              ) : crumb.to ? (
                <Link className={className} to={crumb.to}>
                  {crumb.label}
                </Link>
              ) : (
                <span className={className}>{crumb.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>

      {counter !== undefined && counter !== null ? (
        <span className={styles.counter} aria-live="polite">
          {counter}
        </span>
      ) : null}

      <span className={styles.spacer} />

      {children ? <div className={styles.filters}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
