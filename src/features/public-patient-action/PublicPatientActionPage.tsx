import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { ApiError, apiRequest } from "../../api/client";
import type {
  PatientActionPublicSnapshot,
  PatientActionPublicView,
} from "../../api/types";
import { Button } from "../../components/Button";
import styles from "./PublicPatientActionPage.module.css";

type PublicResult = "completed" | "declined";

function publicPath(reference: string) {
  return `/public/patient-actions/${encodeURIComponent(reference)}`;
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function appointmentDate(snapshot: PatientActionPublicSnapshot) {
  const value = safeText(snapshot.scheduledStartUtc);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const timeZone = safeText(snapshot.timeZoneId) ?? undefined;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(date);
  }
}

function sharedDataLabel(value: string) {
  const labels: Record<string, string> = {
    "clinical-record": "Dados necessários ao atendimento",
  };
  return labels[value] ?? "Dados necessários ao atendimento";
}

function resultFor(view: PatientActionPublicView, local: PublicResult | null) {
  if (local) return local;
  if (view.status === "Completed") return "completed";
  if (view.status === "Declined") return "declined";
  return null;
}

function mutationError(error: unknown) {
  if (error instanceof ApiError && error.status === 410) {
    return "Este link expirou e não pode mais ser usado.";
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Aguarde alguns instantes antes de tentar novamente.";
  }
  return "Não foi possível concluir agora. Tente novamente.";
}

export function PublicPatientActionPage({ reference }: { reference: string }) {
  const [openedAt] = useState(() => Date.now());
  const [result, setResult] = useState<PublicResult | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const action = useQuery({
    queryKey: ["public-patient-action", reference],
    queryFn: () => apiRequest<PatientActionPublicView>(publicPath(reference)),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (operation: "complete" | "decline") =>
      apiRequest<{ status: PublicResult }>(`${publicPath(reference)}/${operation}`, {
        method: "POST",
      }),
    onSuccess: async (response) => {
      setResult(response.status);
      setConfirmingDecline(false);
      await action.refetch();
    },
  });

  if (action.isLoading) {
    return (
      <PublicLayout>
        <section className={styles.stateCard} role="status">
          <span className={styles.stateIcon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <h1>Verificando seu link…</h1>
          <p>Isso leva apenas alguns instantes.</p>
        </section>
      </PublicLayout>
    );
  }

  if (action.isError || !action.data) {
    return (
      <PublicLayout>
        <section
          className={styles.stateCard}
          role="alert"
          aria-label="Link inválido ou indisponível"
        >
          <span className={styles.stateIcon} data-tone="attention" aria-hidden="true">
            <TriangleAlert />
          </span>
          <h1>Link inválido ou indisponível</h1>
          <p>
            Solicite à clínica um novo link. Nenhuma informação foi compartilhada
            por esta tentativa.
          </p>
        </section>
      </PublicLayout>
    );
  }

  const view = action.data;
  const outcome = resultFor(view, result);
  const expired =
    view.status === "Expired" ||
    view.challengeStatus === "Expired" ||
    Date.parse(view.expiresAtUtc) <= openedAt;
  const cancelled = view.status === "Cancelled";

  return (
    <PublicLayout>
      <article className={styles.card}>
        <header className={styles.hero}>
          <span className={styles.heroIcon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <p className={styles.eyebrow}>Ação segura do paciente</p>
            <h1>
              {view.actionType === "AppointmentWithDataSharing"
                ? "Confirme sua consulta"
                : "Compartilhe seus dados com o médico"}
            </h1>
            <p>
              Revise as informações abaixo antes de decidir. A clínica não terá
              acesso à sua decisão até você concluir uma das ações.
            </p>
          </div>
        </header>

        <section className={styles.details} aria-labelledby="action-details-title">
          <h2 id="action-details-title">O que você está confirmando</h2>
          <dl className={styles.detailList}>
            <SnapshotItem
              icon={<Building2 />}
              label="Clínica"
              value={safeText(view.snapshot.clinicName) ?? "Clínica solicitante"}
            />
            <SnapshotItem
              icon={<Stethoscope />}
              label="Médico"
              value={safeText(view.snapshot.doctorName) ?? "Médico solicitante"}
            />
            {appointmentDate(view.snapshot) ? (
              <SnapshotItem
                icon={<CalendarClock />}
                label="Consulta"
                value={appointmentDate(view.snapshot)!}
              />
            ) : null}
          </dl>
        </section>

        <section className={styles.sharing} aria-labelledby="sharing-title">
          <span aria-hidden="true"><FileCheck2 /></span>
          <div>
            <h2 id="sharing-title">Dados compartilhados</h2>
            <p>
              {safeText(view.snapshot.dataSharing) ??
                "O médico terá acesso aos dados necessários ao atendimento."}
            </p>
            {Array.isArray(view.snapshot.sharedData) ? (
              <ul>
                {[...new Set(view.snapshot.sharedData)]
                  .filter((item): item is string => typeof item === "string")
                  .map((item) => <li key={item}>{sharedDataLabel(item)}</li>)}
              </ul>
            ) : null}
          </div>
        </section>

        <p className={styles.terms}>
          Termos aplicáveis: <strong>{view.termsVersion}</strong>
        </p>

        {outcome === "completed" ? (
          <ResultState
            label="Consulta confirmada e dados compartilhados"
            title="Tudo certo"
            message="A consulta foi confirmada e o médico recebeu o acesso necessário em uma única ação."
          />
        ) : outcome === "declined" ? (
          <ResultState
            label="Solicitação recusada"
            title="Solicitação recusada"
            message="Nenhum acesso foi concedido. Se havia uma consulta pendente, ela foi cancelada."
            tone="attention"
          />
        ) : expired ? (
          <ResultState
            label="Link expirado"
            title="Este link expirou"
            message="Nenhum acesso foi concedido. Entre em contato com a clínica para receber uma nova solicitação."
            tone="attention"
          />
        ) : cancelled ? (
          <ResultState
            label="Solicitação cancelada"
            title="Solicitação cancelada"
            message="Este link não aceita mais ações e nenhum novo acesso será concedido."
            tone="attention"
          />
        ) : confirmingDecline ? (
          <div
            className={styles.declineConfirmation}
            role="group"
            aria-label="Confirmar recusa"
          >
            <p>
              Ao recusar, nenhum dado será compartilhado e a consulta será
              cancelada. Deseja continuar?
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="danger"
                loading={mutation.isPending}
                onClick={() => mutation.mutate("decline")}
              >
                Confirmar recusa
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => setConfirmingDecline(false)}
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button
              type="button"
              loading={mutation.isPending && mutation.variables === "complete"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("complete")}
            >
              Confirmar consulta e compartilhar dados
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => setConfirmingDecline(true)}
            >
              Recusar
            </Button>
          </div>
        )}

        {mutation.isError ? (
          <p className={styles.error} role="alert">
            {mutationError(mutation.error)}
          </p>
        ) : null}
      </article>
    </PublicLayout>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <a className={styles.brand} href="/" aria-label="ClinicFlow — início">
        <span aria-hidden="true">CF</span>
        ClinicFlow
      </a>
      {children}
      <p className={styles.privacyNote}>
        ClinicFlow protege esta decisão e não exibe seus dados pessoais neste link.
      </p>
    </main>
  );
}

function SnapshotItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span className={styles.detailIcon} aria-hidden="true">{icon}</span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function ResultState({
  label,
  title,
  message,
  tone = "success",
}: {
  label: string;
  title: string;
  message: string;
  tone?: "success" | "attention";
}) {
  return (
    <section
      className={styles.result}
      data-tone={tone}
      role="status"
      aria-label={label}
    >
      {tone === "success" ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <TriangleAlert aria-hidden="true" />
      )}
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </section>
  );
}
