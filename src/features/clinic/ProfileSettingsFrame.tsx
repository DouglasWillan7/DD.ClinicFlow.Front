import type { ReactNode } from "react";
import type { CurrentUser } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { actsAsDoctor } from "../../auth/permissions";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { PageHeader } from "../../components/PageHeader";
import { useCurrentUser } from "./profileQueries";
import {
  profileAvailabilityPath,
  profilePlansPath,
  profileSettingsPath,
} from "./profileSettingsPaths";
import styles from "./SettingsLayout.module.css";
import { SettingsTabs } from "./SettingsTabs";

const doctorTabs = [
  { to: profileSettingsPath, label: "Conta" },
  { to: profileAvailabilityPath, label: "Disponibilidade" },
  { to: profilePlansPath, label: "Convênios" },
];

/**
 * Moldura comum às abas de Meu perfil: cabeçalho, abas e o carregamento do perfil. O
 * cabeçalho é o mesmo em todas as abas para o título não mudar de tamanho ao trocar.
 *
 * As abas saem da sessão, que já está na mão, para a barra não aparecer depois do
 * carregamento. Quem não atende como médico só tem a conta, então fica sem barra.
 */
export function ProfileSettingsFrame({
  children,
}: {
  children: (profile: CurrentUser) => ReactNode;
}) {
  const { session } = useAuth();
  const profile = useCurrentUser();
  const isDoctor = actsAsDoctor(session);

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description={
          isDoctor
            ? "Sua identificação profissional, seus horários de atendimento e os convênios que você atende nesta clínica."
            : "Mantenha sua identificação profissional clara para a equipe e para os atendimentos."
        }
      />
      {isDoctor ? <SettingsTabs label="Meu perfil" tabs={doctorTabs} /> : null}
      <div className={styles.content}>
        {profile.isLoading ? (
          <LoadingBlock label="Carregando seu perfil…" />
        ) : profile.isError ? (
          <ErrorBlock
            message="Não foi possível carregar seu perfil."
            retry={() => void profile.refetch()}
          />
        ) : profile.data ? (
          children(profile.data)
        ) : null}
      </div>
    </>
  );
}

/** Aviso das abas de médico para um perfil que não atende como médico. */
export function NoDoctorPracticeNote() {
  return (
    <section className={styles.panel}>
      <p className={styles.wide}>
        Este perfil não possui atuação médica. As informações de CRM e agenda
        aparecem quando a função Médico é adicionada pela administração.
      </p>
    </section>
  );
}
