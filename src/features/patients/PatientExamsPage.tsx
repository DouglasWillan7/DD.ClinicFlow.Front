import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, FileSearch } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type {
  CancelExamRequest,
  ClassifyExamRequest,
  CreateExamRequest,
  DiscardFailedExamRequest,
  ExamListFilters,
  OpenExamRevisionRequest,
  Patient,
  PatientExamDetail,
  SaveExamRevisionRequest,
  UpdateExamRequest,
  ValidateExamRevisionRequest,
} from "../../api/types";
import { useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { Field } from "../../components/Field";
import { ExamDetailPanel } from "./exams/ExamDetailPanel";
import { ExamListPanel } from "./exams/ExamListPanel";
import { clinicalReportKeys, useClinicalExamReport } from "./exams/clinicalReportQueries";
import { flattenExamPages } from "./exams/examList";
import {
  examKeys,
  examListSearchParams,
  normalizePatientExamDetail,
  normalizePatientExamPage,
  type PatientExamDetailTransport,
  type PatientExamPageTransport,
  toExamCategoryApi,
  toExamOutcomeApi,
} from "./exams/examQueries";
import { useExamRealtimeView } from "./exams/ExamRealtimeProvider";
import { ExamRequestComposer } from "./exams/ExamRequestComposer";
import { ExamRevisionEditor } from "./exams/ExamRevisionEditor";
import { ExamUploadComposer } from "./exams/ExamUploadComposer";
import { PatientHeader } from "./PatientHeader";
import styles from "./PatientExamsPage.module.css";

const initialFilters: ExamListFilters = {
  search: "",
  statuses: [],
  categories: [],
  includeCancelled: false,
};

export function PatientExamsPage({ patientId }: { patientId: string }) {
  const { request, requestBlob } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ ...initialFilters });
  const [openingCorrection, setOpeningCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [attachedExamId, setAttachedExamId] = useState<string | null>(null);
  const selectedExamId = params.get("exame");

  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => request<Patient>(`/patients/${patientId}`),
  });

  const list = useInfiniteQuery({
    queryKey: examKeys.list(patientId, filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const query = examListSearchParams(filters, pageParam).toString();
      const payload = await request<PatientExamPageTransport>(`/exams/patients/${patientId}${query ? `?${query}` : ""}`);
      return normalizePatientExamPage(payload);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const detail = useQuery({
    queryKey: examKeys.detail(selectedExamId ?? "none"),
    enabled: Boolean(selectedExamId),
    queryFn: async () => normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}`)),
  });
  const selected = detail.data;

  // Enquanto o modal de anexo acompanha a extração, o detalhe é buscado por conta
  // própria: o realtime invalida esta chave e o intervalo cobre queda de conexão.
  const attached = useQuery({
    queryKey: examKeys.detail(attachedExamId ?? "none"),
    enabled: Boolean(attachedExamId),
    queryFn: async () => normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${attachedExamId}`)),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "Pendente" || status === "Processando" ? 5_000 : false;
    },
  });

  const loadSelectedDocument = useCallback(() => {
    if (!selectedExamId) return Promise.reject(new Error("Exame não selecionado."));
    return requestBlob(`/exams/${selectedExamId}/document`);
  }, [requestBlob, selectedExamId]);

  const pages = useMemo(() => list.data?.pages ?? [], [list.data?.pages]);
  const visibleExams = useMemo(() => flattenExamPages(pages), [pages]);
  const selectedListStatus = visibleExams.find((exam) => exam.id === selectedExamId)?.status;
  const clinicalReport = useClinicalExamReport(
    selectedExamId,
    selected?.status === "Validado" || selectedListStatus === "Validado",
  );

  const pageCapabilities = pages[0]?.capabilities ?? { canRequest: false, canAttachDocument: false };

  const selectExam = useCallback((examId: string | null) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (examId) next.set("exame", examId);
      else next.delete("exame");
      next.delete("acao");
      return next;
    }, { replace: true });
  }, [setParams]);

  const openEmptyAction = useCallback((action: "solicitar" | "anexar") => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("acao", action);
      return next;
    }, { replace: true });
  }, [setParams]);

  const closeEmptyAction = useCallback(() => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("acao");
      return next;
    }, { replace: true });
  }, [setParams]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: examKeys.patient(patientId) });
  }, [patientId, queryClient]);

  const complete = useCallback((exam: PatientExamDetail) => {
    queryClient.setQueryData(examKeys.detail(exam.id), exam);
    selectExam(exam.id);
    invalidate();
    if (exam.status === "Validado") {
      void queryClient.invalidateQueries({ queryKey: clinicalReportKeys.report(exam.id), refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: clinicalReportKeys.summary(patientId), refetchType: "all" });
    }
  }, [invalidate, patientId, queryClient, selectExam]);

  const poll = useCallback(() => {
    void list.refetch();
    if (selectedExamId) void detail.refetch();
  }, [detail, list, selectedExamId]);

  useExamRealtimeView({
    patientId,
    patientName: patient.data?.name ?? "Paciente",
    exams: visibleExams.map(({ id, name, status }) => ({ id, name, status })),
    onPoll: poll,
    onSelectExam: selectExam,
  });

  async function createExam(value: CreateExamRequest) {
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/patients/${patientId}/requests`, {
      method: "POST",
      body: JSON.stringify({ ...value, category: toExamCategoryApi(value.category) }),
    }));
  }

  async function updateExam(examId: string, value: UpdateExamRequest) {
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${examId}/request`, {
      method: "PUT",
      body: JSON.stringify({ ...value, category: toExamCategoryApi(value.category) }),
    }));
  }

  async function cancelExam(examId: string, value: CancelExamRequest) {
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${examId}/request`, {
      method: "DELETE",
      body: JSON.stringify(value),
    }));
  }

  async function uploadExam(body: FormData, signal: AbortSignal) {
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/patients/${patientId}/documents`, { method: "POST", body, signal }));
  }

  async function reprocessExam() {
    if (!selectedExamId) return;
    complete(normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}/reprocess`, { method: "POST" })));
  }

  async function discardFailedExam() {
    if (!selectedExamId || !detail.data) throw new Error("Exame não selecionado.");
    const examId = selectedExamId;
    const body: DiscardFailedExamRequest = { expectedVersion: detail.data.version };
    await request<PatientExamDetailTransport>(`/exams/${examId}/discard`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    queryClient.removeQueries({ queryKey: examKeys.detail(examId) });
    void queryClient.invalidateQueries({ queryKey: examKeys.patient(patientId) });
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("exame");
      next.set("acao", "anexar");
      return next;
    }, { replace: true });
  }

  async function saveDraft(value: SaveExamRevisionRequest) {
    if (!selectedExamId) throw new Error("Exame não selecionado.");
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}/revision`, {
      method: "PUT",
      body: JSON.stringify({ ...value, clinicalOutcome: toExamOutcomeApi(value.clinicalOutcome) }),
    }));
  }

  async function validateRevision(value: ValidateExamRevisionRequest) {
    if (!selectedExamId) throw new Error("Exame não selecionado.");
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}/validate`, {
      method: "POST",
      body: JSON.stringify({ ...value, clinicalOutcome: toExamOutcomeApi(value.clinicalOutcome) }),
    }));
  }

  async function classifyExam(value: ClassifyExamRequest) {
    if (!selectedExamId) throw new Error("Exame não selecionado.");
    return normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}/classification`, {
      method: "PUT",
      body: JSON.stringify({ ...value, category: toExamCategoryApi(value.category) }),
    }));
  }

  async function openCorrection() {
    if (!selectedExamId || !detail.data) return;
    if (!correctionReason.trim()) {
      setCorrectionError("Explique o motivo da correção.");
      return;
    }
    setCorrectionError(null);
    const body: OpenExamRevisionRequest = { correctionReason: correctionReason.trim(), expectedVersion: detail.data.version };
    try {
      const result = normalizePatientExamDetail(await request<PatientExamDetailTransport>(`/exams/${selectedExamId}/revisions`, { method: "POST", body: JSON.stringify(body) }));
      setOpeningCorrection(false);
      setCorrectionReason("");
      complete(result);
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Não foi possível iniciar a correção.");
    }
  }

  if (patient.isLoading) {
    return <div className={styles.initialLoading} role="status"><span>Carregando paciente e exames…</span><i data-testid="exam-list-initial-skeleton" aria-hidden="true" /><i data-testid="exam-detail-initial-skeleton" aria-hidden="true" /></div>;
  }
  if (patient.isError || !patient.data) {
    return <ErrorBlock message={patient.error instanceof ApiError && patient.error.status === 404 ? "Este paciente não existe ou não está no seu escopo de atendimento." : "Não foi possível carregar o paciente."} retry={() => void patient.refetch()} />;
  }

  const person = patient.data;
  return (
    <div className={styles.content}>
      <PatientHeader
        patient={person}
        activeSection="exams"
        capabilities={pageCapabilities}
      />

      <div className={styles.composers}>
        <ExamRequestComposer canRequest={pageCapabilities.canRequest} openInitially={params.get("acao") === "solicitar"} showCreateTrigger={false} exam={null} onCreate={createExam} onUpdate={updateExam} onCancel={cancelExam} onCompleted={complete} onReload={() => void list.refetch()} onClose={closeEmptyAction} />
        <ExamUploadComposer
          canAttachDocument={pageCapabilities.canAttachDocument}
          open={params.get("acao") === "anexar"}
          patientName={person.name}
          pendingRequests={visibleExams.filter((exam) => exam.status === "Solicitado" && !exam.hasDocument)}
          trackedExam={attached.data ?? null}
          onUpload={uploadExam}
          onTrackChange={(examId) => {
            setAttachedExamId(examId);
            if (examId) invalidate();
          }}
          onOpenExam={selectExam}
          onClose={closeEmptyAction}
        />
      </div>

      {selected?.status === "Em revisão" && selected.draftRevision && selected.capabilities.canEditRevision ? (
        <main className={styles.reviewMode}>
          <Button className={styles.reviewBack} type="button" variant="ghost" onClick={() => selectExam(null)}><ArrowLeft size={16} aria-hidden="true" />Voltar aos exames</Button>
          <ExamRevisionEditor
            exam={selected}
            loadDocument={loadSelectedDocument}
            onClassify={classifyExam}
            onSaveDraft={saveDraft}
            onValidate={validateRevision}
            onDiscard={discardFailedExam}
            onCompleted={complete}
            onReload={() => void detail.refetch()}
          />
        </main>
      ) : (
      <main className={`${styles.workspace} ${selectedExamId ? styles.hasSelection : ""}`}>
        <div className={styles.listColumn}>
          <ExamListPanel pages={pages} capabilities={pageCapabilities} filters={filters} selectedExamId={selectedExamId} isLoading={list.isLoading} error={list.error instanceof Error ? list.error : null} isFetchingNextPage={list.isFetchingNextPage} hasNextPage={list.hasNextPage} onFiltersChange={setFilters} onSelect={selectExam} onLoadMore={() => void list.fetchNextPage()} onRetry={() => void list.refetch()} onRequest={() => openEmptyAction("solicitar")} onAttach={() => openEmptyAction("anexar")} />
        </div>

        <div className={styles.detailColumn}>
          {selectedExamId ? <Button className={styles.mobileBack} type="button" variant="ghost" onClick={() => selectExam(null)}><ArrowLeft size={16} aria-hidden="true" />Voltar aos exames</Button> : null}
          {!selectedExamId ? (
            <section className={styles.detailEmpty}><FileSearch size={28} aria-hidden="true" /><h2>Selecione um exame</h2><p>Abra uma solicitação, processamento ou versão validada para ver os detalhes.</p></section>
          ) : detail.isLoading ? (
            <section className={styles.detailFeedback}><LoadingBlock label="Carregando o exame…" /></section>
          ) : detail.isError || !selected ? (
            <section className={styles.detailFeedback}><ErrorBlock message="Não foi possível carregar este exame." retry={() => void detail.refetch()} /></section>
          ) : (
            <>
              <ExamDetailPanel exam={selected} report={selected.status === "Validado" ? clinicalReport.data : undefined} loadDocument={loadSelectedDocument} onRetry={() => void reprocessExam()} onDiscard={discardFailedExam} onReload={() => void detail.refetch()} onOpenCorrection={() => setOpeningCorrection(true)} onEditRevision={() => document.getElementById("exam-revision-editor")?.focus()} onShowHistory={() => setHistoryOpen((value) => !value)} />
              {selected.status === "Validado" && clinicalReport.isLoading ? (
                <section className={styles.detailFeedback}><LoadingBlock label="Carregando laudo validado…" /></section>
              ) : null}
              {selected.status === "Validado" && clinicalReport.isError ? (
                <section className={styles.detailFeedback}><ErrorBlock message="Não foi possível carregar o laudo validado." retry={() => void clinicalReport.refetch()} /></section>
              ) : null}
              {historyOpen ? <p className={styles.historyNote} role="status">Versões anteriores permanecem preservadas no prontuário.</p> : null}
              {openingCorrection ? <section className={styles.correctionComposer} role="region" aria-label="Iniciar correção"><Field id="exam-correction-reason" label="Motivo da correção" value={correctionReason} error={correctionError ?? undefined} onChange={(event) => setCorrectionReason(event.target.value)} /><div><Button type="button" variant="ghost" onClick={() => setOpeningCorrection(false)}>Fechar</Button><Button type="button" onClick={() => void openCorrection()}>Iniciar correção</Button></div></section> : null}
              <ExamRequestComposer canRequest={false} openInitially={false} exam={selected} onCreate={createExam} onUpdate={updateExam} onCancel={cancelExam} onCompleted={complete} onReload={() => void detail.refetch()} />
            </>
          )}
        </div>
      </main>
      )}
    </div>
  );
}

export default PatientExamsPage;
