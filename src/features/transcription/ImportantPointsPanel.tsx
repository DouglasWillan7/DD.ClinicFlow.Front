import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, Check, Pencil, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { Button } from "../../components/Button";
import {
  ConsultationPointConflictError,
  consultationImportantPointsQueryKey,
  getConsultationImportantPoints,
  getConsultationPointCategoryLabel,
  getConsultationPointStatusLabel,
  reviewConsultationImportantPoint,
  saveConsultationImportantPoints,
  type ConsultationImportantPoint,
  type ConsultationImportantPointsSnapshot,
  type ConsultationPointReviewAction,
} from "./importantPoints";
import styles from "./ImportantPointsPanel.module.css";

interface ImportantPointsPanelProps {
  appointmentId: string;
  sessionId: string | null;
  unknownSegmentCount: number;
  onNavigateToEvidence(point: ConsultationImportantPoint): void;
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ImportantPointsPanel(props: ImportantPointsPanelProps) {
  const { appointmentId, unknownSegmentCount, onNavigateToEvidence } = props;
  const { request, session } = useAuth();
  const queryClient = useQueryClient();
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<{ pointId: string; message: string } | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const saveRequestIdRef = useRef<string | null>(null);
  const canWriteClinicalRecord = can(session, "WriteClinicalRecord");
  const queryKey = consultationImportantPointsQueryKey(appointmentId);
  const pointsQuery = useQuery({
    queryKey,
    queryFn: () => getConsultationImportantPoints(request, appointmentId),
    enabled: canWriteClinicalRecord,
  });

  const replacePoint = (nextPoint: ConsultationImportantPoint) => {
    queryClient.setQueryData<ConsultationImportantPointsSnapshot>(queryKey, (current) => current ? {
      ...current,
      points: current.points.map((point) => point.id === nextPoint.id ? nextPoint : point),
    } : current);
  };

  const reviewMutation = useMutation({
    mutationFn: ({ point, action, text }: {
      point: ConsultationImportantPoint;
      action: ConsultationPointReviewAction;
      text: string | null;
    }) => reviewConsultationImportantPoint(request, point.id, {
      action,
      text,
      expectedVersion: point.version,
    }),
    onSuccess: (nextPoint, variables) => {
      replacePoint(nextPoint);
      setReviewFeedback(null);
      if (variables.action === "Edit") {
        setEditingPointId(null);
        setEditText("");
        setEditValidation(null);
      }
      setSaveFeedback(null);
    },
    onError: (error, variables) => {
      if (error instanceof ConsultationPointConflictError) {
        replacePoint(error.currentPoint);
        setEditingPointId(null);
        setReviewFeedback({
          pointId: variables.point.id,
          message: "Este ponto foi atualizado em outra sessão. Revise o estado atual antes de tentar novamente.",
        });
        return;
      }
      setReviewFeedback({
        pointId: variables.point.id,
        message: "Não foi possível atualizar este ponto. Tente novamente.",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      saveRequestIdRef.current ??= crypto.randomUUID();
      return saveConsultationImportantPoints(
        request,
        appointmentId,
        saveRequestIdRef.current,
      );
    },
    onSuccess: (savedPoints) => {
      const savedById = new Map(savedPoints.map((point) => [point.id, point]));
      queryClient.setQueryData<ConsultationImportantPointsSnapshot>(queryKey, (current) => current ? {
        ...current,
        points: current.points.map((point) => savedById.get(point.id) ?? point),
      } : current);
      saveRequestIdRef.current = null;
      setSaveFeedback({ kind: "success", message: "Pontos salvos no prontuário do paciente." });
    },
    onError: (error) => {
      const noAccepted = error instanceof ApiError && error.status === 409;
      setSaveFeedback({
        kind: "error",
        message: noAccepted
          ? "Aceite ao menos um ponto antes de salvar."
          : "Não foi possível salvar os pontos. Tente novamente.",
      });
    },
  });

  if (!canWriteClinicalRecord) return null;

  const snapshot = pointsQuery.data;
  const points = snapshot?.points ?? [];
  const waitingForSpeaker = Math.max(
    unknownSegmentCount,
    snapshot?.waitingForSpeakerCount ?? 0,
  ) > 0;
  const isProcessing = snapshot?.processingStatus === "Pending" ||
    snapshot?.processingStatus === "Processing";

  const beginEdit = (point: ConsultationImportantPoint) => {
    setEditingPointId(point.id);
    setEditText(point.displayText);
    setEditValidation(null);
    setReviewFeedback(null);
  };

  const cancelEdit = () => {
    setEditingPointId(null);
    setEditText("");
    setEditValidation(null);
    setReviewFeedback(null);
  };

  const confirmEdit = (point: ConsultationImportantPoint) => {
    const normalized = editText.trim();
    if (normalized.length < 1 || normalized.length > 500) {
      setEditValidation("Digite entre 1 e 500 caracteres.");
      return;
    }
    setEditValidation(null);
    reviewMutation.mutate({ point, action: "Edit", text: normalized });
  };

  return (
    <section className={styles.panel} aria-labelledby="important-points-title">
      <div className={styles.heading}>
        <div>
          <h2 id="important-points-title">Pontos importantes</h2>
          <p>Extraídos automaticamente da fala. Selecione um ponto para conferir o trecho.</p>
        </div>
        <span
          className={styles.count}
          aria-label={`${points.length} ${points.length === 1 ? "ponto importante" : "pontos importantes"}`}
        >
          {points.length}
        </span>
      </div>

      {pointsQuery.isLoading ? (
        <div className={styles.loading} role="status" aria-label="Carregando pontos importantes">
          <span /><span /><span />
        </div>
      ) : null}

      {pointsQuery.isError ? (
        <div className={styles.error} role="alert">
          <AlertCircle aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar os pontos importantes.</strong>
            <button type="button" onClick={() => void pointsQuery.refetch()}>Tentar novamente</button>
          </div>
        </div>
      ) : null}

      {!pointsQuery.isLoading && !pointsQuery.isError && points.length === 0 ? (
        waitingForSpeaker ? (
          <div className={styles.guidance} role="status">
            <AlertCircle aria-hidden="true" />
            <p>Identifique as vozes para gerar os pontos importantes.</p>
          </div>
        ) : (
          <div className={styles.empty}>
            <Sparkles aria-hidden="true" />
            <strong>Nenhum ponto extraído ainda</strong>
            <span>Os destaques aparecem aqui conforme a conversa avança.</span>
          </div>
        )
      ) : null}

      {isProcessing ? (
        <p className={styles.processing} role="status" aria-live="polite">
          <span aria-hidden="true" />Analisando novos trechos da conversa…
        </p>
      ) : null}

      {snapshot?.processingStatus === "Unavailable" ? (
        <p className={styles.unavailable} role="alert">
          <AlertCircle aria-hidden="true" />
          Os pontos importantes estão temporariamente indisponíveis. A transcrição continua disponível.
        </p>
      ) : null}

      {points.length > 0 ? (
        <div className={styles.list}>
          {points.map((point) => {
            const categoryLabel = getConsultationPointCategoryLabel(point.category);
            const isEditing = editingPointId === point.id;
            const isReviewing = reviewMutation.isPending;
            const canReviewDraft = point.status === "Draft";
            const canEdit = point.status === "Draft" || point.status === "Accepted";
            return (
              <article
                className={styles.point}
                data-category={point.category.toLowerCase()}
                key={point.id}
              >
                <button
                  className={styles.pointNavigate}
                  type="button"
                  onClick={() => onNavigateToEvidence(point)}
                  aria-label={`Ir ao trecho de ${categoryLabel}: ${point.displayText}`}
                >
                  <span className={styles.pointMeta}>
                    <span className={styles.category}>{categoryLabel}</span>
                    <time>{formatTime(point.firstEvidenceStartTimeMs)}</time>
                  </span>
                  <span className={styles.pointText}>{point.displayText}</span>
                  <span className={styles.pointFooter}>
                    <span className={styles.reviewStatus} data-status={point.status.toLowerCase()}>
                      {getConsultationPointStatusLabel(point.status)}
                    </span>
                    <span className={styles.evidenceLink}>Ver trecho <ArrowUpRight aria-hidden="true" /></span>
                  </span>
                </button>

                {isEditing ? (
                  <div className={styles.editor}>
                    <label htmlFor={`point-edit-${point.id}`}>Texto revisado do ponto</label>
                    <textarea
                      id={`point-edit-${point.id}`}
                      value={editText}
                      onChange={(event) => {
                        setEditText(event.target.value);
                        setEditValidation(null);
                      }}
                      aria-invalid={editValidation ? "true" : undefined}
                      aria-describedby={editValidation ? `point-edit-error-${point.id}` : undefined}
                      disabled={isReviewing}
                    />
                    <span className={styles.characterCount}>{editText.length}/500</span>
                    {editValidation ? (
                      <p id={`point-edit-error-${point.id}`} className={styles.inlineError} role="alert">{editValidation}</p>
                    ) : null}
                    <div className={styles.editorActions}>
                      <button type="button" onClick={cancelEdit} disabled={isReviewing}>Cancelar edição</button>
                      <button type="button" onClick={() => confirmEdit(point)} disabled={isReviewing}>Confirmar edição</button>
                    </div>
                  </div>
                ) : null}

                {!isEditing && canEdit ? (
                  <div className={styles.reviewActions} aria-label={`Revisar ${categoryLabel}`}>
                    {canReviewDraft ? (
                      <button
                        type="button"
                        onClick={() => reviewMutation.mutate({ point, action: "Accept", text: null })}
                        disabled={isReviewing}
                        aria-label="Aceitar ponto"
                      ><Check aria-hidden="true" />Aceitar</button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => beginEdit(point)}
                      disabled={isReviewing}
                      aria-label="Editar ponto"
                    ><Pencil aria-hidden="true" />Editar</button>
                    {canReviewDraft ? (
                      <button
                        type="button"
                        onClick={() => reviewMutation.mutate({ point, action: "Reject", text: null })}
                        disabled={isReviewing}
                        aria-label="Rejeitar ponto"
                      ><X aria-hidden="true" />Rejeitar</button>
                    ) : null}
                  </div>
                ) : null}

                {reviewFeedback?.pointId === point.id ? (
                  <p className={styles.mutationError} role="alert">{reviewFeedback.message}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <p className={styles.disclaimer}>
        <Sparkles aria-hidden="true" />
        Pontos gerados por IA a partir do áudio. Revise antes de salvar no prontuário.
      </p>

      {points.length > 0 && points.some((point) => point.status !== "Saved") ? (
        <Button
          className={styles.saveButton}
          type="button"
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
        >
          Salvar pontos no prontuário
        </Button>
      ) : null}

      {saveFeedback ? (
        <p
          className={saveFeedback.kind === "success" ? styles.saveSuccess : styles.mutationError}
          role={saveFeedback.kind === "success" ? "status" : "alert"}
        >
          {saveFeedback.message}
        </p>
      ) : null}
    </section>
  );
}
