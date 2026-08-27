import { LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "../../components/Button";
import { ClinicalAccessEmailAction } from "../patient-actions/ClinicalAccessEmailAction";
import styles from "./ClinicalAccessNotice.module.css";

export function ClinicalAccessNotice({
  patientId,
  onRetry,
}: {
  patientId: string;
  onRetry?: () => void;
}) {
  return (
    <section
      className={styles.notice}
      role="status"
      aria-labelledby="clinical-access-title"
    >
      <span className={styles.icon} aria-hidden="true">
        <LockKeyhole size={22} strokeWidth={1.8} />
      </span>

      <div className={styles.copy}>
        <h2 id="clinical-access-title">Acesso clínico pendente</h2>
        <p>
          Os dados clínicos ficam disponíveis para o médico quando o paciente
          concluir a autorização. O cadastro e a agenda continuam visíveis.
        </p>
      </div>

      <div className={styles.controls}>
        <ClinicalAccessEmailAction patientId={patientId} />
        {onRetry ? (
          <Button type="button" variant="ghost" onClick={onRetry}>
            <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
            Verificar novamente
          </Button>
        ) : null}
      </div>
    </section>
  );
}
