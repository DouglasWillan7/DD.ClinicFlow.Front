import { Check } from "lucide-react";
import type { HealthcarePlan } from "../../api/types";
import styles from "./NewAppointmentPage.module.css";

export function HealthcarePlanPicker({
  plans,
  selectedId,
  onChange,
}: {
  plans: HealthcarePlan[];
  selectedId: string | null;
  onChange(healthcarePlanId: string | null): void;
}) {
  const options: Array<HealthcarePlan | null> = [null, ...plans];

  return (
    <section className={styles.card} aria-labelledby="healthcare-plan-title">
      <h2 id="healthcare-plan-title" className={styles.cardTitle}>
        Plano de saúde
      </h2>
      <div className={styles.chipList}>
        {options.map((plan) => {
          const id = plan?.id ?? null;
          const label = plan?.name ?? "Particular";
          const selected = selectedId === id;
          return (
            <button
              key={id ?? "private"}
              type="button"
              className={styles.chip}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onChange(id)}
            >
              {selected ? (
                <Check
                  size={16}
                  className={styles.chipCheck}
                  aria-hidden="true"
                />
              ) : null}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
