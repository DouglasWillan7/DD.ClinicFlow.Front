import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { ApiError } from "../../api/client";
import type { BodyAssessment, Patient } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { AssessmentsChart } from "./AssessmentsChart";
import { AssessmentsTable } from "./AssessmentsTable";
import type { MeasurementPayload } from "./assessmentForm";
import {
  assessmentMetrics,
  buildRows,
  buildSeries,
  formatPeriod,
  type MetricId,
} from "./assessmentMetrics";
import { latestAssessment, latestHeightCm } from "./bodyAssessments";
import { usePatientClinicalSummary } from "./exams/clinicalReportQueries";
import { NewAssessmentDialog } from "./NewAssessmentDialog";
import { PatientHeader } from "./PatientHeader";
import styles from "./PatientAssessmentsPage.module.css";

type View = "tabela" | "grafico";
type ChartMode = "agrupado" | "individual";

export function PatientAssessmentsPage({ patientId }: { patientId: string }) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("tabela");
  const [chartMode, setChartMode] = useState<ChartMode>("agrupado");
  const [hidden, setHidden] = useState<ReadonlySet<MetricId>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => request<Patient>(`/patients/${patientId}`),
  });
  const assessments = useQuery({
    queryKey: ["patients", patientId, "assessments"],
    queryFn: () => request<BodyAssessment[]>(`/assessments/patients/${patientId}`),
  });
  const clinicalSummary = usePatientClinicalSummary(patientId);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["patients", patientId, "assessments"],
    });
  }

  const create = useMutation({
    mutationFn: (payload: {
      assessedOn: string;
      measurements: MeasurementPayload[];
    }) =>
      request<BodyAssessment>(`/assessments/patients/${patientId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setView("tabela");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (assessmentId: string) =>
      request<void>(`/assessments/${assessmentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const list = useMemo(() => assessments.data ?? [], [assessments.data]);
  const rows = useMemo(() => buildRows(list), [list]);
  const series = useMemo(() => buildSeries(list), [list]);
  const activeSeries = series.filter((item) => !hidden.has(item.metric.id));
  const period = formatPeriod(list);
  const previous = latestAssessment(list);

  function toggleMetric(id: MetricId) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (patient.isLoading) return <LoadingBlock label="Carregando o paciente…" />;

  if (patient.isError || !patient.data) {
    return (
      <ErrorBlock
        message={
          patient.error instanceof ApiError && patient.error.status === 404
            ? "Este paciente não existe ou não está no seu escopo de atendimento."
            : "Não foi possível carregar o paciente."
        }
        retry={() => void patient.refetch()}
      />
    );
  }

  const person = patient.data;

  return (
    <div className={styles.content}>
      <PatientHeader
        patient={person}
        activeSection="assessments"
        capabilities={clinicalSummary.data?.capabilities}
      />

      <section className={styles.panel} aria-labelledby="avaliacoes-titulo">
        <header className={styles.panelHeader}>
          <div className={styles.panelHeading}>
            <h2 id="avaliacoes-titulo" className={styles.panelTitle}>
              Avaliações físicas
            </h2>
            <p className={styles.panelMeta}>
              {list.length === 0
                ? "Nenhuma avaliação registrada"
                : `${list.length} ${list.length === 1 ? "avaliação" : "avaliações"}${period ? ` · ${period}` : ""}`}
            </p>
          </div>

          <div
            className={styles.segmented}
            role="group"
            aria-label="Formato de visualização"
          >
            <button
              type="button"
              className={clsx(styles.segment, view === "tabela" && styles.segmentOn)}
              aria-pressed={view === "tabela"}
              onClick={() => setView("tabela")}
            >
              Tabela
            </button>
            <button
              type="button"
              className={clsx(styles.segment, view === "grafico" && styles.segmentOn)}
              aria-pressed={view === "grafico"}
              onClick={() => setView("grafico")}
            >
              Gráfico
            </button>
          </div>

          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={17} strokeWidth={2} aria-hidden="true" />
            Nova avaliação
          </button>
        </header>

        {assessments.isLoading ? (
          <LoadingBlock label="Carregando avaliações…" />
        ) : assessments.isError ? (
          <ErrorBlock
            message="Não foi possível carregar as avaliações."
            retry={() => void assessments.refetch()}
          />
        ) : list.length === 0 ? (
          <p className={styles.empty}>
            A primeira avaliação aparece aqui e passa a servir de base para as variações seguintes.
          </p>
        ) : view === "tabela" ? (
          <AssessmentsTable
            rows={rows}
            patientName={person.name}
            onRemove={(id) => remove.mutate(id)}
            removing={remove.isPending}
          />
        ) : (
          <>
            <div className={styles.chartControls}>
              <div
                className={styles.segmented}
                role="group"
                aria-label="Modo do gráfico"
              >
                <button
                  type="button"
                  className={clsx(
                    styles.segment,
                    chartMode === "agrupado" && styles.segmentOn,
                  )}
                  aria-pressed={chartMode === "agrupado"}
                  onClick={() => setChartMode("agrupado")}
                >
                  Agrupado
                </button>
                <button
                  type="button"
                  className={clsx(
                    styles.segment,
                    chartMode === "individual" && styles.segmentOn,
                  )}
                  aria-pressed={chartMode === "individual"}
                  onClick={() => setChartMode("individual")}
                >
                  Individual
                </button>
              </div>

              <span className={styles.controlsDivider} aria-hidden="true" />

              <div className={styles.chips} role="group" aria-label="Métricas exibidas">
                {assessmentMetrics.map((metric) => {
                  const on = !hidden.has(metric.id);
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      className={clsx(styles.chip, on && styles.chipOn)}
                      style={{ "--metric-color": metric.color } as CSSProperties}
                      aria-pressed={on}
                      onClick={() => toggleMetric(metric.id)}
                    >
                      <span className={styles.chipDot} aria-hidden="true" />
                      {metric.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeSeries.length === 0 ? (
              <p className={styles.empty}>
                Selecione ao menos uma métrica acima para visualizar o gráfico.
              </p>
            ) : (
              <AssessmentsChart
                mode={chartMode}
                series={activeSeries}
                assessments={[...list].sort((a, b) =>
                  a.assessedOn.localeCompare(b.assessedOn),
                )}
              />
            )}
          </>
        )}

        {remove.isError ? (
          <p className={styles.formError} role="alert">
            {remove.error instanceof ApiError
              ? remove.error.message
              : "Não foi possível remover a avaliação."}
          </p>
        ) : null}
      </section>

      <NewAssessmentDialog
        open={dialogOpen}
        patientName={person.name}
        previous={previous}
        previousHeightCm={latestHeightCm(list)}
        pending={create.isPending}
        serverError={
          create.isError
            ? create.error instanceof ApiError
              ? create.error.message
              : "Não foi possível salvar a avaliação."
            : null
        }
        onClose={() => {
          create.reset();
          setDialogOpen(false);
        }}
        onSubmit={(payload) => create.mutate(payload)}
      />
    </div>
  );
}
