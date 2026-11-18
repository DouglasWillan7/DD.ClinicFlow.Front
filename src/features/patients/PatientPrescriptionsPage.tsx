import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, FileSearch } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  CancelPrescriptionRequest,
  IssuePrescriptionRequest,
  PatientDemographic,
  Prescription,
  PrescriptionList,
} from "../../api/types";
import { useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, InlineError, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { formatDateTimeInZone, useClinicTimeZone } from "../clinic/clinicTimeZone";
import { ClinicalAccessNotice } from "./ClinicalAccessNotice";
import { usePatientClinicalSummary } from "./exams/clinicalReportQueries";
import { isClinicalAccessDenied } from "./patientClinicalAccess";
import { PatientHeader } from "./PatientHeader";
import { CancelPrescriptionDialog } from "./prescriptions/CancelPrescriptionDialog";
import { PrescriptionComposerDialog } from "./prescriptions/PrescriptionComposerDialog";
import { PrescriptionDetailPanel } from "./prescriptions/PrescriptionDetailPanel";
import { PrescriptionListPanel } from "./prescriptions/PrescriptionListPanel";
import {
  prependPrescription,
  prescriptionKeys,
  replacePrescription,
} from "./prescriptions/prescriptionQueries";
import styles from "./PatientPrescriptionsPage.module.css";

type Feedback = { tone: "success" | "error"; message: string };

const emptyItems: Prescription[] = [];

/** Conflito de versão (409) ou recusa (403): a decisão tomada na tela deixou de valer. */
function invalidatesDecision(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 409 || error.status === 403);
}

export function PatientPrescriptionsPage({ patientId }: { patientId: string }) {
  const { request, requestBlob } = useAuth();
  const timeZone = useClinicTimeZone();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // URL: ?receita=<id> seleciona; ?acao=nova abre o formulário; &base=<id> copia o texto.
  const selectedId = params.get("receita");
  const composing = params.get("acao") === "nova";
  const baseId = params.get("base");
  const listKey = prescriptionKeys.list(patientId);

  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => request<PatientDemographic>(`/patients/${patientId}`),
  });

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => request<PrescriptionList>(`/prescriptions/patients/${patientId}`),
  });

  // Só alimenta as ações de exame do cabeçalho, que são as mesmas em todas as abas do paciente.
  const clinicalSummary = usePatientClinicalSummary(patientId);

  const items = list.data?.items ?? emptyItems;
  const canIssue = list.data?.capabilities.canIssue ?? false;
  const selected = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;
  const base = baseId ? items.find((item) => item.id === baseId) ?? null : null;

  function updateParams(change: (next: URLSearchParams) => void) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      change(next);
      return next;
    }, { replace: true });
  }

  function select(prescriptionId: string | null) {
    setFeedback(null);
    updateParams((next) => {
      if (prescriptionId) next.set("receita", prescriptionId);
      else next.delete("receita");
      next.delete("acao");
      next.delete("base");
    });
  }

  function openComposer(from: Prescription | null) {
    setFeedback(null);
    updateParams((next) => {
      next.set("acao", "nova");
      if (from) next.set("base", from.id);
      else next.delete("base");
    });
  }

  function closeComposer() {
    updateParams((next) => {
      next.delete("acao");
      next.delete("base");
    });
  }

  function refreshList() {
    void queryClient.invalidateQueries({ queryKey: listKey });
  }

  async function issue(content: string) {
    const body: IssuePrescriptionRequest = { content };
    return request<Prescription>(`/prescriptions/patients/${patientId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function issued(prescription: Prescription) {
    // A receita nova entra no topo já selecionada, antes de a lista voltar.
    queryClient.setQueryData<PrescriptionList>(listKey, (current) =>
      prependPrescription(current, prescription),
    );
    refreshList();
    select(prescription.id);
    setFeedback({ tone: "success", message: "Receita emitida." });
  }

  const cancel = useMutation({
    mutationFn: (prescription: Prescription) => {
      const body: CancelPrescriptionRequest = { expectedVersion: prescription.version };
      return request<Prescription>(`/prescriptions/${prescription.id}/cancel`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<PrescriptionList>(listKey, (current) =>
        replacePrescription(current, updated),
      );
      refreshList();
      setCancelOpen(false);
      setFeedback({
        tone: "success",
        message: "Receita cancelada. Ela continua no histórico do paciente.",
      });
    },
    onError: (error) => {
      // Conflito e recusa fecham a confirmação, avisam e recarregam a lista para
      // mostrar o estado atual. Qualquer outra falha permite tentar de novo.
      if (invalidatesDecision(error)) {
        setCancelOpen(false);
        setFeedback({
          tone: "error",
          message:
            error.status === 409
              ? "Esta receita mudou enquanto você decidia. A lista foi recarregada; confira o estado atual."
              : "Só o médico que emitiu a receita pode cancelá-la.",
        });
        void list.refetch();
      }
    },
  });

  const cancelRetryableError =
    cancel.isError && !invalidatesDecision(cancel.error)
      ? cancel.error instanceof Error
        ? cancel.error.message
        : "Não foi possível cancelar a receita."
      : null;

  if (patient.isLoading) {
    return <LoadingBlock label="Carregando paciente e receitas…" />;
  }
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

  if (isClinicalAccessDenied(list.error)) {
    return (
      <div className={styles.content}>
        <PatientHeader patient={person} activeSection="prescriptions" />
        <ClinicalAccessNotice patientId={patientId} onRetry={() => void list.refetch()} />
      </div>
    );
  }

  const issuedOn = (prescription: Prescription) =>
    formatDateTimeInZone(prescription.issuedAtUtc, timeZone, { dateStyle: "short" }) ?? "data não informada";
  const hasSelection = Boolean(selectedId);
  // Sem nenhuma receita não há o que detalhar: a lista ocupa a largura toda.
  const singleColumn = items.length === 0 && !hasSelection;

  return (
    <div className={styles.content}>
      <PatientHeader
        patient={person}
        activeSection="prescriptions"
        capabilities={clinicalSummary.data?.capabilities}
      />

      <div
        className={clsx(
          styles.workspace,
          hasSelection && styles.hasSelection,
          singleColumn && styles.singleColumn,
        )}
      >
        <div className={styles.listColumn}>
          <PrescriptionListPanel
            items={items}
            canIssue={canIssue}
            selectedId={selectedId}
            isLoading={list.isLoading}
            error={list.error instanceof Error ? list.error : null}
            timeZone={timeZone}
            onSelect={select}
            onIssue={() => openComposer(null)}
            onRetry={() => void list.refetch()}
          />
        </div>

        {singleColumn ? null : (
          <div className={styles.detailColumn}>
            {hasSelection ? (
              <Button className={styles.mobileBack} type="button" variant="ghost" onClick={() => select(null)}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar às receitas
              </Button>
            ) : null}

            {feedback?.tone === "success" ? <SuccessNote>{feedback.message}</SuccessNote> : null}
            {feedback?.tone === "error" ? <InlineError>{feedback.message}</InlineError> : null}

            {!hasSelection ? (
              <section className={styles.detailEmpty}>
                <FileSearch size={28} aria-hidden="true" />
                <h2>Selecione uma receita</h2>
                <p>Abra uma receita do histórico para ler o texto completo, abrir o PDF ou usá-la como base.</p>
              </section>
            ) : list.isLoading ? (
              <section className={styles.detailFeedback}>
                <LoadingBlock label="Carregando a receita…" />
              </section>
            ) : !selected ? (
              <section className={styles.detailEmpty}>
                <FileSearch size={28} aria-hidden="true" />
                <h2>Receita não encontrada</h2>
                <p>O link pode estar incompleto ou a receita é de outro paciente.</p>
              </section>
            ) : (
              <PrescriptionDetailPanel
                key={selected.id}
                prescription={selected}
                timeZone={timeZone}
                loadDocument={() => requestBlob(`/prescriptions/${selected.id}/document`)}
                onUseAsBase={() => openComposer(selected)}
                onCancel={() => {
                  cancel.reset();
                  setFeedback(null);
                  setCancelOpen(true);
                }}
                onStale={() => void list.refetch()}
              />
            )}
          </div>
        )}
      </div>

      {composing && canIssue ? (
        <PrescriptionComposerDialog
          key={base?.id ?? "nova"}
          patientName={person.name}
          base={base ? { content: base.content, issuedOn: issuedOn(base) } : null}
          onIssue={issue}
          onIssued={issued}
          onClose={closeComposer}
        />
      ) : null}

      {cancelOpen && selected ? (
        <CancelPrescriptionDialog
          issuedOn={issuedOn(selected)}
          pending={cancel.isPending}
          error={cancelRetryableError}
          onKeep={() => setCancelOpen(false)}
          onConfirm={() => cancel.mutate(selected)}
        />
      ) : null}
    </div>
  );
}

export default PatientPrescriptionsPage;
