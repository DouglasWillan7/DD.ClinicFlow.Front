import { useOnboardingStatus } from "../onboarding/useOnboardingStatus";
import {
  clinicDataPath,
  clinicHealthcarePlansPath,
  clinicPrescriptionTemplatePath,
  clinicSettingsPath,
  clinicWhatsAppPath,
} from "./clinicSettingsPaths";
import { SettingsTabs } from "./SettingsTabs";

const firstStepsTab = { to: clinicSettingsPath, label: "Primeiros passos" };

const settingsTabs = [
  { to: clinicDataPath, label: "Dados da clínica" },
  { to: clinicHealthcarePlansPath, label: "Convênios" },
  { to: clinicWhatsAppPath, label: "WhatsApp" },
  { to: clinicPrescriptionTemplatePath, label: "Receituário" },
];

/**
 * Seções da configuração da clínica.
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

  return (
    <SettingsTabs
      label="Configuração da clínica"
      tabs={hasPendingSteps ? [firstStepsTab, ...settingsTabs] : settingsTabs}
      scrollOnPhone={hasPendingSteps}
    />
  );
}
