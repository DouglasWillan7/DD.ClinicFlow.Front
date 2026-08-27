import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  DoctorAccessStatusView,
  PatientActionChallengeView,
  PatientActionStatusView,
} from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import styles from "./ClinicalAccessEmailAction.module.css";

function operationError(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    return "Aguarde alguns instantes antes de reenviar. Nenhum novo e-mail foi enviado.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "Atualize o e-mail do paciente no cadastro antes de enviar a autorização.";
  }
  return "Não foi possível enviar a autorização por e-mail. Tente novamente.";
}

function isActiveEmailLink(challenge: PatientActionChallengeView | null) {
  return challenge?.type === "Link" &&
    challenge.channel === "Email" &&
    (challenge.status === "Issued" || challenge.status === "Sent");
}

export function ClinicalAccessEmailAction({ patientId }: { patientId: string }) {
  const { request, session } = useAuth();
  const isDoctor = session?.clinicRole === "Doctor";
  const [override, setOverride] = useState<PatientActionStatusView | null>(null);
  const access = useQuery({
    queryKey: ["patient-actions", "doctor-access", patientId, session?.userId],
    enabled: isDoctor,
    queryFn: () =>
      request<DoctorAccessStatusView[]>(
        `/patient-actions/doctor-access?patientId=${encodeURIComponent(patientId)}`,
      ),
  });
  const current = access.data?.find((item) => item.doctorUserId === session?.userId);
  const action = override ?? current?.latestAction ?? null;
  const challenge = action?.latestChallenge ?? null;
  const canReissue = action?.status === "Pending" && isActiveEmailLink(challenge);

  const send = useMutation({
    mutationFn: async () => {
      if (!session || session.clinicRole !== "Doctor") {
        throw new Error("Operação indisponível para este usuário.");
      }
      if (action?.status !== "Pending") {
        return request<PatientActionStatusView>("/patient-actions/doctor-access", {
          method: "POST",
          body: JSON.stringify({ patientId, doctorUserId: session.userId }),
        });
      }
      const issued = canReissue && challenge
        ? await request<PatientActionChallengeView>(
            `/patient-actions/challenges/${challenge.challengeId}/reissue`,
            { method: "POST" },
          )
        : await request<PatientActionChallengeView>(
            `/patient-actions/${action.actionId}/challenges`,
            {
              method: "POST",
              body: JSON.stringify({
                type: "Link",
                channel: "Email",
                destinationMasked: null,
                expiresAtUtc: action.expiresAtUtc,
              }),
            },
          );
      return { ...action, latestChallenge: issued };
    },
    onSuccess: (updated) => {
      setOverride(updated);
      void access.refetch();
    },
  });

  if (!isDoctor) return null;

  if (access.isLoading) {
    return (
      <p className={styles.loading} role="status" aria-live="polite">
        Preparando o envio da autorização…
      </p>
    );
  }

  if (access.isError) {
    return (
      <div className={styles.feedback}>
        <p role="alert">Não foi possível consultar o envio da autorização.</p>
        <Button type="button" variant="secondary" onClick={() => void access.refetch()}>
          <RefreshCw size={16} aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (current?.hasActiveAccess) {
    return (
      <p className={styles.sent} role="status">
        A autorização do paciente já foi concluída.
      </p>
    );
  }

  const maskedDestination = challenge?.destinationMasked;
  const buttonLabel = action?.status !== "Pending"
    ? "Enviar solicitação por e-mail"
    : canReissue
      ? "Reenviar e-mail"
      : "Enviar por e-mail";

  return (
    <div className={styles.action}>
      <div className={styles.state}>
        <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
        {isActiveEmailLink(challenge) && maskedDestination ? (
          <p role="status" aria-live="polite">
            Enviado para <strong>{maskedDestination}</strong>. Aguardando o paciente.
          </p>
        ) : (
          <p>A solicitação ainda não foi enviada por e-mail.</p>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        loading={send.isPending}
        disabled={send.isPending}
        onClick={() => send.mutate()}
      >
        {canReissue ? (
          <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <Send size={16} strokeWidth={1.8} aria-hidden="true" />
        )}
        {buttonLabel}
      </Button>

      {send.isError ? (
        <p className={styles.error} role="alert" aria-live="assertive">
          {operationError(send.error)}
        </p>
      ) : null}
    </div>
  );
}
