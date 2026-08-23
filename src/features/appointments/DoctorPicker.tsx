import { Check, Search } from "lucide-react";
import type { Member } from "../../api/types";
import { filterDoctors, getInitials } from "./appointmentLabels";
import styles from "./NewAppointmentPage.module.css";

export interface DoctorPickerProps {
  members: Member[];
  doctorId: string | null;
  search: string;
  onDoctorChange(doctor: Member): void;
  onSearchChange(search: string): void;
}

/** A busca cobre nome e especialidade; agendar não passa por filtro de especialidade. */
export function DoctorPicker({
  members,
  doctorId,
  search,
  onDoctorChange,
  onSearchChange,
}: DoctorPickerProps) {
  const doctors = filterDoctors(members, search);

  return (
    <section
      className={styles.card}
      role="group"
      aria-labelledby="doctor-picker-title"
    >
      <h2 id="doctor-picker-title" className={styles.cardTitle}>
        Médico
      </h2>

      <label className={`${styles.searchPill} ${styles.doctorSearch}`}>
        <span className={styles.srOnly}>Buscar médico</span>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          placeholder="Buscar médico ou especialidade..."
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </label>

      {doctors.length ? (
        <div className={styles.doctorList} aria-label="Médicos disponíveis">
          {doctors.map((doctor) => {
            const selected = doctor.userId === doctorId;
            const name = doctor.name?.trim() || doctor.email;
            return (
              <button
                key={doctor.userId}
                type="button"
                className={styles.doctorRow}
                aria-label={selected ? `${name}, selecionada` : name}
                aria-pressed={selected}
                onClick={() => onDoctorChange(doctor)}
              >
                <span className={styles.doctorAvatar} aria-hidden="true">
                  {getInitials(name)}
                </span>
                <span className={styles.doctorIdentity}>
                  <span className={styles.doctorName}>{name}</span>
                  <span className={styles.doctorSpecialty}>
                    {doctor.specialty?.trim() || "Sem especialidade"}
                  </span>
                </span>
                {selected ? (
                  <>
                    <Check
                      size={16}
                      className={styles.rowCheck}
                      aria-hidden="true"
                    />
                    <span className={styles.srOnly}>Selecionada</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyMessage} role="status">
          Nenhum médico encontrado para estes filtros.
        </p>
      )}
    </section>
  );
}
