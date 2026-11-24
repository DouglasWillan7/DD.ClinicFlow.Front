import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import type { PatientExamDetail } from "../../../api/types";
import { Button } from "../../../components/Button";
import { processingAttemptsLabel } from "./examDetail";
import styles from "./FailedExamRecovery.module.css";

interface FailedExamRecoveryProps {
  exam: PatientExamDetail;
  /** Por que a análise por IA não pode recomeçar agora; nulo quando pode. */
  analysisUnavailable?: string | null;
  onRetry?(): Promise<void> | void;
  onDiscard?(): Promise<void>;
  onReload?(): void;
}

export function FailedExamRecovery({
  exam,
  analysisUnavailable,
  onRetry,
  onDiscard,
  onReload,
}: FailedExamRecoveryProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"conflict" | "generic" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const triggerContainerRef = useRef<HTMLSpanElement>(null);
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
      triggerContainerRef.current?.querySelector("button")?.focus();
    }
  }, [confirming]);

  function cancelDiscard() {
    if (pending) return;
    restoreFocusRef.current = true;
    setError(null);
    setConfirming(false);
  }

  async function confirmDiscard() {
    if (!onDiscard || pendingRef.current) return;
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

  async function retry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await onRetry();
    } catch (caught) {
      if (mountedRef.current) {
        setRetryError(caught instanceof Error ? caught.message : "Não foi possível reprocessar o laudo.");
      }
    } finally {
      if (mountedRef.current) setRetrying(false);
    }
  }

  const confirmationId = `discard-confirmation-${exam.id}`;

  return (
    <section className={styles.recovery} aria-labelledby={`failure-${exam.id}`}>
      <div className={styles.heading}>
        <AlertTriangle size={20} aria-hidden="true" />
        <h3 id={`failure-${exam.id}`}>Não foi possível extrair o laudo</h3>
      </div>
      <p className={styles.processingError} role="alert">
        {exam.error || "A extração não foi concluída. Tente novamente ou envie outro PDF."}
      </p>
      {/* A falha é da análise por IA: o envio deu certo e o PDF segue no histórico. */}
      <p className={styles.documentKept}>
        O documento original continua salvo e pode ser aberto acima.
      </p>
      <strong>{processingAttemptsLabel(exam.attemptsRemaining)}</strong>
      {analysisUnavailable && exam.capabilities.canReprocess && exam.attemptsRemaining > 0 ? (
        <p className={styles.documentKept}>{analysisUnavailable}</p>
      ) : null}
      {retryError ? <p className={styles.processingError} role="alert">{retryError}</p> : null}

      {!confirming ? (
        <div className={styles.actions}>
          {exam.capabilities.canReprocess && exam.attemptsRemaining > 0 && onRetry ? (
            <Button
              variant="secondary"
              loading={retrying}
              disabled={Boolean(analysisUnavailable)}
              onClick={() => void retry()}
            >
              <RefreshCcw size={16} aria-hidden="true" />
              Tentar processar novamente
            </Button>
          ) : null}
          {exam.capabilities.canDiscardFailedExam && onDiscard ? (
            <span ref={triggerContainerRef} className={styles.actionItem}>
              <Button
                variant="danger"
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
              >
                Descartar laudo
              </Button>
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className={styles.confirmation}
          role="region"
          aria-labelledby={confirmationId}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              cancelDiscard();
            }
          }}
        >
          <h4 id={confirmationId} ref={confirmationTitleRef} tabIndex={-1}>
            Confirmar descarte do laudo
          </h4>
          <p>
            O laudo será retirado da lista principal, mas continuará registrado para auditoria. Depois disso, você poderá enviar este PDF novamente.
          </p>
          {error ? (
            <div className={styles.submitError} role="alert">
              <span>
                {error === "conflict"
                  ? "Este exame foi atualizado por outra pessoa. Recarregue os dados antes de tentar novamente."
                  : "Não foi possível descartar o laudo. Tente novamente."}
              </span>
              {error === "conflict" && onReload ? (
                <Button type="button" variant="secondary" onClick={onReload}>
                  Recarregar dados atuais
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className={styles.confirmationActions}>
            <Button type="button" variant="ghost" disabled={pending} onClick={cancelDiscard}>
              Manter laudo
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void confirmDiscard()}
            >
              Descartar e enviar novamente
            </Button>
          </div>
          {pending ? <span className={styles.liveStatus} role="status">Descartando laudo…</span> : null}
        </div>
      )}
    </section>
  );
}
