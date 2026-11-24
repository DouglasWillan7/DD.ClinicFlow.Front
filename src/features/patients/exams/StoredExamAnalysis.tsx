import { FileCheck2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PatientExamDetail } from "../../../api/types";
import { Button } from "../../../components/Button";
import { ReviewExamDiscard } from "./ReviewExamDiscard";
import styles from "./StoredExamAnalysis.module.css";

interface StoredExamAnalysisProps {
  exam: PatientExamDetail;
  /** Por que a análise por IA não pode começar agora; nulo quando pode. */
  analysisUnavailable?: string | null;
  onRequestAnalysis?(): Promise<void> | void;
  onDiscard?(): Promise<void>;
  onReload?(): void;
}

/**
 * Documento guardado sem análise por IA. Não é falha: o PDF está no histórico e a análise é um
 * passo opcional que pode ser pedido aqui.
 */
export function StoredExamAnalysis({
  exam,
  analysisUnavailable,
  onRequestAnalysis,
  onDiscard,
  onReload,
}: StoredExamAnalysisProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function requestAnalysis() {
    if (!onRequestAnalysis || pending) return;
    setPending(true);
    setError(null);
    try {
      await onRequestAnalysis();
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a análise por IA.");
      }
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  const headingId = `stored-analysis-${exam.id}`;
  const canRequest = exam.capabilities.canRequestAnalysis && Boolean(onRequestAnalysis);

  return (
    <section className={styles.stored} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <FileCheck2 size={20} aria-hidden="true" />
        <h3 id={headingId}>Documento salvo, sem análise por IA</h3>
      </div>
      <p>
        {exam.analysisHold === "Indisponivel"
          ? "A análise foi pedida, mas a IA estava indisponível. O PDF está guardado no histórico e pode ser aberto acima."
          : "Este laudo foi só guardado. O PDF está no histórico e pode ser aberto acima."}
      </p>
      {canRequest && analysisUnavailable ? (
        <p className={styles.unavailable}>{analysisUnavailable} O documento continua salvo.</p>
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {canRequest ? (
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            disabled={Boolean(analysisUnavailable)}
            onClick={() => void requestAnalysis()}
          >
            <Sparkles size={16} aria-hidden="true" />
            Analisar com IA
          </Button>
        </div>
      ) : null}
      {exam.capabilities.canDiscardExam && onDiscard ? (
        <ReviewExamDiscard examId={exam.id} onDiscard={onDiscard} onReload={onReload} />
      ) : null}
    </section>
  );
}
