/* eslint-disable react-refresh/only-export-components */
import { TriangleAlert } from "lucide-react";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";

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
  // Esc e clique no fundo equivalem a continuar editando; sem botão fechar, a
  // decisão fica explícita no rodapé.
  return (
    <Dialog
      size="sm"
      tone="danger"
      icon={<TriangleAlert size={20} />}
      title="Descartar alterações?"
      description="As informações preenchidas ainda não foram salvas e serão perdidas se você sair agora."
      closeLabel={null}
      onClose={onKeep}
      footer={
        <>
          <Button type="button" variant="secondary" autoFocus onClick={onKeep}>
            Continuar editando
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Descartar alterações
          </Button>
        </>
      }
    />
  );
}
