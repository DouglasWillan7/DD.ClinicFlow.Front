import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldPlus } from "lucide-react";
import type {
  DoctorAccessStatusView,
  PatientActionStatusView,
} from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { PatientActionTokenPanel } from "./PatientActionTokenPanel";
import styles from "./PatientActions.module.css";

export function DoctorAccessPanel({ patientId }: { patientId: string }) {
  const { request } = useAuth();
  const access = useQuery({
    queryKey: ["patient-actions", "doctor-access", patientId],
    queryFn: () =>
      request<DoctorAccessStatusView[]>(
        `/patient-actions/doctor-access?patientId=${encodeURIComponent(patientId)}`,
      ),
  });
  const create = useMutation({
    mutationFn: (doctorUserId: string) =>
      request<PatientActionStatusView>("/patient-actions/doctor-access", {
        method: "POST",
        body: JSON.stringify({ patientId, doctorUserId }),
      }),
    onSuccess: () => access.refetch(),
  });

  return (
    <section className={styles.accessPanel} aria-labelledby="doctor-access-title">
      <header className={styles.accessHeading}>
        <span aria-hidden="true"><ShieldPlus /></span>
        <div>
          <h2 id="doctor-access-title">Compartilhamento com médicos</h2>
          <p>
            O acesso pertence ao médico e só começa depois da ação do paciente.
          </p>
        </div>
      </header>

      {access.isLoading ? (
        <LoadingBlock label="Carregando compartilhamentos…" />
      ) : access.isError ? (
        <ErrorBlock
          message="Não foi possível carregar os compartilhamentos."
          retry={() => void access.refetch()}
        />
      ) : (
        <ul className={styles.accessList}>
          {(access.data ?? []).map((item) => {
            const revoked =
              !item.hasActiveAccess && item.latestAction?.status === "Completed";
            const canRequest =
              !item.hasActiveAccess &&
              item.latestAction?.status !== "Pending";
            return (
              <li key={item.doctorUserId} className={styles.accessItem}>
                <div className={styles.accessIdentity}>
                  <strong>{item.doctorName}</strong>
                  {item.hasActiveAccess ? (
                    <span data-tone="success">
                      <CheckCircle2 aria-hidden="true" /> Acesso ativo
                    </span>
                  ) : item.latestAction?.status === "Pending" ? (
                    <span data-tone="pending">Aguardando paciente</span>
                  ) : revoked ? (
                    <span data-tone="attention">Acesso revogado</span>
                  ) : (
                    <span data-tone="neutral">Sem acesso</span>
                  )}
                </div>

                {item.latestAction?.status === "Pending" ? (
                  <PatientActionTokenPanel
                    action={item.latestAction}
                    onUpdated={async () => {
                      await access.refetch();
                    }}
                  />
                ) : null}

                {canRequest ? (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={
                      create.isPending &&
                      create.variables === item.doctorUserId
                    }
                    disabled={create.isPending}
                    aria-label={`${revoked ? "Solicitar novamente" : "Solicitar compartilhamento"} para ${item.doctorName}`}
                    onClick={() => create.mutate(item.doctorUserId)}
                  >
                    {revoked ? "Solicitar novamente" : "Solicitar compartilhamento"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {create.isError ? (
        <p className={styles.actionError} role="alert">
          {create.error instanceof Error
            ? create.error.message
            : "Não foi possível solicitar o compartilhamento."}
        </p>
      ) : null}
    </section>
  );
}
