import clsx from "clsx";
import { KeyRound, ShieldCheck } from "lucide-react";
import type { ClinicMember } from "../../api/types";
import { roleLabels } from "../../auth/roles";
import { ContextBar, type ContextCrumb } from "../../components/ContextBar";
import { StatusBadge } from "../../components/StatusBadge";
import { SettingsTabs } from "../clinic/SettingsTabs";
import {
  hasDoctorSections,
  memberProfilePath,
  memberProfileSectionLabels,
  teamPath,
  type MemberProfileSection,
} from "./memberProfilePaths";
import {
  memberInitials,
  memberName,
  roleIcons,
  statusBadges,
  statusLabels,
} from "./teamLabels";
import styles from "./MemberProfileHeader.module.css";

const doctorSections: MemberProfileSection[] = ["membership", "availability", "plans"];

/**
 * Cabeçalho do perfil de um integrante, no mesmo padrão do paciente: trilha, cartão com a
 * identidade e, para médico, as abas Vínculo, Disponibilidade e Convênios. Quem não é
 * médico só tem o vínculo, então fica sem barra de abas.
 */
export function MemberProfileHeader({
  member,
  section,
}: {
  member: ClinicMember;
  section: MemberProfileSection;
}) {
  const name = memberName(member);
  const withTabs = hasDoctorSections(member);
  const metadata = [member.email, member.phone].filter(Boolean).join(" · ");
  const crumbs: ContextCrumb[] = withTabs
    ? [
        { label: "Equipe", to: teamPath },
        { label: name, to: memberProfilePath(member.userClinicId), truncate: true },
        { label: memberProfileSectionLabels[section] },
      ]
    : [
        { label: "Equipe", to: teamPath },
        { label: name, truncate: true },
      ];
  const status = statusBadges[member.status];

  return (
    <header className={styles.header}>
      {/* O h1 da tela é o nome do integrante, no cartão abaixo. O voltar é um link:
          passa pelo aviso de alterações não salvas. */}
      <ContextBar back={{ label: "Voltar para a equipe", to: teamPath }} crumbs={crumbs} />

      <div className={clsx(styles.memberCard, !withTabs && styles.withoutTabs)}>
        <div className={styles.identityRow}>
          <span className={styles.avatar} aria-hidden="true">
            {memberInitials(member)}
          </span>

          <div className={styles.identityCopy}>
            <h1>{name}</h1>
            {metadata ? <p>{metadata}</p> : null}
            <div className={styles.badges}>
              <StatusBadge tone="neutral" icon={roleIcons[member.role]}>
                {roleLabels[member.role]}
              </StatusBadge>
              {member.isAdmin ? (
                <StatusBadge tone="info" icon={ShieldCheck}>
                  Administração
                </StatusBadge>
              ) : null}
              {member.isOwner ? (
                <StatusBadge tone="neutral" icon={KeyRound}>
                  Proprietária
                </StatusBadge>
              ) : null}
              <StatusBadge tone={status.tone} icon={status.icon}>
                {statusLabels[member.status]}
              </StatusBadge>
            </div>
          </div>
        </div>

        {withTabs ? (
          <div className={styles.navigation}>
            <SettingsTabs
              label="Seções do perfil"
              tabs={doctorSections.map((item) => ({
                to: memberProfilePath(member.userClinicId, item),
                label: memberProfileSectionLabels[item],
              }))}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
