/* eslint-disable react-refresh/only-export-components */
import { TriangleAlert } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../components/Button";
import styles from "./UnsavedChangesDialog.module.css";

interface UnsavedChangesContextValue {
  /** Marca um formulário com alterações pendentes; devolve a função que desmarca. */
  track(): () => void;
  hasUnsavedChanges(): boolean;
  /** Executa a ação na hora ou, havendo alterações pendentes, só depois da confirmação. */
  confirmDiscard(action: () => void): void;
}

// Sem provider (testes de componente isolado) nada é bloqueado.
const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  track: () => () => undefined,
  hasUnsavedChanges: () => false,
  confirmDiscard: (action) => action(),
});

/**
 * Regra geral do portal: sair de um formulário com alterações não salvas pede
 * confirmação. O formulário se declara com `useUnsavedChangesGuard(isDirty)`; os
 * links de `navigation.tsx` e as saídas explícitas (Cancelar, Sair, trocar de
 * clínica) passam por `confirmDiscard`. Navegação programática após salvar
 * (`useNavigate`) não é interceptada de propósito.
 */
export function UnsavedChangesProvider({ children }: PropsWithChildren) {
  const dirtySources = useRef(0);
  const [pendingAction, setPendingAction] = useState<() => void>();

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      track() {
        dirtySources.current += 1;
        return () => {
          dirtySources.current -= 1;
        };
      },
      hasUnsavedChanges: () => dirtySources.current > 0,
      confirmDiscard(action) {
        if (dirtySources.current === 0) {
          action();
          return;
        }
        setPendingAction(() => action);
      },
    }),
    [],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pendingAction ? (
        <DiscardChangesDialog
          onKeep={() => setPendingAction(undefined)}
          onDiscard={() => {
            setPendingAction(undefined);
            pendingAction();
          }}
        />
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

/** Declara que o formulário atual tem alterações não salvas enquanto `dirty` for verdadeiro. */
export function useUnsavedChangesGuard(dirty: boolean) {
  const { track } = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (!dirty) return;
    const release = track();
    // Fechar a aba ou recarregar só pode ser confirmado pelo aviso nativo do navegador.
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      release();
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [dirty, track]);
}

export function useConfirmDiscard() {
  return useContext(UnsavedChangesContext).confirmDiscard;
}

export function useHasUnsavedChanges() {
  return useContext(UnsavedChangesContext).hasUnsavedChanges;
}

function DiscardChangesDialog({
  onKeep,
  onDiscard,
}: {
  onKeep(): void;
  onDiscard(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const open = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", "");
  }, []);

  // Fechar pelo método nativo devolve o foco a quem abriu o diálogo.
  function finish(callback: () => void) {
    const node = dialogRef.current;
    if (node?.open && typeof node.close === "function") node.close();
    callback();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    finish(onKeep);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) finish(onKeep);
  }

  return (
    <dialog
      ref={open}
      className={styles.dialog}
      aria-labelledby="discard-changes-title"
      aria-describedby="discard-changes-description"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <span className={styles.icon} aria-hidden="true">
          <TriangleAlert size={20} />
        </span>
        <h2 id="discard-changes-title">Descartar alterações?</h2>
        <p id="discard-changes-description">
          As informações preenchidas ainda não foram salvas e serão perdidas se
          você sair agora.
        </p>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            autoFocus
            onClick={() => finish(onKeep)}
          >
            Continuar editando
          </Button>
          <Button type="button" variant="danger" onClick={() => finish(onDiscard)}>
            Descartar alterações
          </Button>
        </div>
      </div>
    </dialog>
  );
}
