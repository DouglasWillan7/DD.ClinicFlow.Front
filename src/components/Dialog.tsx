import clsx from "clsx";
import { X } from "lucide-react";
import {
  useCallback,
  useId,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import styles from "./Dialog.module.css";

/**
 * Diálogo modal do sistema, sobre `<dialog>` nativo: o navegador prende o foco,
 * torna o resto da página inerte e devolve o foco a quem abriu.
 *
 * Renderize condicionalmente (`{aberto ? <Dialog … /> : null}`) ou controle por
 * `open`; nos dois casos o fechamento passa pelo método nativo.
 */
export function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon,
  tone = "neutral",
  size = "md",
  role = "dialog",
  dismissible = true,
  closeLabel = "Fechar",
  footer,
  children,
}: {
  open?: boolean;
  /**
   * Chamado por Esc, clique no fundo e botão fechar. É um pedido: o diálogo só
   * fecha quando quem controla o desmonta (ou passa `open={false}`).
   */
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  /** Ícone opcional ao lado do título; `tone` define a cor do seu fundo. */
  icon?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  /** "alertdialog" para confirmações que interrompem (descartar, excluir). */
  role?: "dialog" | "alertdialog";
  /** `false` enquanto uma operação está em curso: Esc e clique no fundo não fecham. */
  dismissible?: boolean;
  /** Rótulo do botão fechar; `null` remove o botão (a decisão fica só no rodapé). */
  closeLabel?: string | null;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  // O ref devolve a limpeza (React 19): quando o diálogo sai da árvore — por
  // `open` ou porque quem o controla o desmontou —, o fechamento nativo
  // acontece antes da remoção e o foco volta ao gatilho.
  const attach = useCallback((node: HTMLDialogElement | null) => {
    if (!node) return;
    if (!node.open) {
      // jsdom não implementa showModal; o atributo mantém o diálogo consultável.
      if (typeof node.showModal === "function") node.showModal();
      else node.setAttribute("open", "");
    }
    return () => {
      if (node.open && typeof node.close === "function") node.close();
    };
  }, []);

  if (!open) return null;

  // Só pede o fechamento; o fechamento nativo fica com a limpeza do ref. Fechar
  // aqui deixaria o <dialog> invisível e ainda montado quando quem controla
  // recusa o pedido (ex.: "Continuar editando" ao descartar alterações).
  function requestClose() {
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (dismissible) requestClose();
  }

  // O Esc nativo fecharia o diálogo sem avisar o estado do React.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (dismissible) requestClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissible && event.target === event.currentTarget) requestClose();
  }

  return (
    <dialog
      ref={attach}
      className={clsx(styles.dialog, styles[size])}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          {icon ? (
            <span className={clsx(styles.icon, styles[`icon-${tone}`])} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className={styles.heading}>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {closeLabel !== null ? (
            <button
              type="button"
              className={styles.close}
              aria-label={closeLabel}
              disabled={!dismissible}
              onClick={requestClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          ) : null}
        </header>
        {children ? <div className={styles.body}>{children}</div> : null}
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </dialog>
  );
}
