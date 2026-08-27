import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import type {
  ClinicalExamFinding,
  ClinicalReferenceState,
  PatientClinicalSummary,
} from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { ErrorBlock } from "../../components/Feedback";
import { ClinicalAccessNotice } from "./ClinicalAccessNotice";
import { isClinicalAccessDenied } from "./patientClinicalAccess";
import {
  clinicalExamCategoryLabel,
  clinicalExamOutcomeLabel,
  clinicalTrendKey,
  formatDelta,
  referenceStateLabel,
  withoutDerivedStructuredFindings,
} from "./exams/clinicalReport";
import { formatDateOnly } from "./patientFormatters";
import { ClinicalSparkline } from "./ClinicalSparkline";
import styles from "./PatientClinicalOverview.module.css";

function outcomeTone(value: string, findingCount: number) {
  const outcome = clinicalExamOutcomeLabel(value);
  if (findingCount > 0 || outcome === "Alterado") return "danger";
  if (outcome === "Sem alterações") return "success";
  return "neutral";
}

function collectionDate(value: string | null | undefined) {
  if (!value) return null;
  return formatDateOnly(value.slice(0, 10));
}

function findingIcon(state: ClinicalReferenceState) {
  if (state === "elevado") {
    return <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />;
  }
  if (state === "baixo") {
    return <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />;
  }
  return <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />;
}

function findingAccessibleName(finding: ClinicalExamFinding) {
  return `${finding.name} ${finding.valueText}${finding.unit ? ` ${finding.unit}` : ""}, ${referenceStateLabel(finding.referenceState)}`;
}

export function PatientClinicalOverview({
  patientId,
  summary,
  loading = false,
  error,
  onRetry,
}: {
  patientId: string;
  summary: PatientClinicalSummary | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <section
        className={styles.loading}
        role="status"
        aria-label="Carregando resumo clínico"
      >
        <span>Carregando resumo clínico…</span>
        <i aria-hidden="true" />
        <i aria-hidden="true" />
      </section>
    );
  }

  if (isClinicalAccessDenied(error)) {
    return <ClinicalAccessNotice patientId={patientId} onRetry={onRetry} />;
  }

  if (error || !summary) {
    return (
      <section className={styles.feedback} aria-label="Resumo clínico">
        <ErrorBlock
          message="Não foi possível carregar o resumo clínico."
          retry={onRetry}
        />
      </section>
    );
  }

  const report = summary.latestReport;
  const rawStructuredFindings = summary.structuredFindings ?? [];
  const availableStructuredFindings = withoutDerivedStructuredFindings(
    rawStructuredFindings,
    summary.findings,
    report?.results ?? [],
  );
  const effectiveFindingCount = Math.max(
    0,
    summary.totalFindingCount
      - (rawStructuredFindings.length - availableStructuredFindings.length),
  );
  const structuredFindings = availableStructuredFindings.slice(0, 6);
  const findings = summary.findings.slice(0, 6 - structuredFindings.length);
  const trends = summary.trends.slice(0, 6);
  const reportPath = report
    ? `/app/pacientes/${patientId}/exames?exame=${report.id}`
    : null;

  function openReport(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!reportPath) return;
    event.preventDefault();
    navigate(reportPath);
  }

  return (
    <div className={styles.overview}>
      <section className={styles.panel} aria-label="Último exame">
        {report ? (
          <>
            <header className={styles.reportHeader}>
              <div className={styles.reportHeading}>
                <span className={styles.eyebrow}>
                  Último exame · {clinicalExamCategoryLabel(report.category)}
                </span>
                <h2>{report.name}</h2>
                <p
                  className={styles.outcome}
                  data-tone={outcomeTone(
                    report.clinicalOutcome,
                    effectiveFindingCount,
                  )}
                >
                  {clinicalExamOutcomeLabel(report.clinicalOutcome)}
                  {effectiveFindingCount > 0
                    ? ` · ${effectiveFindingCount} ${effectiveFindingCount === 1 ? "achado" : "achados"}`
                    : " · nenhum achado fora da referência"}
                </p>
              </div>

              <span className={styles.validated}>
                <CheckCircle2 size={16} strokeWidth={1.9} aria-hidden="true" />
                Validado
              </span>

              <a
                className={styles.reportAction}
                href={reportPath ?? undefined}
                onClick={openReport}
              >
                Ver exames
              </a>
            </header>

            {structuredFindings.length + findings.length > 0 ? (
              <ul className={styles.findings} aria-label="Principais achados">
                {structuredFindings.map((finding) => (
                  <li key={`structured:${finding.id}`}>
                    <a
                      className={styles.finding}
                      data-kind="structured"
                      href={reportPath ?? undefined}
                      onClick={openReport}
                      aria-label={`${finding.key}: ${finding.value}`}
                    >
                      <strong>{finding.key}</strong>
                      <span className={styles.structuredFindingValue}>{finding.value}</span>
                    </a>
                  </li>
                ))}
                {findings.map((finding) => {
                  const delta = formatDelta(finding.deltaPercent);
                  return (
                    <li key={finding.resultId}>
                      <a
                        className={styles.finding}
                        href={reportPath ?? undefined}
                        onClick={openReport}
                        aria-label={findingAccessibleName(finding)}
                        data-state={finding.referenceState}
                      >
                        <strong>{finding.name}</strong>
                        <span className={styles.findingResult}>
                          <b>{finding.valueText}</b>
                          {finding.unit ? <small>{finding.unit}</small> : null}
                        </span>
                        <span className={styles.findingState}>
                          {findingIcon(finding.referenceState)}
                          {referenceStateLabel(finding.referenceState)}
                        </span>
                        {finding.referenceText ? (
                          <span className={styles.reference}>
                            Referência {finding.referenceText}
                          </span>
                        ) : null}
                        {delta ? (
                          <span className={styles.delta}>{delta} vs. coleta anterior</span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.inlineEmpty}>
                Este laudo não possui achados fora da referência.
              </p>
            )}

            <footer className={styles.reportMeta}>
              {collectionDate(report.metadata?.collectedAtLocal) ? (
                <span>
                  Coleta {collectionDate(report.metadata?.collectedAtLocal)}
                </span>
              ) : null}
              {report.metadata?.requesterName ? (
                <span>
                  Solicitante {report.metadata.requesterName}
                  {report.metadata.requesterRegistration
                    ? ` · ${report.metadata.requesterRegistration}`
                    : ""}
                </span>
              ) : null}
              {effectiveFindingCount > structuredFindings.length + findings.length ? (
                <a
                  className={styles.allFindings}
                  href={reportPath ?? undefined}
                  onClick={openReport}
                >
                  Ver todos os {effectiveFindingCount} achados
                </a>
              ) : null}
            </footer>
          </>
        ) : (
          <div className={styles.emptyState}>
            <FileCheck2 size={28} strokeWidth={1.7} aria-hidden="true" />
            <div>
              <h2>Nenhum laudo validado</h2>
              <p>
                Após a validação clínica de um laudo, os principais achados
                aparecem aqui com acesso direto ao exame.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="evolucao-titulo">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="evolucao-titulo">Evolução entre coletas</h2>
            <p>Histórico dos analitos disponíveis em laudos validados.</p>
          </div>
        </header>

        {trends.length > 0 ? (
          <ul className={styles.trends}>
            {trends.map((trend) => (
              <li key={clinicalTrendKey(trend)} className={styles.trend}>
                <strong>{trend.name}</strong>
                <ClinicalSparkline
                  label={trend.name}
                  points={trend.points}
                  unit={trend.unit}
                  referenceState={trend.referenceState}
                />
                <span>
                  {trend.points.map((point) => point.valueText).join(" → ")}
                  {trend.unit ? ` ${trend.unit}` : ""}
                  {` · Último resultado: ${referenceStateLabel(trend.referenceState)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.inlineEmpty}>
            A evolução aparece após duas coletas validadas com o mesmo analito.
          </p>
        )}
      </section>
    </div>
  );
}
