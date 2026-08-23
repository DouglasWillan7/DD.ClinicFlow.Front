import clsx from "clsx";
import styles from "./BrandMark.module.css";

export function BrandMark({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <span
      className={clsx(
        styles.brand,
        compact ? styles.compact : styles.full,
        inverse && styles.inverse,
      )}
      role="img"
      aria-label="ClinicFlow"
    >
      <img
        src={compact ? "/clinicflow-icon.png" : "/clinicflow-logo.png"}
        alt=""
        draggable={false}
      />
    </span>
  );
}
