import type { HealthcarePlan } from "../../api/types";
import { getInitials } from "../appointments/appointmentLabels";
import { DoctorPlansEditor } from "./DoctorPlansEditor";
import type { ClinicDraft, DoctorDraft } from "./healthcarePlansDraft";
import styles from "./HealthcarePlansSettingsPage.module.css";

export interface CopySource {
  userClinicId: string;
  displayName: string;
  planIds: string[];
}

/**
 * Visão Médico de Configuração › Convênios: o cabeçalho com "copiar de outro médico" e o
 * editor compartilhado com Equipe e Meu perfil.
 */
export function DoctorPlansDetail({
  doctorName,
  plans,
  clinic,
  draft,
  savedCustomPlanIds,
  copySources,
  onChange,
  onEditClinicDefault,
}: {
  doctorName: string;
  plans: HealthcarePlan[];
  clinic: ClinicDraft;
  draft: DoctorDraft;
  /** Lista própria salva, ou `null` se o médico está salvo no padrão. */
  savedCustomPlanIds: string[] | null;
  copySources: CopySource[];
  onChange(draft: DoctorDraft): void;
  onEditClinicDefault(): void;
}) {
  const isCustom = draft.mode === "Custom";

  return (
    <div className={styles.detailBody}>
      <header className={styles.detailHeader}>
        <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
          {getInitials(doctorName)}
        </span>
        <div>
          <h2 id="plans-detail-title">{doctorName}</h2>
          <p>Quais convênios atende nesta clínica.</p>
        </div>
        {isCustom && copySources.length > 0 ? (
          <select
            className={styles.copySelect}
            aria-label="Copiar de outro médico"
            value=""
            onChange={(event) => {
              const source = copySources.find(
                (item) => item.userClinicId === event.target.value,
              );
              if (source) onChange({ mode: "Custom", planIds: source.planIds });
            }}
          >
            <option value="">Copiar de outro médico</option>
            {copySources.map((source) => (
              <option key={source.userClinicId} value={source.userClinicId}>
                {source.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      <DoctorPlansEditor
        doctorName={doctorName}
        plans={plans}
        clinic={clinic}
        draft={draft}
        savedCustomPlanIds={savedCustomPlanIds}
        acceptedPlansLocation="Clínica"
        onChange={onChange}
        onEditClinicDefault={onEditClinicDefault}
      />
    </div>
  );
}
