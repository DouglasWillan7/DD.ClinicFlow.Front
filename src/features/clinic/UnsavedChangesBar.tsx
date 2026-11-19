import { Button } from "../../components/Button";
import styles from "./HealthcarePlansSettingsPage.module.css";

export function UnsavedChangesBar({
  saving,
  error,
  saveLabel = "Salvar convênios",
  onDiscard,
  onSave,
}: {
  saving: boolean;
  error: string | null;
  /** Rótulo da ação de salvar; cada aba nomeia o que salva. */
  saveLabel?: string;
  onDiscard(): void;
  onSave(): void;
}) {
  return (
    <div className={styles.unsavedBar} role="region" aria-label="Alterações não salvas">
      <span className={styles.unsavedLabel}>
        <span className={styles.unsavedDot} aria-hidden="true" />
        Alterações não salvas
      </span>
      {error ? (
        <span className={styles.unsavedError} role="alert">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        className={styles.discardButton}
        onClick={onDiscard}
        disabled={saving}
      >
        Descartar
      </button>
      <Button type="button" loading={saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
