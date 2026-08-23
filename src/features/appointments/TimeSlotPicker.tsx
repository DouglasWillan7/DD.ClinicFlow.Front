import { Check } from "lucide-react";
import type { AvailabilitySlot } from "../../api/types";
import styles from "./NewAppointmentPage.module.css";

export interface TimeSlotPickerProps {
  slots: AvailabilitySlot[];
  selectedStartUtc: string | null;
  onChange(slot: AvailabilitySlot): void;
  disabled: boolean;
}

export function TimeSlotPicker({
  slots,
  selectedStartUtc,
  onChange,
  disabled,
}: TimeSlotPickerProps) {
  return (
    <section className={styles.card} aria-labelledby="time-slot-title">
      <h2 id="time-slot-title" className={styles.cardTitle}>
        Horários disponíveis
      </h2>

      {slots.length ? (
        <>
          <div className={styles.slotGrid} aria-label="Horários disponíveis">
            {slots.map((slot) => {
              const selected = slot.startUtc === selectedStartUtc;
              return (
                <button
                  key={`${slot.startUtc}-${slot.endUtc}`}
                  type="button"
                  className={styles.chip}
                  aria-label={
                    selected ? `${slot.label}, selecionado` : slot.label
                  }
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onChange(slot)}
                >
                  {selected ? (
                    <Check
                      size={16}
                      className={styles.chipCheck}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{slot.label}</span>
                  {selected ? (
                    <span className={styles.srOnly}>Selecionado</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className={styles.slotNote}>
            Apenas horários livres na agenda do médico aparecem aqui.
          </p>
        </>
      ) : (
        <p className={styles.emptyMessage} role="status">
          {disabled
            ? "Selecione um médico e uma data disponível para ver os horários."
            : "Nenhum horário disponível para esta data."}
        </p>
      )}
    </section>
  );
}
