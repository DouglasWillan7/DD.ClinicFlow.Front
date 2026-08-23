import { AlertTriangle, Check, FileText, Upload, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ApiError } from "../../../api/client";
import type {
  ExamCategory,
  PatientExamDetail,
  PatientExamSummary,
} from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, SelectField } from "../../../components/Field";
import { formatFileSize } from "./examDetail";
import { toExamCategoryApi } from "./examQueries";
import { MAX_EXAM_PDF_BYTES, validateExamPdf } from "./examFileValidation";
import { examRequestCategories } from "./examRequestForm";
import { summarizeExtraction } from "./extractionSummary";
import styles from "./ExamUploadComposer.module.css";

interface ExamUploadComposerProps {
  canAttachDocument: boolean;
  open: boolean;
  patientName: string;
  pendingRequests: PatientExamSummary[];
  /** Detalhe vivo do exame aceito nesta sessão do modal — alimenta as fases e o resumo. */
  trackedExam: PatientExamDetail | null;
  onUpload(body: FormData, signal: AbortSignal): Promise<PatientExamDetail>;
  onTrackChange(examId: string | null): void;
  onOpenExam(examId: string): void;
  onClose(): void;
}

/**
 * Fases reais do backend. Não existe percentual de progresso: `Pendente` é fila e
 * `Processando` cobre extração e conferência de referências no mesmo passo.
 */
const stages = [
  { id: "upload", label: "Enviando arquivo" },
  { id: "queue", label: "Na fila de processamento" },
  { id: "extract", label: "Extraindo analitos e conferindo as referências" },
] as const;

const standaloneChoice = "standalone";
const maxSizeLabel = `${Math.round(MAX_EXAM_PDF_BYTES / (1024 * 1024))} MB`;

export function ExamUploadComposer({
  canAttachDocument,
  open,
  patientName,
  pendingRequests,
  trackedExam,
  onUpload,
  onTrackChange,
  onOpenExam,
  onClose,
}: ExamUploadComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpenRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [linkChoice, setLinkChoice] = useState(standaloneChoice);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExamCategory>("Laboratório");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [acceptedExamId, setAcceptedExamId] = useState<string | null>(null);

  const tracked = acceptedExamId && trackedExam?.id === acceptedExamId ? trackedExam : null;
  const stage = !acceptedExamId
    ? (sending ? "sending" : "form")
    : tracked?.status === "Em revisão"
      ? "done"
      : tracked?.status === "Falhou"
        ? "failed"
        : "processing";
  const activeStage = stage === "sending" ? 0 : tracked?.status === "Processando" ? 2 : 1;

  /** Zera só o ciclo de envio: o arquivo escolhido sobrevive para o reenvio após descartar uma duplicata. */
  function resetFlight() {
    setErrors({});
    setDuplicateId(null);
    setSending(false);
    setAcceptedExamId(null);
  }

  function resetForm() {
    resetFlight();
    setFile(null);
    setLinkChoice(standaloneChoice);
    setName("");
    setCategory("Laboratório");
  }

  // O elemento só existe enquanto o modal está aberto: abrir na montagem evita
  // depender de efeitos que não reagem à troca do nó.
  const setDialog = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", "");
  }, []);

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      resetFlight();
    } else if (!open && wasOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!canAttachDocument || !open) return null;

  async function acceptFile(nextFile: File | undefined) {
    if (!nextFile) return;
    const error = await validateExamPdf(nextFile);
    if (error) {
      setErrors((current) => ({ ...current, file: error }));
      return;
    }
    setFile(nextFile);
    setDuplicateId(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.file;
      delete next.submit;
      return next;
    });
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    event.target.value = "";
    void acceptFile(next);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void acceptFile(event.dataTransfer.files[0]);
  }

  /** Fecha sem cancelar o processamento: o job segue no servidor e o aviso chega pelo toast. */
  function close() {
    abortRef.current?.abort();
    abortRef.current = null;
    onTrackChange(null);
    onClose();
  }

  function attachAnother() {
    onTrackChange(null);
    resetForm();
  }

  function review(examId: string) {
    onTrackChange(null);
    onOpenExam(examId);
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (!file) nextErrors.file = "Selecione o PDF do laudo.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const body = new FormData();
    body.append("file", file!);
    if (linkChoice === standaloneChoice) {
      // O nome é opcional para o médico; sem ele o arquivo nomeia o exame, que o backend exige.
      body.append("name", name.trim() || file!.name.replace(/\.pdf$/i, "").trim() || "Laudo anexado");
      body.append("category", toExamCategoryApi(category));
    } else {
      body.append("requestExamId", linkChoice);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setErrors({});
    setDuplicateId(null);
    try {
      const exam = await onUpload(body, controller.signal);
      setAcceptedExamId(exam.id);
      onTrackChange(exam.id);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 409 && error.problem?.existingExamId) {
        setDuplicateId(error.problem.existingExamId);
        setErrors({ submit: "Este PDF já foi anexado para este paciente." });
      } else {
        setErrors({
          submit: error instanceof Error ? error.message : "Não foi possível enviar o laudo.",
        });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  const summary = summarizeExtraction(tracked?.draftRevision);

  return (
    <dialog
      ref={setDialog}
      className={styles.dialog}
      aria-label="Anexar laudo"
      onCancel={(event) => event.preventDefault()}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2>Anexar laudo</h2>
            <p>{patientName} · os dados extraídos ficam pendentes até a sua revisão</p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Fechar"
            onClick={close}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {stage === "form" || stage === "sending" ? (
          <>
            <div
              className={styles.dropZone}
              data-testid="exam-drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropFile}
            >
              <span className={styles.dropIcon} aria-hidden="true">
                {file ? <FileText size={20} strokeWidth={1.8} /> : <Upload size={20} strokeWidth={1.8} />}
              </span>
              <strong>{file ? file.name : "Arraste o PDF aqui ou clique para escolher"}</strong>
              <span className={styles.dropHint}>
                {file ? formatFileSize(file.size) : `PDF de até ${maxSizeLabel} · 1 laudo por envio`}
              </span>
              <input
                ref={inputRef}
                className={styles.fileInput}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Selecionar arquivo PDF"
                onChange={pickFile}
              />
              <div className={styles.dropActions}>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={file ? `Substituir ${file.name}` : "Escolher PDF"}
                  onClick={() => inputRef.current?.click()}
                >
                  {file ? "Substituir" : "Escolher PDF"}
                </Button>
                {file ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remover ${file.name}`}
                    onClick={() => setFile(null)}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
            <p className={styles.fileStatus} role="status" aria-live="polite">
              {file ? `${file.name} selecionado` : "Nenhum arquivo selecionado"}
            </p>
            {errors.file ? <p className={styles.error} role="alert">{errors.file}</p> : null}

            {pendingRequests.length ? (
              <SelectField
                id="exam-upload-link"
                label="Vincular laudo"
                hint="Solicitações abertas deste paciente."
                value={linkChoice}
                onChange={(event) => setLinkChoice(event.target.value)}
              >
                {pendingRequests.map((request) => (
                  <option key={request.id} value={request.id}>{request.name}</option>
                ))}
                <option value={standaloneChoice}>Laudo sem solicitação</option>
              </SelectField>
            ) : null}

            {linkChoice === standaloneChoice ? (
              <div className={styles.metadata}>
                <SelectField
                  id="exam-upload-category"
                  label="Tipo de exame"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ExamCategory)}
                >
                  {examRequestCategories.map((item) => <option key={item}>{item}</option>)}
                </SelectField>
                <Field
                  id="exam-upload-name"
                  label="Nome do exame (opcional)"
                  placeholder="ex.: Exames de rotina"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}

            {errors.submit ? (
              <div className={styles.submitError} role="alert">
                <span>{errors.submit}</span>
                {duplicateId ? (
                  <Button type="button" variant="secondary" onClick={() => review(duplicateId)}>
                    Abrir exame existente
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
              <Button type="button" loading={sending} onClick={() => void submit()}>Enviar laudo</Button>
            </div>
          </>
        ) : null}

        {stage === "processing" ? (
          <>
            <div className={styles.fileCard}>
              <FileText size={18} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <strong>{file?.name ?? tracked?.document?.fileName ?? "Laudo enviado"}</strong>
                <span>{file ? formatFileSize(file.size) : null}</span>
              </div>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Extração do laudo em andamento"
            >
              <span className={styles.progressPulse} />
            </div>
            <ol className={styles.stages} aria-live="polite">
              {stages.map((item, index) => {
                const done = index < activeStage;
                const active = index === activeStage;
                return (
                  <li
                    key={item.id}
                    className={done ? styles.stageDone : active ? styles.stageActive : styles.stageWaiting}
                  >
                    <span className={styles.stageMark} aria-hidden="true">
                      {done ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    {item.label}
                    <span className={styles.srOnly}>
                      {done ? " — concluído" : active ? " — em andamento" : " — aguardando"}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className={styles.processingFooter}>
              <p>Você pode fechar — o processamento continua e avisamos quando terminar.</p>
              <Button type="button" variant="secondary" onClick={close}>Continuar em segundo plano</Button>
            </div>
          </>
        ) : null}

        {stage === "done" && tracked ? (
          <>
            <div className={styles.successHeader}>
              <span className={styles.successIcon} aria-hidden="true">
                <Check size={20} strokeWidth={2.4} />
              </span>
              <div>
                <strong>Extração concluída — pendente de revisão</strong>
                <span>Nada é publicado no prontuário até você validar.</span>
              </div>
            </div>
            <dl className={styles.counts}>
              <div>
                <dt>resultados</dt>
                <dd>{summary.results}</dd>
              </div>
              <div className={styles.countDanger}>
                <dt>fora da ref.</dt>
                <dd>{summary.outOfRange}</dd>
              </div>
              <div>
                <dt>notas do lab.</dt>
                <dd>{summary.laboratoryNotes}</dd>
              </div>
              <div className={styles.countWarning}>
                <dt>baixa confiança</dt>
                <dd>{summary.lowConfidence}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={attachAnother}>Anexar outro</Button>
              <Button type="button" onClick={() => review(tracked.id)}>Revisar dados extraídos</Button>
            </div>
          </>
        ) : null}

        {stage === "failed" && tracked ? (
          <>
            <div className={styles.failureHeader} role="alert">
              <span className={styles.failureIcon} aria-hidden="true">
                <AlertTriangle size={20} strokeWidth={2} />
              </span>
              <div>
                <strong>A extração falhou</strong>
                <span>{tracked.error ?? "Não foi possível ler este laudo."}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={attachAnother}>Anexar outro</Button>
              <Button type="button" onClick={() => review(tracked.id)}>Ver a falha</Button>
            </div>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
