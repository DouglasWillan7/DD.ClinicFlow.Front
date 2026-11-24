import { CircleOff, FileUp } from "lucide-react";
import type {
  PatientDemographic,
  PatientExamCapabilities,
} from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { ButtonLink } from "../../components/ButtonLink";
import { ContextBar } from "../../components/ContextBar";
import { StatusBadge } from "../../components/StatusBadge";
import { getInitials } from "../appointments/appointmentLabels";
import { getAge } from "./patientFormatters";
import { PatientSectionNav } from "./PatientSectionNav";
import styles from "./PatientHeader.module.css";

type PatientSection = "overview" | "assessments" | "exams" | "prescriptions";

const sectionLabels: Record<PatientSection, string> = {
  overview: "Visão geral",
  assessments: "Avaliações físicas",
  exams: "Exames",
  prescriptions: "Receitas",
};

export function PatientHeader({
  patient,
  activeSection,
  capabilities,
}: {
  patient: PatientDemographic;
  activeSection: PatientSection;
  capabilities?: PatientExamCapabilities;
}) {
  const navigate = useNavigate();
  const age = getAge(patient.birthDate);
  const metadata = [
    age === null ? null : `${age} anos`,
    patient.phone.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className={styles.header}>
      {/* O h1 da tela é o nome do paciente, no cartão abaixo. */}
      <ContextBar
        back={{
          label: "Voltar para a lista de pacientes",
          onClick: () => navigate("/app/pacientes"),
        }}
        crumbs={[
          { label: "Pacientes", to: "/app/pacientes" },
          { label: patient.name, to: `/app/pacientes/${patient.id}`, truncate: true },
          { label: sectionLabels[activeSection] },
        ]}
      />

      <div className={styles.patientCard}>
        <div className={styles.identityRow}>
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(patient.name)}
          </span>

          <div className={styles.identityCopy}>
            <h1>{patient.name}</h1>
            {metadata ? <p>{metadata}</p> : null}
            {patient.isActive ? null : (
              <StatusBadge tone="neutral" icon={CircleOff} className={styles.inactive}>
                Cadastro inativo
              </StatusBadge>
            )}
          </div>

          {capabilities?.canAttachDocument ? (
            <div className={styles.actions} aria-label="Ações do paciente">
              <ButtonLink to={`/app/pacientes/${patient.id}/exames?acao=anexar`}>
                <FileUp size={17} aria-hidden="true" />
                Anexar laudo
              </ButtonLink>
            </div>
          ) : null}
        </div>

        <div className={styles.navigation}>
          <PatientSectionNav
            patientId={patient.id}
            activeSection={activeSection}
          />
        </div>
      </div>
    </header>
  );
}
