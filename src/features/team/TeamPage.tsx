import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { Clinic, Doctor, Invitation, Member } from "../../api/types";
import { Link, useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { getRoles, hasRole } from "../../auth/roles";
import {
  ErrorBlock,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { getDoctorInitials } from "./doctorRegistration";
import { StaffPanel } from "./StaffPanel";
import styles from "./TeamPage.module.css";
import { doctorsKey, getAccessLabel, getDoctorName } from "./teamQueries";

const teamKey = ["clinic", "team"] as const;

export function TeamPage() {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasRole(session, "Admin");
  // Fica na página: trocar as próprias funções limpa o cache e remonta os painéis.
  const [roleFeedback, setRoleFeedback] = useState<{
    message?: string;
    warning?: string;
  }>({});

  const query = useQuery({
    queryKey: teamKey,
    queryFn: async () => {
      const [clinic, members, invitations] = await Promise.all([
        request<Clinic>("/clinics/current"),
        request<Member[]>("/clinics/members"),
        request<Invitation[]>("/clinics/invitations"),
      ]);
      return { clinic, members, invitations };
    },
  });

  const doctors = useQuery({
    queryKey: doctorsKey,
    queryFn: () => request<Doctor[]>("/clinics/doctors"),
  });

  if (query.isLoading || doctors.isLoading) {
    return (
      <div className={styles.content}>
        <LoadingBlock label="Carregando a equipe…" />
      </div>
    );
  }

  if (query.isError || doctors.isError || !query.data) {
    return (
      <div className={styles.content}>
        <ErrorBlock
          message="Não foi possível carregar a equipe."
          retry={() => {
            void query.refetch();
            void doctors.refetch();
          }}
        />
      </div>
    );
  }

  const doctorList = doctors.data ?? [];
  const staff = query.data.members.filter(
    (member) => !getRoles(member).includes("Doctor"),
  );

  return (
    <div className={styles.content}>
      <div className={styles.contextRow}>
        <nav className={styles.breadcrumb} aria-label="Trilha">
          <strong aria-current="page">Equipe médica</strong>
        </nav>
        <span className={styles.counter}>
          {doctorList.length} {doctorList.length === 1 ? "médico" : "médicos"}
        </span>
        <div className={styles.contextSpacer} />
        {isAdmin ? (
          <Link className={styles.newDoctor} to="/app/equipe/novo">
            <Plus size={18} aria-hidden="true" />
            Novo médico
          </Link>
        ) : null}
      </div>

      <h1 className="srOnly">Equipe médica</h1>

      {roleFeedback.message ? (
        <SuccessNote>{roleFeedback.message}</SuccessNote>
      ) : null}
      {roleFeedback.warning ? (
        <p className={styles.inlineError} role="alert">
          {roleFeedback.warning}
        </p>
      ) : null}

      <section className={styles.panel} aria-labelledby="team-doctors">
        <h2 id="team-doctors">Médicos</h2>
        {doctorList.length === 0 ? (
          <p className={styles.empty}>
            Nenhum médico cadastrado. Cadastre o primeiro para liberar pacientes
            e agenda.
          </p>
        ) : (
          <ul className={styles.doctorList}>
            {doctorList.map((doctor) => (
              <li key={doctor.userId}>
                <button
                  type="button"
                  className={styles.doctorRow}
                  onClick={() => navigate(`/app/equipe/${doctor.userId}`)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {getDoctorInitials(doctor.name ?? "")}
                  </span>
                  <span className={styles.doctorIdentity}>
                    <strong>{getDoctorName(doctor)}</strong>
                    <small>
                      {[
                        doctor.specialty,
                        doctor.medicalLicense
                          ? `CRM ${doctor.medicalLicense}-${doctor.medicalLicenseState ?? ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Cadastro incompleto"}
                    </small>
                  </span>
                  <span
                    className={
                      doctor.hasAccess ? styles.accessOk : styles.accessPending
                    }
                  >
                    {getAccessLabel(doctor)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StaffPanel
        clinic={query.data.clinic}
        members={staff}
        invitations={query.data.invitations}
        canManage={isAdmin}
        onRolesSaved={setRoleFeedback}
      />
    </div>
  );
}
