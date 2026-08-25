import { Building2, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AuthV2ClinicOption } from "../../api/types";
import { roleLabels } from "../../auth/roles";
import styles from "./ClinicContextSelector.module.css";

interface ClinicContextSelectorProps {
  clinics: readonly AuthV2ClinicOption[];
  activeUserClinicId?: string;
  busyUserClinicId?: string;
  focusFirstOnMount?: boolean;
  onSelect(userClinicId: string): void;
}

export function ClinicContextSelector({
  clinics,
  activeUserClinicId,
  busyUserClinicId,
  focusFirstOnMount = false,
  onSelect,
}: ClinicContextSelectorProps) {
  const firstSelectableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusFirstOnMount) firstSelectableRef.current?.focus();
  }, [focusFirstOnMount]);

  const firstSelectableId = clinics.find(
    (clinic) => clinic.userClinicId !== activeUserClinicId,
  )?.userClinicId;
  return (
    <div className={styles.list} aria-label="Contextos de clínica">
      {clinics.map((clinic) => {
        const isCurrent = clinic.userClinicId === activeUserClinicId;
        const isBusy = clinic.userClinicId === busyUserClinicId;
        const roleLabel = roleLabels[clinic.role];
        const contextLabel = [
          clinic.clinicName,
          roleLabel,
          clinic.isAdmin ? "Administração" : undefined,
          isCurrent ? "contexto atual" : undefined,
        ].filter(Boolean).join(", ");
        const receivesFocusRef = clinic.userClinicId === firstSelectableId;

        return (
          <button
            key={clinic.userClinicId}
            ref={receivesFocusRef ? firstSelectableRef : undefined}
            className={styles.option}
            type="button"
            aria-label={contextLabel}
            aria-current={isCurrent ? "true" : undefined}
            disabled={isCurrent || Boolean(busyUserClinicId)}
            onClick={() => onSelect(clinic.userClinicId)}
          >
            <span className={styles.icon} aria-hidden="true">
              <Building2 />
            </span>
            <span className={styles.copy}>
              <strong>{clinic.clinicName}</strong>
              <small>
                {roleLabel}{clinic.isAdmin ? " · Administração" : ""}
              </small>
            </span>
            <span className={styles.action} aria-hidden="true">
              {isBusy ? "Entrando…" : isCurrent ? <Check /> : "Acessar"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
