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
    <div
      className={clsx(styles.brand, inverse && styles.inverse)}
      aria-label="ClinicFlow"
    >
      <span className={styles.symbol} aria-hidden="true">
        <i />
        <i />
      </span>
      {!compact && <span>clinicflow</span>}
    </div>
  );
}
