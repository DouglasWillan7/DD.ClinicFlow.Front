import { useQuery } from "@tanstack/react-query";
import type { OnboardingStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { PageHeader } from "../../components/PageHeader";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { onboardingKey } from "./onboarding";
import styles from "./OnboardingPage.module.css";

export function OnboardingPage() {
  const { request } = useAuth();
  const query = useQuery({
    queryKey: onboardingKey,
    queryFn: () => request<OnboardingStatus>("/onboarding/status"),
  });

  return (
    <>
      <PageHeader
        eyebrow="Configuração guiada"
        title="Vamos colocar sua clínica em fluxo."
        description="Conclua uma etapa por vez. A agenda continua disponível durante toda a configuração."
      />
      <div className={styles.content}>
        {query.isLoading ? (
          <LoadingBlock label="Organizando seus primeiros passos…" />
        ) : query.isError ? (
          <ErrorBlock
            message="Não foi possível consultar o progresso da configuração."
            retry={() => void query.refetch()}
          />
        ) : query.data ? (
          <>
            <OnboardingChecklist status={query.data} />
            <aside>
              <span>Como funciona</span>
              <h2>O progresso acompanha a operação real.</h2>
              <p>
                Cada etapa é concluída quando o ClinicFlow encontra a
                configuração correspondente. Paciente e consulta só são
                liberados quando suas dependências estiverem prontas.
              </p>
            </aside>
          </>
        ) : null}
      </div>
    </>
  );
}
