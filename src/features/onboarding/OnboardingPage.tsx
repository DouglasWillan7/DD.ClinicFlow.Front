import { Redirect } from "../../app/navigation";
import { LoadingBlock } from "../../components/Feedback";
import { ClinicSettingsHeader } from "../clinic/ClinicSettingsHeader";
import { clinicDataPath } from "../clinic/clinicSettingsPaths";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { useOnboardingStatus } from "./useOnboardingStatus";
import styles from "./OnboardingPage.module.css";

/**
 * Aba "Primeiros passos", a entrada da configuração da clínica enquanto houver etapa
 * pendente. O onboarding acontece no cadastro; aqui a pessoa só vê o que ficou para depois.
 */
export function OnboardingPage() {
  const query = useOnboardingStatus();

  // Tudo configurado, ou progresso indisponível: não há o que listar e a configuração
  // abre direto nos dados da clínica.
  if (query.data?.completed || query.isError) {
    return <Redirect to={clinicDataPath} replace />;
  }

  return (
    <>
      <ClinicSettingsHeader showFirstSteps />
      <div className={styles.content}>
        {query.data ? (
          <>
            <OnboardingChecklist status={query.data} />
            <aside>
              <span>Como funciona</span>
              <h2>O que ficou para depois no cadastro.</h2>
              <p>
                Cada etapa é concluída quando o ClinicFlow encontra a
                configuração correspondente. Quando todas estiverem prontas,
                esta aba deixa de aparecer.
              </p>
            </aside>
          </>
        ) : (
          <LoadingBlock label="Organizando seus primeiros passos…" />
        )}
      </div>
    </>
  );
}
