import clsx from "clsx";
import {
  Clock3,
  ExternalLink,
  FileText,
  Pencil,
  RefreshCcw,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type {
  ClinicalExamReport,
  PatientExamDetail,
  PatientExamRevision,
} from "../../../api/types";
import { Button } from "../../../components/Button";
import {
  confidencePresentation,
  formatExamDate,
  formatExamResultValue,
} from "./examDetail";
import styles from "./ExamDetailPanel.module.css";
import { FailedExamRecovery } from "./FailedExamRecovery";
import { ReviewExamDiscard } from "./ReviewExamDiscard";
import { ValidatedExamReport } from "./ValidatedExamReport";

interface ExamDetailPanelProps {
  exam: PatientExamDetail;
  report?: ClinicalExamReport;
  requesterLabel?: string | null;
  loadDocument?: () => Promise<Blob>;
  onEditRequest?: () => void;
  onCancelRequest?: () => void;
  onAttachDocument?: () => void;
  onRetry?: () => void;
  onDiscard?: () => Promise<void>;
  onReload?: () => void;
  onOpenCorrection?: () => void;
  onEditRevision?: () => void;
  onShowHistory?: () => void;
}

function Confidence({ value }: { value: number | null }) {
  const confidence = confidencePresentation(value);
  return (
    <span className={clsx(styles.confidence, confidence.isLow && styles.lowConfidence)}>
      <span>{confidence.label}</span>
      {confidence.isLow ? <small>Prioridade de revisão</small> : null}
    </span>
  );
}

function RevisionContent({ revision }: { revision: PatientExamRevision }) {
  return (
    <div className={styles.revisionContent}>
      {revision.structuredResults.length ? (
        <div className={styles.tableScroller}>
          <table className={styles.resultsTable} aria-label="Resultados estruturados">
            <thead>
              <tr>
                <th scope="col">Resultado</th>
                <th scope="col">Valor</th>
                <th scope="col">Referência</th>
                <th scope="col">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {[...revision.structuredResults].sort((a, b) => a.order - b.order).map((result) => (
                <tr key={result.id} className={result.confidence !== null && result.confidence < 0.93 ? styles.lowRow : undefined}>
                  <td data-label="Resultado">
                    <strong>{result.name}</strong>
                    {result.catalogCode ? <small>{result.catalogCode}</small> : null}
                  </td>
                  <td data-label="Valor">
                    {formatExamResultValue(result)}
                    {result.outOfRangeSuggestion ? <small className={styles.outOfRange}>Fora da referência sugerida</small> : null}
                  </td>
                  <td data-label="Referência">{result.referenceText || "Não informada"}</td>
                  <td data-label="Confiança"><Confidence value={result.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {revision.narrativeSections.length ? (
        <section className={styles.contentGroup} aria-labelledby={`narratives-${revision.id}`}>
          <h3 id={`narratives-${revision.id}`}>Seções narrativas</h3>
          {[...revision.narrativeSections].sort((a, b) => a.order - b.order).map((section) => (
            <article key={section.id} className={clsx(styles.narrative, section.confidence !== null && section.confidence < 0.93 && styles.lowBlock)}>
              <div>
                <h4>{section.title}</h4>
                <Confidence value={section.confidence} />
              </div>
              <p>{section.text}</p>
            </article>
          ))}
        </section>
      ) : null}

      {revision.structuredFindings.length ? (
        <section className={styles.contentGroup} aria-labelledby={`findings-${revision.id}`}>
          <h3 id={`findings-${revision.id}`}>Achados</h3>
          <dl className={styles.findings}>
            {[...revision.structuredFindings].sort((a, b) => a.order - b.order).map((finding) => (
              <div key={finding.id} className={finding.confidence !== null && finding.confidence < 0.93 ? styles.lowBlock : undefined}>
                <dt>{finding.key}</dt>
                <dd>
                  <span>{finding.value}</span>
                  <Confidence value={finding.confidence} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

export function ExamDetailPanel({
  exam,
  report,
  requesterLabel,
  loadDocument,
  onEditRequest,
  onCancelRequest,
  onAttachDocument,
  onRetry,
  onDiscard,
  onReload,
  onOpenCorrection,
  onEditRevision,
  onShowHistory,
}: ExamDetailPanelProps) {
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);

  const openDocument = async () => {
    setDocumentError(null);
    setOpeningDocument(true);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setDocumentError("O laudo original está indisponível no momento.");
      setOpeningDocument(false);
      return;
    }
    tab.opener = null;

    try {
      if (!loadDocument) throw new Error("Document loader unavailable");
      const blob = await loadDocument();
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      tab.close();
      setDocumentError("O laudo original está indisponível no momento.");
    } finally {
      setOpeningDocument(false);
    }
  };

  const reviewRevision = exam.capabilities.canEditRevision ? exam.draftRevision : null;

  if (exam.status === "Validado" && report) {
    return (
      <ValidatedExamReport
        report={report}
        loadDocument={loadDocument}
        onShowHistory={onShowHistory}
        onOpenCorrection={exam.capabilities.canOpenCorrection ? onOpenCorrection : undefined}
        onEditRevision={exam.capabilities.canEditRevision && exam.draftRevision ? onEditRevision : undefined}
      />
    );
  }

  return (
    <article className={styles.panel} aria-labelledby={`exam-title-${exam.id}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{exam.category}</p>
          <h2 id={`exam-title-${exam.id}`}>{exam.name}</h2>
        </div>
        <span className={clsx(styles.status, styles[`status${exam.status.replaceAll(" ", "")}`])}>{exam.status}</span>
      </header>

      {exam.status === "Solicitado" ? (
        <section className={styles.stateSection} aria-labelledby={`request-${exam.id}`}>
          <div className={styles.sectionHeading}>
            <Clock3 size={20} aria-hidden="true" />
            <h3 id={`request-${exam.id}`}>Solicitação</h3>
          </div>
          <dl className={styles.metadata}>
            <div><dt>Data prevista</dt><dd>{formatExamDate(exam.scheduledOn)}</dd></div>
            <div><dt>Solicitante</dt><dd>{requesterLabel || "Solicitante não informado"}</dd></div>
          </dl>
          <div className={styles.actions}>
            {exam.capabilities.canEditRequest && onEditRequest ? <Button variant="secondary" onClick={onEditRequest}><Pencil size={16} aria-hidden="true" />Editar solicitação</Button> : null}
            {exam.capabilities.canCancelRequest && onCancelRequest ? <Button variant="ghost" onClick={onCancelRequest}>Cancelar solicitação</Button> : null}
            {exam.capabilities.canAttachDocument && onAttachDocument ? <Button onClick={onAttachDocument}><Upload size={16} aria-hidden="true" />Anexar laudo</Button> : null}
          </div>
        </section>
      ) : null}

      {exam.document ? (
        <section className={styles.documentSection} aria-labelledby={`document-${exam.id}`}>
          <div className={styles.sectionHeading}>
            <FileText size={20} aria-hidden="true" />
            <h3 id={`document-${exam.id}`}>Documento original</h3>
          </div>
          <div className={styles.documentRow}>
            <div>
              <strong>{exam.document.fileName}</strong>
              <span>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(exam.document.sizeBytes / 1024)} KB · {exam.document.source}</span>
            </div>
            <Button variant="secondary" loading={openingDocument} onClick={openDocument}>
              <ExternalLink size={16} aria-hidden="true" />Abrir laudo original em nova aba
            </Button>
          </div>
          {documentError ? <p className={styles.regionalError} role="alert">{documentError}</p> : null}
        </section>
      ) : exam.status !== "Solicitado" && exam.status !== "Cancelado" ? (
        <section className={styles.documentSection} role="region" aria-label="Documento original">
          <div className={styles.sectionHeading}><FileText size={20} aria-hidden="true" /><h3>Documento original</h3></div>
          <p className={styles.unavailable}>Original indisponível</p>
        </section>
      ) : null}

      {exam.status === "Pendente" || exam.status === "Processando" ? (
        <section className={styles.processing} role="status">
          <div className={styles.sectionHeading}><RefreshCcw size={20} aria-hidden="true" /><h3>Extração em andamento</h3></div>
          <p>{exam.status === "Pendente" ? "Laudo recebido. Aguardando o início da extração." : "Extraindo resultados do laudo original."}</p>
          <div className={styles.skeleton} data-testid="exam-detail-skeleton" aria-hidden="true">
            <span /><span /><span />
          </div>
        </section>
      ) : null}

      {exam.status === "Falhou" ? (
        <FailedExamRecovery
          key={exam.id}
          exam={exam}
          onRetry={onRetry}
          onDiscard={onDiscard}
          onReload={onReload}
        />
      ) : null}

      {exam.status === "Em revisão" ? (
        <section className={styles.review} aria-labelledby={`review-${exam.id}`}>
          <div className={styles.reviewHeading}>
            <div>
              <p>Sugestão da IA</p>
              <h3 id={`review-${exam.id}`}>{reviewRevision?.aiSuggestedOutcome || "Inconclusivo"}</h3>
            </div>
            {reviewRevision ? <Confidence value={reviewRevision.averageConfidence} /> : null}
          </div>
          {reviewRevision ? <RevisionContent revision={reviewRevision} /> : <p>Conteúdo disponível somente para revisão médica.</p>}
          {reviewRevision && onEditRevision ? <div className={styles.actions}><Button onClick={onEditRevision}><Pencil size={16} aria-hidden="true" />Corrigir valores</Button></div> : null}
          {exam.capabilities.canDiscardExam && onDiscard ? (
            <ReviewExamDiscard
              key={exam.id}
              examId={exam.id}
              onDiscard={onDiscard}
              onReload={onReload}
            />
          ) : null}
        </section>
      ) : null}

    </article>
  );
}
