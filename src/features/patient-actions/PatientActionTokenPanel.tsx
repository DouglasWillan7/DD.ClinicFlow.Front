import { CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  PatientActionChallengeView,
  PatientActionStatusView,
} from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import styles from "./PatientActions.module.css";

const terminalCopy: Record<Exclude<PatientActionStatusView["status"], "Pending">, string> = {
  Completed: "Ação concluída",
  Declined: "Paciente recusou o compartilhamento",
  Expired: "Solicitação expirada",
  Cancelled: "Solicitação cancelada",
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    return "Aguarde antes de reenviar o código e tente novamente em instantes.";
  }
  if (error instanceof ApiError && error.status === 410) {
    return "O código expirou. Atualize o estado para emitir uma nova solicitação.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir esta ação.";
}

export function PatientActionTokenPanel({
  action,
  onUpdated,
}: {
  action: PatientActionStatusView;
  onUpdated(): void | Promise<void>;
}) {
  const { request } = useAuth();
  const [token, setToken] = useState("");
  const [challengeOverride, setChallengeOverride] =
    useState<PatientActionChallengeView | null>(null);
  const [pendingOperation, setPendingOperation] = useState<
    "complete" | "issue" | "reissue" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const challenge = challengeOverride ?? action.latestChallenge;

  if (completed) {
    return (
      <p className={styles.actionState} data-tone="success" role="status">
        <CheckCircle2 aria-hidden="true" />
        Ação confirmada. O estado do agendamento e do acesso foi atualizado.
      </p>
    );
  }

  if (action.status !== "Pending") {
    return (
      <p
        className={styles.actionState}
        data-tone={action.status === "Completed" ? "success" : "attention"}
        role="status"
      >
        {action.status === "Completed" ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <Clock3 aria-hidden="true" />
        )}
        {terminalCopy[action.status]}
      </p>
    );
  }

  async function issueToken() {
    setPendingOperation("issue");
    setError(null);
    try {
      const issued = await request<PatientActionChallengeView>(
        `/patient-actions/${action.actionId}/challenges`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "Token",
            channel: "WhatsApp",
            destinationMasked: null,
            expiresAtUtc: action.expiresAtUtc,
          }),
        },
      );
      setChallengeOverride(issued);
      await onUpdated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPendingOperation(null);
    }
  }

  async function reissueToken() {
    if (!challenge) return;
    setPendingOperation("reissue");
    setError(null);
    try {
      const issued = await request<PatientActionChallengeView>(
        `/patient-actions/challenges/${challenge.challengeId}/reissue`,
        { method: "POST" },
      );
      setChallengeOverride(issued);
      await onUpdated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPendingOperation(null);
    }
  }

  async function completeToken() {
    if (!challenge || token.length < 6) return;
    setPendingOperation("complete");
    setError(null);
    try {
      await request<{ status: string }>(
        `/patient-actions/challenges/${challenge.challengeId}/complete-token`,
        {
          method: "POST",
          body: JSON.stringify({ token }),
        },
      );
      setCompleted(true);
      await onUpdated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPendingOperation(null);
    }
  }

  const tokenChallenge = challenge?.type === "Token" &&
    challenge.status !== "Expired" && challenge.status !== "Cancelled";

  return (
    <div className={styles.tokenPanel}>
      <div className={styles.tokenIntro}>
        <ShieldCheck aria-hidden="true" />
        <p>
          O código confirma o agendamento e o compartilhamento dos dados em uma
          única ação do paciente.
        </p>
      </div>

      {tokenChallenge ? (
        <>
          <label className={styles.tokenField}>
            <span>Código de confirmação</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              value={token}
              onChange={(event) =>
                setToken(event.target.value.replace(/\D/g, "").slice(0, 12))
              }
            />
          </label>
          <div className={styles.tokenActions}>
            <Button
              type="button"
              onClick={() => void completeToken()}
              disabled={token.length < 6 || pendingOperation !== null}
              loading={pendingOperation === "complete"}
            >
              Confirmar código
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void reissueToken()}
              disabled={pendingOperation !== null}
              loading={pendingOperation === "reissue"}
            >
              <RefreshCw aria-hidden="true" />
              Reenviar código
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void issueToken()}
          disabled={pendingOperation !== null}
          loading={pendingOperation === "issue"}
        >
          Enviar código pelo WhatsApp
        </Button>
      )}

      {error ? (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
