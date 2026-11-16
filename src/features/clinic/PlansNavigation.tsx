import { AlertTriangle, Building2, Star } from "lucide-react";
import { SelectField } from "../../components/Field";
import { getInitials } from "../appointments/appointmentLabels";
import { CLINIC_ITEM } from "./healthcarePlansDraft";
import styles from "./HealthcarePlansSettingsPage.module.css";

export type DoctorStatus =
  | { kind: "default" }
  | { kind: "custom"; label: string }
  | { kind: "privateOnly" }
  | { kind: "unsaved"; label: string };

export interface DoctorNavItem {
  userClinicId: string;
  displayName: string;
  status: DoctorStatus;
}

function statusText(status: DoctorStatus) {
  if (status.kind === "default") return "Padrão da clínica";
  if (status.kind === "privateOnly") return "Só particular";
  return status.label;
}

function StatusLine({ status }: { status: DoctorStatus }) {
  if (status.kind === "privateOnly") {
    return (
      <span className={styles.alertTag}>
        <AlertTriangle size={13} aria-hidden="true" />
        Só particular
      </span>
    );
  }
  return (
    <span className={styles.navStatus}>
      {status.kind === "default" ? (
        <Star size={12} fill="currentColor" aria-hidden="true" />
      ) : null}
      {statusText(status)}
    </span>
  );
}

/**
 * Lista "Clínica + médicos". Em telas estreitas a mesma escolha vira um seletor no topo;
 * as duas formas ficam no DOM e o CSS mostra uma só.
 */
export function PlansNavigation({
  selectedItem,
  clinicSummary,
  clinicDirty,
  doctors,
  onSelect,
}: {
  selectedItem: string;
  clinicSummary: string;
  clinicDirty: boolean;
  doctors: DoctorNavItem[];
  onSelect(item: string): void;
}) {
  return (
    <>
      <div className={styles.navSelect}>
        <SelectField
          id="healthcare-plans-item"
          label="Configurar convênios de"
          value={selectedItem}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value={CLINIC_ITEM}>
            Clínica · {clinicSummary}
            {clinicDirty ? " · não salvo" : ""}
          </option>
          {doctors.map((doctor) => (
            <option key={doctor.userClinicId} value={doctor.userClinicId}>
              {doctor.displayName} · {statusText(doctor.status)}
            </option>
          ))}
        </SelectField>
      </div>

      <nav className={styles.nav} aria-label="Clínica e médicos">
        <button
          type="button"
          className={styles.navItem}
          aria-current={selectedItem === CLINIC_ITEM ? "true" : undefined}
          onClick={() => onSelect(CLINIC_ITEM)}
        >
          <span className={styles.navIcon} aria-hidden="true">
            <Building2 size={18} />
          </span>
          <span className={styles.navText}>
            <strong>Clínica</strong>
            <span className={styles.navStatus}>{clinicSummary}</span>
          </span>
          {clinicDirty ? <UnsavedDot /> : null}
        </button>

        <h2 className={styles.navHeading}>Médicos</h2>
        {doctors.length === 0 ? (
          <p className={styles.hint}>Nenhum médico ativo nesta clínica ainda.</p>
        ) : (
          <ul className={styles.navList}>
            {doctors.map((doctor) => (
              <li key={doctor.userClinicId}>
                <button
                  type="button"
                  className={styles.navItem}
                  aria-current={
                    selectedItem === doctor.userClinicId ? "true" : undefined
                  }
                  onClick={() => onSelect(doctor.userClinicId)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {getInitials(doctor.displayName)}
                  </span>
                  <span className={styles.navText}>
                    <strong>{doctor.displayName}</strong>
                    <StatusLine status={doctor.status} />
                  </span>
                  {doctor.status.kind === "unsaved" ? <UnsavedDot /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}

function UnsavedDot() {
  return (
    <span className={styles.unsavedDot}>
      <span className="srOnly">Alterações não salvas</span>
    </span>
  );
}
