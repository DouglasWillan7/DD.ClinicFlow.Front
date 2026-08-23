import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronRight, Plus, Search, Video } from "lucide-react";
import { useMemo, useState } from "react";
import type { Clinic, PatientListItem } from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock } from "../../components/Feedback";
import { getInitials } from "../appointments/appointmentLabels";
import { formatCpf, formatMedicalRecord, getAge } from "./patientFormatters";
import {
  countBySituation,
  filterPatients,
  situationFilters,
  situationLabels,
  type SituationFilter,
} from "./patientsList";
import styles from "./PatientsPage.module.css";

const situationBadgeClass: Record<PatientListItem["situation"], string> = {
  EmAcompanhamento: styles.badgeFollowUp,
  NovoPaciente: styles.badgeNew,
  ExamePendente: styles.badgePendingExam,
  Inativo: styles.badgeInactive,
};

export function PatientsPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Filtro desta lista, não a busca global da topbar (que navega para a ficha).
  // A URL continua sendo a fonte única do termo, então o link é compartilhável.
  const search = params.get("search") ?? "";
  const [filter, setFilter] = useState<SituationFilter>("todos");

  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const timeZone = clinic.data?.timeZoneId ?? "America/Sao_Paulo";

  const query = useQuery({
    queryKey: ["patients", "list"],
    queryFn: () =>
      request<PatientListItem[]>("/patients?includeInactive=true"),
  });

  const patients = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => countBySituation(patients), [patients]);
  const rows = useMemo(
    () => filterPatients(patients, filter, search),
    [patients, filter, search],
  );

  function updateSearch(value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("search", value);
        else next.delete("search");
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className={styles.content}>
      <form
        className={styles.pageSearch}
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label>
          <span className={styles.srOnly}>Filtrar pacientes</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Filtrar por nome, CPF, prontuário ou telefone…"
          />
        </label>
      </form>

      <div className={styles.contextRow}>
        <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
          <span>Pacientes</span>
          <span aria-hidden="true">›</span>
          <strong>Todos os pacientes</strong>
        </nav>
        <span className={styles.counter} aria-live="polite">
          {query.isSuccess ? `${rows.length} de ${patients.length}` : "…"}
        </span>
        <span className={styles.contextSpacer} />
        <div
          className={styles.filters}
          role="group"
          aria-label="Filtrar por situação"
        >
          {situationFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={styles.filterChip}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "todos" ? label : `${label} · ${counts[value]}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.newPatient}
          onClick={() => navigate("/app/pacientes/novo")}
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          Novo paciente
        </button>
      </div>

      <section className={styles.listCard} aria-label="Lista de pacientes">
        <div className={styles.columns} aria-hidden="true">
          <span>Paciente</span>
          <span>Idade</span>
          <span>Telefone</span>
          <span>Última</span>
          <span>Próxima</span>
          <span>Situação</span>
          <span />
        </div>

        {query.isLoading ? (
          <div role="status" aria-label="Carregando pacientes">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={styles.skeletonRow}>
                <span className={styles.skeletonAvatar} />
                <span className={styles.skeletonLine} />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div className={styles.errorWrap}>
            <ErrorBlock
              message="Não foi possível carregar os pacientes."
              retry={() => void query.refetch()}
            />
          </div>
        ) : rows.length > 0 ? (
          <ul className={styles.rows}>
            {rows.map((patient) => {
              const age = getAge(patient.birthDate);
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => navigate(`/app/pacientes/${patient.id}`)}
                    aria-label={`Abrir detalhes de ${patient.name}`}
                  >
                    <span className={styles.identity}>
                      <span className={styles.avatar} aria-hidden="true">
                        {getInitials(patient.name)}
                      </span>
                      <span className={styles.identityCopy}>
                        <span className={styles.name}>{patient.name}</span>
                        <span className={styles.record}>
                          {`Pront. ${formatMedicalRecord(patient.medicalRecordNumber)} · CPF ${formatCpf(patient.cpf)}`}
                        </span>
                      </span>
                    </span>
                    <span className={styles.cell} data-label="Idade">
                      {age === null ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        `${age} anos`
                      )}
                    </span>
                    <span className={styles.cell} data-label="Telefone">
                      {patient.phone}
                    </span>
                    <span className={styles.cell} data-label="Última">
                      {patient.lastAppointmentUtc ? (
                        formatInTimeZone(
                          patient.lastAppointmentUtc,
                          timeZone,
                          "dd/MM/yyyy",
                        )
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </span>
                    <span
                      className={`${styles.cell} ${styles.next}`}
                      data-label="Próxima"
                    >
                      {patient.nextAppointmentUtc ? (
                        <>
                          {patient.nextAppointmentType ===
                          "Teleconsultation" ? (
                            <Video size={15} aria-label="Teleconsulta" />
                          ) : null}
                          {formatInTimeZone(
                            patient.nextAppointmentUtc,
                            timeZone,
                            "dd/MM · HH:mm",
                          )}
                        </>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </span>
                    <span className={styles.cell}>
                      <span
                        className={`${styles.badge} ${situationBadgeClass[patient.situation]}`}
                      >
                        {situationLabels[patient.situation]}
                      </span>
                    </span>
                    <ChevronRight
                      className={styles.chevron}
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p>
              {patients.length === 0
                ? "A lista de pacientes começa aqui: cadastre a primeira pessoa atendida."
                : search.trim()
                  ? `Nenhum paciente encontrado para “${search.trim()}”.`
                  : "Nenhum paciente nesta situação."}
            </p>
            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => navigate("/app/pacientes/novo")}
            >
              + Cadastrar novo paciente
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
