import { useEffect, useRef } from "react";
import { NavLink } from "../../app/navigation";
import { useOnboardingStatus } from "../onboarding/useOnboardingStatus";
import {
  clinicDataPath,
  clinicHealthcarePlansPath,
  clinicPrescriptionTemplatePath,
  clinicSettingsPath,
  clinicWhatsAppPath,
} from "./clinicSettingsPaths";
import styles from "./ClinicSettingsTabs.module.css";

const firstStepsTab = { to: clinicSettingsPath, label: "Primeiros passos" };

const settingsTabs = [
  { to: clinicDataPath, label: "Dados da clínica" },
  { to: clinicHealthcarePlansPath, label: "Convênios" },
  { to: clinicWhatsAppPath, label: "WhatsApp" },
  { to: clinicPrescriptionTemplatePath, label: "Receituário" },
];

/**
 * Seções da configuração da clínica, no mesmo padrão de abas das seções do paciente.
 * Cada aba é uma rota, para o link ser compartilhável.
 *
 * "Primeiros passos" só existe enquanto houver etapa pendente. A própria aba passa
 * `showFirstSteps` para não depender do carregamento do progresso e a barra não pular.
 */
export function ClinicSettingsTabs({
  showFirstSteps,
}: {
  showFirstSteps?: boolean;
}) {
  const onboarding = useOnboardingStatus();
  const hasPendingSteps =
    showFirstSteps ?? (onboarding.data ? !onboarding.data.completed : false);
  const tabs = hasPendingSteps ? [firstStepsTab, ...settingsTabs] : settingsTabs;
  const scrollerRef = useRef<HTMLElement>(null);

  // No celular a barra rola: a aba atual não pode abrir escondida à direita.
  useEffect(() => {
    scrollerRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [hasPendingSteps]);

  return (
    <nav
      ref={scrollerRef}
      className={styles.scroller}
      aria-label="Configuração da clínica"
    >
      <div
        className={
          hasPendingSteps ? `${styles.tabs} ${styles.withFirstSteps}` : styles.tabs
        }
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.active}` : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
