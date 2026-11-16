import { Info, Star } from "lucide-react";
import type { HealthcarePlan, HealthcarePlanMode } from "../../api/types";
import { getInitials } from "../appointments/appointmentLabels";
import { healthcarePlanModeLabels } from "./healthcarePlanLabels";
import {
  type ClinicDraft,
  diffFromDefault,
  type DoctorDraft,
  doctorSelectedIds,
  toggleId,
} from "./healthcarePlansDraft";
import styles from "./HealthcarePlansSettingsPage.module.css";

export interface CopySource {
  userClinicId: string;
  displayName: string;
  planIds: string[];
}

const modeHints: Record<HealthcarePlanMode, string> = {
  ClinicDefault: "Atende os convênios padrão e acompanha quando a clínica mudar.",
  Custom: "Uma lista própria, escolhida entre os convênios aceitos.",
};

/**
 * Visão Médico. No padrão a lista vem da clínica e fica travada; em personalizado é
 * editável, sempre dentro dos convênios aceitos (`clinic` é o estado salvo da clínica).
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
  /** `null` na visão do próprio médico ("Meus convênios"). */
  doctorName: string | null;
  plans: HealthcarePlan[];
  clinic: ClinicDraft;
  draft: DoctorDraft;
  /** Lista própria salva, ou `null` se o médico está salvo no padrão. */
  savedCustomPlanIds: string[] | null;
  copySources: CopySource[];
  onChange(draft: DoctorDraft): void;
  onEditClinicDefault?: () => void;
}) {
  const accepted = plans.filter((plan) => clinic.accepted.includes(plan.id));
  const selected = doctorSelectedIds(draft, clinic);
  const isCustom = draft.mode === "Custom";
  const diff = diffFromDefault(selected, clinic.defaults);
  const differs = diff.added.length > 0 || diff.removed.length > 0;
  const planName = (id: string) =>
    plans.find((plan) => plan.id === id)?.name ?? "Convênio";

  function changeMode(mode: HealthcarePlanMode) {
    if (mode === draft.mode) return;
    // Personalizar parte da lista própria salva ou, para quem seguia o padrão, do padrão.
    onChange({
      mode,
      planIds: mode === "Custom" ? savedCustomPlanIds ?? clinic.defaults : [],
    });
  }

  const setPlans = (planIds: string[]) => onChange({ mode: "Custom", planIds });

  return (
    <div className={styles.detailBody}>
      <header className={styles.detailHeader}>
        {doctorName ? (
          <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
            {getInitials(doctorName)}
          </span>
        ) : null}
        <div>
          <h2 id="plans-detail-title">{doctorName ?? "Meus convênios"}</h2>
          <p>
            {doctorName
              ? "Quais convênios atende nesta clínica."
              : "Quais convênios você atende nesta clínica."}
          </p>
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
              if (source) setPlans(source.planIds);
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

      <fieldset className={styles.modeGroup}>
        <legend>Origem dos convênios</legend>
        {(["ClinicDefault", "Custom"] as const).map((mode) => (
          <label className={styles.modeOption} key={mode}>
            <input
              type="radio"
              name="healthcare-plan-mode"
              checked={draft.mode === mode}
              onChange={() => changeMode(mode)}
            />
            <span>
              <strong>
                {mode === "ClinicDefault" ? (
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                ) : null}
                {healthcarePlanModeLabels[mode]}
              </strong>
              <small>{modeHints[mode]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {accepted.length === 0 ? (
        <p className={styles.hint}>
          {onEditClinicDefault
            ? "A clínica ainda não aceita convênios. Marque os aceitos em Clínica para atribuí-los aos médicos."
            : "A clínica ainda não aceita convênios. Peça ao administrador para configurá-los."}
        </p>
      ) : (
        <>
          {isCustom && differs ? (
            <div className={styles.diffBanner}>
              <strong>Difere do padrão:</strong>
              <ul className={styles.diffList} aria-label="Diferenças para o padrão da clínica">
                {diff.added.map((id) => (
                  <li className={styles.diffAdded} key={id}>
                    <span aria-hidden="true">+ </span>
                    <span className="srOnly">A mais: </span>
                    {planName(id)}
                  </li>
                ))}
                {diff.removed.map((id) => (
                  <li className={styles.diffRemoved} key={id}>
                    <span aria-hidden="true">− </span>
                    <span className="srOnly">A menos: </span>
                    {planName(id)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setPlans(clinic.defaults)}
              >
                Aplicar padrão da clínica
              </button>
            </div>
          ) : null}

          <section aria-labelledby="doctor-plans-list-title">
            <div className={styles.listHeading}>
              <h3 id="doctor-plans-list-title">
                Convênios atendidos · {selected.length} de {accepted.length}
              </h3>
              {isCustom ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={selected.length === accepted.length}
                  onClick={() => setPlans(accepted.map((plan) => plan.id))}
                >
                  Marcar todos
                </button>
              ) : (
                <span className={styles.definedTag}>
                  <Star size={12} fill="currentColor" aria-hidden="true" />
                  definido pela clínica
                </span>
              )}
            </div>
            <fieldset className={styles.planGrid} disabled={!isCustom}>
              <legend className="srOnly">
                {doctorName
                  ? `Convênios atendidos por ${doctorName}`
                  : "Convênios que você atende"}
              </legend>
              {accepted.map((plan) => (
                <label className={styles.planOption} key={plan.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(plan.id)}
                    onChange={() => setPlans(toggleId(selected, plan.id))}
                  />
                  <span>{plan.name}</span>
                  {isCustom && clinic.defaults.includes(plan.id) ? (
                    <span className={styles.defaultMark}>
                      <Star size={13} fill="currentColor" aria-hidden="true" />
                      <span className="srOnly">(padrão da clínica)</span>
                    </span>
                  ) : null}
                </label>
              ))}
            </fieldset>
            {isCustom ? (
              <p className={styles.legendNote} aria-hidden="true">
                <Star size={12} fill="currentColor" /> = padrão da clínica
              </p>
            ) : null}
          </section>
        </>
      )}

      {!isCustom ? (
        <p className={styles.infoNote}>
          <Info size={16} aria-hidden="true" />
          <span>
            Consulta particular está sempre disponível.{" "}
            {onEditClinicDefault ? (
              <button
                type="button"
                className={styles.inlineLink}
                onClick={onEditClinicDefault}
              >
                Alterar o padrão da clínica
              </button>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  );
}
