import { AlertTriangle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { HealthcarePlan } from "../../api/types";
import { doctorCountLabel } from "./healthcarePlanLabels";
import {
  type ClinicDraft,
  normalizeClinicDraft,
  toggleId,
} from "./healthcarePlansDraft";
import styles from "./HealthcarePlansSettingsPage.module.css";

const checkboxId = (planId: string) => `clinic-plan-${planId}`;

/**
 * Visão Clínica: convênios aceitos (com quantos médicos atendem e o botão de padrão) e,
 * abaixo, o restante do catálogo.
 */
export function ClinicPlansDetail({
  catalog,
  draft,
  doctorCounts,
  onChange,
}: {
  catalog: HealthcarePlan[];
  draft: ClinicDraft;
  /** `null` enquanto as listas dos médicos não carregaram. */
  doctorCounts: Map<string, number> | null;
  onChange(draft: ClinicDraft): void;
}) {
  const current = normalizeClinicDraft(draft);
  const accepted = catalog.filter((plan) => current.accepted.includes(plan.id));
  const others = catalog.filter((plan) => !current.accepted.includes(plan.id));
  // Marcar ou desmarcar move o convênio de lista; o foco acompanha a caixa.
  const [movedPlanId, setMovedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!movedPlanId) return;
    document.getElementById(checkboxId(movedPlanId))?.focus();
  }, [movedPlanId, current.accepted.length]);

  function toggleAccepted(planId: string) {
    setMovedPlanId(planId);
    onChange({ ...current, accepted: toggleId(current.accepted, planId) });
  }

  return (
    <div className={styles.detailBody}>
      <header className={styles.detailHeader}>
        <div>
          <h2 id="plans-detail-title">Convênios da clínica</h2>
          <p>
            Marque os convênios aceitos. Use <strong>Padrão</strong> para os que
            todo médico em “Padrão da clínica” deve atender.
          </p>
        </div>
      </header>

      <section aria-labelledby="clinic-accepted-title">
        <div className={styles.listHeading}>
          <h3 id="clinic-accepted-title">
            Aceitos · {accepted.length} de {catalog.length}
          </h3>
          {accepted.length > 0 ? <span>Médicos que atendem</span> : null}
        </div>
        {accepted.length === 0 ? (
          <p className={styles.hint}>
            A clínica ainda não aceita convênios. Marque abaixo os que ela aceita;
            enquanto isso, só consulta particular.
          </p>
        ) : (
          <ul className={styles.acceptedList}>
            {accepted.map((plan) => {
              const isDefault = current.defaults.includes(plan.id);
              const count = doctorCounts?.get(plan.id) ?? 0;
              return (
                <li className={styles.acceptedRow} key={plan.id}>
                  <label className={styles.rowAccept}>
                    <input
                      id={checkboxId(plan.id)}
                      type="checkbox"
                      checked
                      onChange={() => toggleAccepted(plan.id)}
                    />
                    <span>{plan.name}</span>
                  </label>
                  {doctorCounts === null ? null : count === 0 ? (
                    <span className={styles.alertTag}>
                      <AlertTriangle size={13} aria-hidden="true" />
                      Nenhum médico
                    </span>
                  ) : (
                    <span className={styles.rowCount}>{doctorCountLabel(count)}</span>
                  )}
                  <button
                    type="button"
                    className={styles.starButton}
                    aria-pressed={isDefault}
                    aria-label={`${plan.name} no padrão da clínica`}
                    onClick={() =>
                      onChange({
                        ...current,
                        defaults: toggleId(current.defaults, plan.id),
                      })
                    }
                  >
                    <Star
                      size={14}
                      fill={isDefault ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    Padrão
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {others.length > 0 ? (
        <fieldset className={styles.planGrid}>
          <legend>Outros do catálogo</legend>
          {others.map((plan) => (
            <label className={styles.planOption} key={plan.id}>
              <input
                id={checkboxId(plan.id)}
                type="checkbox"
                checked={false}
                onChange={() => toggleAccepted(plan.id)}
              />
              <span>{plan.name}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
