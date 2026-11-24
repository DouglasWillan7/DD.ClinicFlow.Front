import { Info, Star } from "lucide-react";
import { useId } from "react";
import type { HealthcarePlan, HealthcarePlanMode } from "../../api/types";
import { healthcarePlanModeLabels } from "./healthcarePlanLabels";
import {
  type ClinicDraft,
  diffFromDefault,
  type DoctorDraft,
  doctorSelectedIds,
  toggleId,
} from "./healthcarePlansDraft";
import styles from "./HealthcarePlansSettingsPage.module.css";

const modeHints: Record<HealthcarePlanMode, string> = {
  ClinicDefault: "Atende os convênios padrão e acompanha quando a clínica mudar.",
  Custom: "Uma lista própria, escolhida entre os convênios aceitos.",
};

/**
 * Origem e lista de convênios de um médico. No padrão a lista vem da clínica e fica
 * travada; em personalizado é editável, sempre dentro dos convênios aceitos (`clinic` é o
 * estado salvo da clínica). É o mesmo editor em Configuração › Convênios, no vínculo em
 * Equipe e em Meu perfil; quem o usa decide quando e como salvar.
 */
export function DoctorPlansEditor({
  doctorName,
  plans,
  clinic,
  draft,
  savedCustomPlanIds,
  disabled = false,
  listHeadingAs: ListHeading = "h3",
  acceptedPlansLocation = "Configuração › Convênios",
  onChange,
  onEditClinicDefault,
}: {
  /** Só para o rótulo acessível da lista. */
  doctorName: string;
  plans: HealthcarePlan[];
  clinic: ClinicDraft;
  draft: DoctorDraft;
  /** Lista própria salva, ou `null` se o médico está salvo no padrão. */
  savedCustomPlanIds: string[] | null;
  disabled?: boolean;
  /** Nível do título da lista, conforme o título da seção que hospeda o editor. */
  listHeadingAs?: "h3" | "h4";
  /** Onde os convênios aceitos são marcados, do ponto de vista da tela que hospeda o editor. */
  acceptedPlansLocation?: string;
  onChange(draft: DoctorDraft): void;
  /** Atalho para o padrão da clínica; sem ele o editor só diz onde o padrão é definido. */
  onEditClinicDefault?(): void;
}) {
  const id = useId();
  const listTitleId = `${id}-list-title`;
  const accepted = plans.filter((plan) => clinic.accepted.includes(plan.id));
  const selected = doctorSelectedIds(draft, clinic);
  const isCustom = draft.mode === "Custom";
  const diff = diffFromDefault(selected, clinic.defaults);
  const differs = diff.added.length > 0 || diff.removed.length > 0;
  const planName = (planId: string) =>
    plans.find((plan) => plan.id === planId)?.name ?? "Convênio";

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
      <fieldset className={styles.modeGroup} disabled={disabled}>
        <legend>Origem dos convênios</legend>
        {(["ClinicDefault", "Custom"] as const).map((mode) => (
          <label className={styles.modeOption} key={mode}>
            <input
              type="radio"
              name={`${id}-mode`}
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
          A clínica ainda não aceita convênios. Marque os aceitos em{" "}
          {acceptedPlansLocation} para atribuí-los aos médicos.
        </p>
      ) : (
        <>
          {isCustom && differs ? (
            <div className={styles.diffBanner}>
              <strong>Difere do padrão:</strong>
              <ul className={styles.diffList} aria-label="Diferenças para o padrão da clínica">
                {diff.added.map((planId) => (
                  <li className={styles.diffAdded} key={planId}>
                    <span aria-hidden="true">+ </span>
                    <span className="srOnly">A mais: </span>
                    {planName(planId)}
                  </li>
                ))}
                {diff.removed.map((planId) => (
                  <li className={styles.diffRemoved} key={planId}>
                    <span aria-hidden="true">− </span>
                    <span className="srOnly">A menos: </span>
                    {planName(planId)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.linkButton}
                disabled={disabled}
                onClick={() => setPlans(clinic.defaults)}
              >
                Aplicar padrão da clínica
              </button>
            </div>
          ) : null}

          <section aria-labelledby={listTitleId}>
            <div className={styles.listHeading}>
              <ListHeading id={listTitleId}>
                Convênios atendidos · {selected.length} de {accepted.length}
              </ListHeading>
              {isCustom ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={disabled || selected.length === accepted.length}
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
            <fieldset className={styles.planGrid} disabled={!isCustom || disabled}>
              <legend className="srOnly">
                {`Convênios atendidos por ${doctorName}`}
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
            ) : (
              "O padrão da clínica é definido em Configuração › Convênios."
            )}
          </span>
        </p>
      ) : null}
    </div>
  );
}
