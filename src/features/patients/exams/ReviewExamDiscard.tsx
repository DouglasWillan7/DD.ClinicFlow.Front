import { Trash2 } from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import { Button } from "../../../components/Button";
import styles from "./ReviewExamDiscard.module.css";

interface ReviewExamDiscardProps {
  examId: string;
  onDiscard(): Promise<void>;
  onReload?(): void;
  placement?: "section" | "toolbar";
}

export function ReviewExamDiscard({ examId, onDiscard, onReload, placement = "section" }: ReviewExamDiscardProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"conflict" | "generic" | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const confirmationTitleRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(true);
  const pendingRef = useRef(false);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (confirming) {
      confirmationTitleRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.querySelector("button")?.focus();
    }
  }, [confirming]);

  function cancel() {
    if (pending) return;
    restoreFocusRef.current = true;
    setError(null);
    setConfirming(false);
  }

  async function confirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onDiscard();
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof ApiError && caught.status === 409 ? "conflict" : "generic");
      }
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }

  const confirmationId = `review-discard-confirmation-${examId}`;

  if (!confirming) {
    return (
      <div className={clsx(styles.triggerRow, placement === "toolbar" && styles.toolbarTrigger)}>
        <span ref={triggerRef}>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Descartar exame
        </Button>
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx(styles.confirmation, placement === "toolbar" && styles.toolbarConfirmation)}
      role="region"
      aria-labelledby={confirmationId}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <h4 id={confirmationId} ref={confirmationTitleRef} tabIndex={-1}>
        Confirmar descarte do exame
      </h4>
      <p>
        O exame será retirado da lista principal, mas o documento e a revisão continuarão registrados para auditoria. Depois disso, você poderá enviar um novo laudo.
      </p>
      {error ? (
        <div className={styles.error} role="alert">
          <span>
            {error === "conflict"
              ? "Este exame foi atualizado por outra pessoa. Recarregue os dados antes de tentar novamente."
              : "Não foi possível descartar o exame. Tente novamente."}
          </span>
          {error === "conflict" && onReload ? (
            <Button type="button" variant="secondary" onClick={onReload}>
              Recarregar dados atuais
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button type="button" variant="ghost" disabled={pending} onClick={cancel}>
          Manter exame
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending}
          aria-busy={pending}
          onClick={() => void confirm()}
        >
          Descartar exame
        </Button>
      </div>
      {pending ? <span className={styles.liveStatus} role="status">Descartando exame…</span> : null}
    </div>
  );
}
