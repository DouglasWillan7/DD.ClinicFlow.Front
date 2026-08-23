import clsx from "clsx";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileText,
  History,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ClinicalExamFinding,
  ClinicalExamReport,
  ClinicalExamResult,
  ClinicalReferenceState,
} from "../../../api/types";
import { Button } from "../../../components/Button";
import { ClinicalSparkline } from "../ClinicalSparkline";
import { formatDateOnly } from "../patientFormatters";
import {
  clinicalExamCategoryLabel,
  clinicalExamOutcomeLabel,
  formatDelta,
  referenceStateLabel,
  withoutDerivedStructuredFindings,
} from "./clinicalReport";
import { formatFileSize } from "./examDetail";
import styles from "./ValidatedExamReport.module.css";

interface ValidatedExamReportProps {
  report: ClinicalExamReport;
  loadDocument?: () => Promise<Blob>;
  onShowHistory?: () => void;
  onOpenCorrection?: () => void;
  onEditRevision?: () => void;
}

function resultDomId(resultId: string) {
  return `clinical-result-${resultId}`;
}

function formatLocalDateTime(value: string | null | undefined) {
  if (!value) return "Não informada";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "Não informada";
  return `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`;
}

function formatUtcDateTime(value: string | null | undefined) {
  if (!value) return "Não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function stateLabel(state: ClinicalReferenceState) {
  return referenceStateLabel(state);
}

function stateIcon(state: ClinicalReferenceState, size = 16) {
  if (state === "normal") return <CheckCircle2 size={size} strokeWidth={2} aria-hidden="true" />;
  if (state === "indeterminado") return <CircleHelp size={size} strokeWidth={2} aria-hidden="true" />;
  if (state === "elevado") return <ArrowUp size={size} strokeWidth={2} aria-hidden="true" />;
  if (state === "baixo") return <ArrowDown size={size} strokeWidth={2} aria-hidden="true" />;
  return <ArrowRight size={size} strokeWidth={2} aria-hidden="true" />;
}

function resultValue(valueText: string, unit: string | null) {
  return `${valueText}${unit ? ` ${unit}` : ""}`;
}

function previousHistoryPoint(result: ClinicalExamResult) {
  return result.history.length > 1 ? result.history.at(-2) : null;
}

function reportSummary(report: ClinicalExamReport) {
  if (report.results.length === 0) {
    return clinicalExamOutcomeLabel(report.clinicalOutcome);
  }
  const outsideCount = report.results.filter((result) =>
    result.referenceState === "elevado" || result.referenceState === "baixo"
  ).length;
  if (report.clinicalOutcome === "Alterado") {
    return `Alterado — ${outsideCount} de ${report.results.length} ${report.results.length === 1 ? "resultado" : "resultados"} fora da referência`;
  }
  return clinicalExamOutcomeLabel(report.clinicalOutcome);
}

function findingAccessibleName(finding: ClinicalExamFinding) {
  return `${finding.name} ${resultValue(finding.valueText, finding.unit)}, ${stateLabel(finding.referenceState)}`;
}

export function ValidatedExamReport({
  report,
  loadDocument,
  onShowHistory,
  onOpenCorrection,
  onEditRevision,
}: ValidatedExamReportProps) {
  const structuredFindings = withoutDerivedStructuredFindings(
    report.structuredFindings ?? [],
    report.findings,
    report.results,
  );
  const primaryFindings = report.findings.filter((finding) =>
    finding.referenceState === "elevado" || finding.referenceState === "baixo"
  );
  const [activeSection, setActiveSection] = useState<"findings" | "results" | "notes">(
    structuredFindings.length + primaryFindings.length > 0 ? "findings" : "results",
  );
  const [highlightedResultId, setHighlightedResultId] = useState<string | null>(null);
  const [expandedReferences, setExpandedReferences] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
  }, []);

  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function") return;
    const sections: Array<{ id: string; name: "findings" | "results" | "notes" }> = [
      ...(structuredFindings.length + primaryFindings.length > 0
        ? [{ id: `report-findings-${report.id}`, name: "findings" as const }]
        : []),
      { id: `report-results-${report.id}`, name: "results" },
      ...(report.notes.length > 0
        ? [{ id: `report-notes-${report.id}`, name: "notes" as const }]
        : []),
    ];
    const observer = new IntersectionObserver((entries) => {
      const documentHeight = document.documentElement.scrollHeight;
      const reachedDocumentEnd = documentHeight > window.innerHeight
        && window.scrollY + window.innerHeight >= documentHeight - 2;
      if (reachedDocumentEnd) {
        const lastSection = sections.at(-1);
        if (lastSection) setActiveSection(lastSection.name);
        return;
      }
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio
          || Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top))[0];
      const current = visible && sections.find((section) => section.id === visible.target.id);
      if (current) setActiveSection(current.name);
    }, {
      rootMargin: "-15% 0px -15% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    sections.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [primaryFindings.length, report.id, report.notes.length, structuredFindings.length]);

  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const scrollToSection = (
    sectionId: string,
    sectionName: "findings" | "results" | "notes",
  ) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    setActiveSection(sectionName);
    section.scrollIntoView({
      behavior: reduceMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  const showResult = (resultId: string) => {
    const row = document.getElementById(resultDomId(resultId));
    if (!row) return;
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    setActiveSection("results");
    setHighlightedResultId(resultId);
    row.focus({ preventScroll: true });
    row.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedResultId(null);
      highlightTimer.current = null;
    }, 1_800);
  };

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

  const borderlineResults = report.results.filter((result) => result.referenceState === "limítrofe");
  const allConfidenceMissing = report.results.length > 0 && report.results.every((result) => result.confidence === null);
  const hasActions =
    (report.capabilities.canViewHistory && Boolean(onShowHistory)) ||
    Boolean(onEditRevision) ||
    (report.capabilities.canOpenCorrection && Boolean(onOpenCorrection));

  return (
    <article className={styles.report} aria-labelledby={`validated-report-${report.id}`}>
      <header className={styles.reportHeader}>
        <div className={styles.reportHeading}>
          <span className={styles.eyebrow}>{clinicalExamCategoryLabel(report.category)}</span>
          <h2 id={`validated-report-${report.id}`}>{report.name}</h2>
          <p className={clsx(styles.outcome, report.clinicalOutcome === "Alterado" && styles.outcomeAltered)}>
            {reportSummary(report)}
          </p>
        </div>
        <span className={styles.validatedStatus}>
          <CheckCircle2 size={17} strokeWidth={1.9} aria-hidden="true" />
          Validado
        </span>
      </header>

      {report.metadata ? (
        <dl className={styles.metadata} aria-label="Metadados do laudo">
          <div><dt>Coleta</dt><dd>{formatLocalDateTime(report.metadata.collectedAtLocal)}</dd></div>
          <div><dt>Emissão</dt><dd>{formatDateOnly(report.metadata.issuedOn)}</dd></div>
          <div>
            <dt>Solicitante</dt>
            <dd>
              {report.metadata.requesterName || "Não informado"}
              {report.metadata.requesterRegistration ? <small>{report.metadata.requesterRegistration}</small> : null}
            </dd>
          </div>
          <div><dt>Validado por</dt><dd>{report.metadata.validatorName || "Não informado"}</dd></div>
          <div><dt>Data da validação</dt><dd>{formatUtcDateTime(report.metadata.validatedAtUtc)}</dd></div>
          <div><dt>Versão</dt><dd>{report.version}</dd></div>
        </dl>
      ) : null}

      <section className={styles.document} aria-label="Documento original">
        <div className={styles.documentIcon} aria-hidden="true"><FileText size={22} strokeWidth={1.8} /></div>
        {report.document ? (
          <>
            <div className={styles.documentCopy}>
              <strong>{report.document.fileName}</strong>
              <span>
                {formatFileSize(report.document.sizeBytes)}
                {report.document.pageCount ? ` · ${report.document.pageCount} ${report.document.pageCount === 1 ? "página" : "páginas"}` : ""}
                {` · ${report.document.source}`}
              </span>
            </div>
            {report.capabilities.canOpenDocument ? (
              <Button
                type="button"
                variant="secondary"
                disabled={openingDocument}
                aria-label="Abrir laudo original em nova aba"
                onClick={() => void openDocument()}
              >
                <ExternalLink size={16} aria-hidden="true" />
                {openingDocument ? "Abrindo laudo…" : "Abrir laudo original"}
              </Button>
            ) : null}
          </>
        ) : (
          <div className={styles.documentCopy}><strong>Original indisponível</strong><span>O relatório clínico permanece disponível.</span></div>
        )}
        {documentError ? <p className={styles.documentError} role="alert">{documentError}</p> : null}
      </section>

      <nav className={styles.sectionNav} aria-label="Seções do laudo">
        {structuredFindings.length + primaryFindings.length > 0 ? (
          <button
            type="button"
            aria-current={activeSection === "findings" ? "true" : undefined}
            onClick={() => scrollToSection(`report-findings-${report.id}`, "findings")}
          >
            Achados <span>{structuredFindings.length + primaryFindings.length}</span>
          </button>
        ) : null}
        <button
          type="button"
          aria-current={activeSection === "results" ? "true" : undefined}
          onClick={() => scrollToSection(`report-results-${report.id}`, "results")}
        >
          Todos os resultados <span>{report.results.length}</span>
        </button>
        {report.notes.length > 0 ? (
          <button
            type="button"
            aria-current={activeSection === "notes" ? "true" : undefined}
            onClick={() => scrollToSection(`report-notes-${report.id}`, "notes")}
          >
            Notas do laboratório <span>{report.notes.length}</span>
          </button>
        ) : null}
      </nav>

      {structuredFindings.length + primaryFindings.length > 0 ? (
        <section className={styles.section} id={`report-findings-${report.id}`} aria-labelledby={`report-findings-title-${report.id}`}>
          <div className={styles.sectionHeading}>
            <h3 id={`report-findings-title-${report.id}`}>Achados</h3>
            <p>Resultados que merecem atenção clínica nesta coleta.</p>
          </div>
          <ul className={styles.findings}>
            {structuredFindings.map((finding) => (
              <li key={`structured:${finding.id}`}>
                <article className={styles.structuredFinding}>
                  <strong>{finding.key}</strong>
                  <p>{finding.value}</p>
                  {finding.confidence !== null ? (
                    <small>confiança {Math.round(finding.confidence * 100)}%</small>
                  ) : null}
                </article>
              </li>
            ))}
            {primaryFindings.map((finding) => {
              const delta = formatDelta(finding.deltaPercent);
              return (
                <li key={finding.resultId}>
                  <button
                    type="button"
                    className={styles.finding}
                    data-state={finding.referenceState}
                    aria-label={findingAccessibleName(finding)}
                    onClick={() => showResult(finding.resultId)}
                  >
                    <strong>{finding.name}</strong>
                    <span className={styles.findingValue}>
                      <b>{finding.valueText}</b>
                      {finding.unit ? <small>{finding.unit}</small> : null}
                    </span>
                    <span className={styles.findingState}>
                      {stateIcon(finding.referenceState)}
                      {stateLabel(finding.referenceState)}
                    </span>
                    {finding.referenceText ? <span className={styles.findingReference}>Referência {finding.referenceText}</span> : null}
                    {delta ? <span className={styles.findingDelta}>{delta} vs. coleta anterior</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {borderlineResults.length > 0 ? (
        <aside className={styles.borderlineNotice} aria-label="Resultados no limite da referência">
          <strong>No limite da referência</strong>
          <span>{borderlineResults.map((result) => resultValue(result.valueText, result.unit) ? `${result.name} ${resultValue(result.valueText, result.unit)}` : result.name).join(" · ")}</span>
        </aside>
      ) : null}

      <section className={styles.section} id={`report-results-${report.id}`} aria-labelledby={`report-results-title-${report.id}`}>
        <div className={styles.sectionHeading}>
          <h3 id={`report-results-title-${report.id}`}>Todos os resultados</h3>
          <p>Valores extraídos, referência do laboratório e evolução disponível.</p>
        </div>
        {report.results.length > 0 ? (
          <div className={styles.tableFrame}>
            <table className={styles.resultsTable} aria-label="Todos os resultados">
              <colgroup><col /><col /><col /><col /></colgroup>
              <thead>
                <tr>
                  <th scope="col">Exame</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Referência</th>
                  <th scope="col">Histórico do paciente</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map((result) => {
                  const previous = previousHistoryPoint(result);
                  const expandedReference = Boolean(expandedReferences[result.id]);
                  return (
                    <tr
                      key={result.id}
                      id={resultDomId(result.id)}
                      tabIndex={-1}
                      aria-label={`${result.name} ${resultValue(result.valueText, result.unit)} ${stateLabel(result.referenceState)}`}
                      data-highlighted={highlightedResultId === result.id ? "true" : undefined}
                    >
                      <td data-label="Exame">
                        <strong>{result.name}</strong>
                        {result.subtitle ? <small>{result.subtitle}</small> : null}
                      </td>
                      <td data-label="Resultado">
                        <span className={styles.resultValue} data-state={result.referenceState}>
                          <strong>{result.valueText}{result.unit ? " " : ""}</strong>
                          {result.unit ? <small>{result.unit}</small> : null}
                        </span>
                        <span className={styles.resultState} data-state={result.referenceState}>
                          {stateIcon(result.referenceState, 13)}
                          {stateLabel(result.referenceState)}
                        </span>
                        {result.confidence !== null ? <small className={styles.confidence}>confiança {Math.round(result.confidence * 100)}%</small> : null}
                      </td>
                      <td data-label="Referência">
                        <span>{result.referenceText || "Não informada"}</span>
                        {result.detailedReferenceText ? (
                          <>
                            <button
                              type="button"
                              className={styles.referenceToggle}
                              aria-expanded={expandedReference}
                              aria-controls={`detailed-reference-${result.id}`}
                              onClick={() => setExpandedReferences((current) => ({ ...current, [result.id]: !current[result.id] }))}
                            >
                              {expandedReference ? "Ocultar metas por risco" : "Ver metas por risco"} de {result.name}
                            </button>
                            {expandedReference ? <p className={styles.detailedReference} id={`detailed-reference-${result.id}`}>{result.detailedReferenceText}</p> : null}
                          </>
                        ) : null}
                      </td>
                      <td data-label="Histórico do paciente">
                        {result.history.length > 1 ? (
                          <div className={styles.historyCell}>
                            <ClinicalSparkline label={result.name} points={result.history} unit={result.unit} referenceState={result.referenceState} />
                            {previous ? <span>anterior {resultValue(previous.valueText, result.unit)} em {formatDateOnly(previous.date)}</span> : null}
                          </div>
                        ) : <span className={styles.noHistory}>Sem histórico anterior</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className={styles.inlineEmpty}>Este laudo não possui resultados estruturados.</p>}
        {allConfidenceMissing ? (
          <p className={styles.confidenceNote}>O processamento não informou confiança para os resultados deste laudo.</p>
        ) : null}
      </section>

      {report.notes.length > 0 ? (
        <section className={styles.section} id={`report-notes-${report.id}`} aria-labelledby={`report-notes-title-${report.id}`}>
          <div className={styles.sectionHeading}>
            <h3 id={`report-notes-title-${report.id}`}>Notas do laboratório</h3>
            <p>Observações narrativas preservadas do documento original.</p>
          </div>
          <div className={styles.notes}>
            {report.notes.map((note) => {
              const expanded = Boolean(expandedNotes[note.id]);
              return (
                <article className={styles.note} key={note.id}>
                  <h4>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`report-note-${note.id}`}
                      onClick={() => setExpandedNotes((current) => ({ ...current, [note.id]: !current[note.id] }))}
                    >
                      <span>{note.title}</span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                  </h4>
                  <div className={styles.noteBody} id={`report-note-${note.id}`} hidden={!expanded}><p>{note.text}</p></div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {hasActions ? (
        <footer className={styles.actions} role="region" aria-label="Ações do laudo">
          {report.capabilities.canViewHistory && onShowHistory ? (
            <Button type="button" variant="ghost" onClick={onShowHistory}><History size={16} aria-hidden="true" />Ver histórico de versões</Button>
          ) : null}
          {onEditRevision ? <Button type="button" variant="secondary" onClick={onEditRevision}>Continuar correção</Button> : null}
          {report.capabilities.canOpenCorrection && onOpenCorrection ? (
            <Button type="button" onClick={onOpenCorrection}><Pencil size={16} aria-hidden="true" />Corrigir valores</Button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
