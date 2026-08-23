import { ArrowLeft, FilePlus2, FileUp } from "lucide-react";
import type { Patient, PatientExamCapabilities } from "../../api/types";
import { Link, useNavigate } from "../../app/navigation";
import { getInitials } from "../appointments/appointmentLabels";
import { formatMedicalRecord, getAge } from "./patientFormatters";
import { PatientSectionNav } from "./PatientSectionNav";
import styles from "./PatientHeader.module.css";

type PatientSection = "overview" | "assessments" | "exams";

const sectionLabels: Record<PatientSection, string> = {
  overview: "Visão geral",
  assessments: "Avaliações físicas",
  exams: "Exames",
};

export function PatientHeader({
  patient,
  activeSection,
  capabilities,
}: {
  patient: Patient;
  activeSection: PatientSection;
  capabilities?: PatientExamCapabilities;
}) {
  const navigate = useNavigate();
  const age = getAge(patient.birthDate);
  const medicalRecord = formatMedicalRecord(patient.medicalRecordNumber);

  return (
    <header className={styles.header}>
      <div className={styles.contextRow}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/app/pacientes")}
          aria-label="Voltar para a lista de pacientes"
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
          <Link to="/app/pacientes">Pacientes</Link>
          <span aria-hidden="true">›</span>
          <Link to={`/app/pacientes/${patient.id}`}>{patient.name}</Link>
          <span aria-hidden="true">›</span>
          <strong aria-current="page">{sectionLabels[activeSection]}</strong>
        </nav>
      </div>

      <div className={styles.patientCard}>
        <div className={styles.identityRow}>
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(patient.name)}
          </span>

          <div className={styles.identityCopy}>
            <h1>{patient.name}</h1>
            <p>
              {age === null ? null : <span>{age} anos · </span>}
              Prontuário {medicalRecord}
            </p>
            {patient.isActive ? null : (
              <span className={styles.inactive}>Cadastro inativo</span>
            )}
          </div>

          {capabilities?.canRequest || capabilities?.canAttachDocument ? (
            <div className={styles.actions} aria-label="Ações do paciente">
              {capabilities.canRequest ? (
                <Link
                  className={styles.secondaryAction}
                  to={`/app/pacientes/${patient.id}/exames?acao=solicitar`}
                >
                  <FilePlus2 size={17} strokeWidth={1.8} aria-hidden="true" />
                  Solicitar exame
                </Link>
              ) : null}
              {capabilities.canAttachDocument ? (
                <Link
                  className={styles.primaryAction}
                  to={`/app/pacientes/${patient.id}/exames?acao=anexar`}
                >
                  <FileUp size={17} strokeWidth={1.8} aria-hidden="true" />
                  Anexar laudo
                </Link>
              ) : null}
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
