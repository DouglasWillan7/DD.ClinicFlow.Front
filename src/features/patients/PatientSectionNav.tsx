import clsx from "clsx";
import { Link } from "../../app/navigation";
import styles from "./PatientSectionNav.module.css";

type PatientSection = "overview" | "assessments" | "exams";

export function PatientSectionNav({
  patientId,
  activeSection,
}: {
  patientId: string;
  activeSection: PatientSection;
}) {
  const sections: Array<{ key: PatientSection; label: string; to: string }> = [
    { key: "overview", label: "Visão geral", to: `/app/pacientes/${patientId}` },
    {
      key: "assessments",
      label: "Avaliações físicas",
      to: `/app/pacientes/${patientId}/avaliacoes`,
    },
    { key: "exams", label: "Exames", to: `/app/pacientes/${patientId}/exames` },
  ];

  return (
    <nav className={styles.scroller} aria-label="Seções do paciente">
      <div className={styles.links}>
        {sections.map((section) => {
          const active = section.key === activeSection;
          return (
            <Link
              key={section.key}
              to={section.to}
              className={clsx(styles.link, active && styles.active)}
              aria-current={active ? "page" : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
