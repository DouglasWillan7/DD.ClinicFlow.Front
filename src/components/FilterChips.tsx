import type { ReactNode } from "react";
import styles from "./FilterChips.module.css";

/** Filtro de escolha única em chips; o estado ativo usa `aria-pressed`. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Nome acessível do grupo, por exemplo "Filtrar por situação". */
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
