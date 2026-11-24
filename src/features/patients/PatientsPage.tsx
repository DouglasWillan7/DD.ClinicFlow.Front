import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronRight,
  CircleOff,
  Plus,
  Search,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Clinic, PatientListItem } from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { Button } from "../../components/Button";
import { ContextBar } from "../../components/ContextBar";
import { EmptyState, ErrorBlock } from "../../components/Feedback";
import { FilterChips } from "../../components/FilterChips";
import { StatusBadge, type StatusTone } from "../../components/StatusBadge";
import { getInitials } from "../appointments/appointmentLabels";
import { getAge } from "./patientFormatters";
import {
  countBySituation,
  filterPatients,
  situationFilters,
  situationLabels,
  type SituationFilter,
} from "./patientsList";
import styles from "./PatientsPage.module.css";

// Estado sempre com rótulo, ícone e cor.
const situationBadge: Record<
  PatientListItem["situation"],
  { tone: StatusTone; icon: LucideIcon }
> = {
  EmAcompanhamento: { tone: "info", icon: Stethoscope },
  NovoPaciente: { tone: "success", icon: UserRoundPlus },
  Inativo: { tone: "neutral", icon: CircleOff },
};

export function PatientsPage() {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Filtro desta lista, não a busca global da topbar (que navega para a ficha).
  // A URL continua sendo a fonte única do termo, então o link é compartilhável.
  const search = params.get("search") ?? "";
  const [filter, setFilter] = useState<SituationFilter>("todos");
  const canReadClinicalRecord = can(session, "ReadClinicalRecord");

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
          <span className="srOnly">Filtrar pacientes</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Filtrar por nome ou telefone…"
          />
        </label>
      </form>

      <ContextBar
        currentAs="h1"
        crumbs={[{ label: "Pacientes" }, { label: "Todos os pacientes" }]}
        counter={query.isSuccess ? `${rows.length} de ${patients.length}` : "…"}
        action={
          <Button
            type="button"
            shape="pill"
            onClick={() => navigate("/app/pacientes/novo")}
          >
            <Plus size={16} aria-hidden="true" />
            Novo paciente
          </Button>
        }
      >
        <FilterChips<SituationFilter>
          label="Filtrar por situação"
          value={filter}
          onChange={setFilter}
          options={situationFilters.map(({ value, label }) => ({
            value,
            label: value === "todos" ? label : `${label} · ${counts[value]}`,
          }))}
        />
      </ContextBar>

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
                    onClick={() =>
                      navigate(
                        `/app/pacientes/${patient.id}${canReadClinicalRecord ? "" : "/editar"}`,
                      )
                    }
                    aria-label={`${canReadClinicalRecord ? "Abrir detalhes" : "Editar dados"} de ${patient.name}`}
                  >
                    <span className={styles.identity}>
                      <span className={styles.avatar} aria-hidden="true">
                        {getInitials(patient.name)}
                      </span>
                      <span className={styles.identityCopy}>
                        <span className={styles.name}>{patient.name}</span>
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
                      <StatusBadge
                        tone={situationBadge[patient.situation].tone}
                        icon={situationBadge[patient.situation].icon}
                      >
                        {situationLabels[patient.situation]}
                      </StatusBadge>
                    </span>
                    <ChevronRight
                      className={styles.chevron}
                      size={14}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.empty}>
            <EmptyState
              icon={UsersRound}
              title={
                patients.length === 0
                  ? "A lista de pacientes começa aqui"
                  : search.trim()
                    ? "Nenhum resultado"
                    : "Nenhum paciente nesta situação"
              }
              description={
                patients.length === 0
                  ? "Cadastre a primeira pessoa atendida."
                  : search.trim()
                    ? `Nenhum paciente encontrado para “${search.trim()}”.`
                    : "Escolha outro filtro ou cadastre um novo paciente."
              }
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/app/pacientes/novo")}
                >
                  + Cadastrar novo paciente
                </Button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
