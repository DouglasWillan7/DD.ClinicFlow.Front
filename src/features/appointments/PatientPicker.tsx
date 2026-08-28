import { UserRound } from "lucide-react";
import type { PatientDemographic } from "../../api/types";
import { getAge } from "../patients/patientFormatters";
import { getInitials } from "./appointmentLabels";
import styles from "./NewAppointmentPage.module.css";

export interface PatientPickerProps {
  patient: PatientDemographic | null;
  onOpen(): void;
}

export function PatientPicker({ patient, onOpen }: PatientPickerProps) {
  const age = patient ? getAge(patient.birthDate) : null;
  const details = patient
    ? [
        age === null ? null : `${age} anos`,
        patient.phone.trim() || null,
      ].filter(Boolean)
    : [];

  return (
    <section className={styles.card} aria-labelledby="patient-picker-title">
      <h2 id="patient-picker-title" className={styles.cardTitle}>
        Paciente
      </h2>

      <div className={styles.patientRow}>
        <span className={styles.patientAvatar} aria-hidden="true">
          {patient ? (
            getInitials(patient.name)
          ) : (
            <UserRound size={26} strokeWidth={1.7} />
          )}
        </span>

        <span className={styles.patientIdentity}>
          {patient ? (
            <>
              <span className={styles.patientName}>{patient.name}</span>
              <span className={styles.patientMeta}>{details.join(" · ")}</span>
            </>
          ) : (
            <>
              <span className={styles.patientName}>Quem será atendido?</span>
              <span className={styles.patientMeta}>
                Selecione um paciente cadastrado para começar o agendamento.
              </span>
            </>
          )}
        </span>

        <button type="button" className={styles.chip} onClick={onOpen}>
          {patient ? "Trocar paciente" : "Selecionar paciente"}
        </button>
      </div>
    </section>
  );
}
