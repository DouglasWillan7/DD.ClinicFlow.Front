import { PageHeader } from "../../components/PageHeader";
import { ClinicSettingsTabs } from "./ClinicSettingsTabs";

/**
 * Cabeçalho comum às abas da configuração da clínica. É o mesmo em todas as abas para
 * que título e descrição não mudem de tamanho (nem quebrem linha) ao trocar de aba.
 */
export function ClinicSettingsHeader({
  showFirstSteps,
}: {
  showFirstSteps?: boolean;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Configuração"
        title="Clínica"
        description="Dados da unidade, plano, convênios aceitos, confirmações por WhatsApp e receituário."
      />
      <ClinicSettingsTabs showFirstSteps={showFirstSteps} />
    </>
  );
}
