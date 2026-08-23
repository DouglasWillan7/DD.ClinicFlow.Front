import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  addDays,
  differenceInMinutes,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  Stethoscope,
  UserRoundPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Appointment, Clinic } from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import {
  ErrorBlock,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import {
  appointmentTypeLabels,
  getInitials,
  parseDateOnly,
} from "../appointments/appointmentLabels";
import { appointmentStatusLabels } from "../appointments/appointmentStatus";
import { StatusBadge } from "../appointments/StatusBadge";
import styles from "./DoctorHomePage.module.css";

function greetingFor(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function shortName(name: string | null, email: string) {
  const words = (name?.trim() || email.split("@")[0]).split(/\s+/);
  const honorific = /^(dr|dra)\.?$/i.test(words[0]);
  return honorific ? words.slice(0, 2).join(" ") : words[0];
}

function isTerminal(appointment: Appointment) {
  return ["Cancelada", "Realizada", "NoShow"].includes(appointment.status);
}

function isAppointmentActive(appointment: Appointment, now: Date) {
  const start = Date.parse(appointment.startUtc);
  const end = Date.parse(appointment.endUtc);
  const timestamp = now.getTime();
  return (
    appointment.status === "Confirmada" &&
    timestamp >= start &&
    timestamp < end
  );
}

function appointmentDuration(appointment: Appointment) {
  return Math.max(
    0,
    differenceInMinutes(
      new Date(appointment.endUtc),
      new Date(appointment.startUtc),
    ),
  );
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function DoctorHomePage() {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showCreated, setShowCreated] = useState(
    () => params.get("created") === "true",
  );
  const now = new Date();
  const requestedDay = params.get("date");
  const initialDay =
    requestedDay && parseDateOnly(requestedDay)
      ? requestedDay
      : format(now, "yyyy-MM-dd");
  const [day, setDay] = useState(initialDay);

  const clinic = useQuery({
    queryKey: ["doctor-home", "clinic"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });

  const timeZone = clinic.data?.timeZoneId ?? "America/Sao_Paulo";
  const selectedDate = parseISO(day);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const weekKey = format(weekStart, "yyyy-MM-dd");
  const weekFrom = fromZonedTime(`${weekKey}T00:00:00`, timeZone);
  const weekTo = fromZonedTime(
    `${format(weekEnd, "yyyy-MM-dd")}T00:00:00`,
    timeZone,
  );

  const appointments = useQuery({
    queryKey: [
      "doctor-home",
      "appointments",
      session?.userId,
      weekKey,
      timeZone,
    ],
    enabled: Boolean(clinic.data && session?.userId),
    queryFn: () =>
      request<Appointment[]>(
        `/appointments?from=${encodeURIComponent(weekFrom.toISOString())}&to=${encodeURIComponent(weekTo.toISOString())}&doctorId=${encodeURIComponent(session!.userId)}`,
      ),
  });

  useEffect(() => {
    if (!showCreated) return;
    const timeout = window.setTimeout(() => {
      setShowCreated(false);
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("created");
          return next;
        },
        { replace: true },
      );
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [setParams, showCreated]);

  const weekAppointments = useMemo(
    () =>
      [...(appointments.data ?? [])].sort(
        (first, second) =>
          Date.parse(first.startUtc) - Date.parse(second.startUtc),
      ),
    [appointments.data],
  );
  const dayAppointments = weekAppointments.filter(
    (appointment) =>
      formatInTimeZone(appointment.startUtc, timeZone, "yyyy-MM-dd") === day &&
      appointment.status !== "Cancelada",
  );
  const activeAppointment = dayAppointments.find((appointment) =>
    isAppointmentActive(appointment, now),
  );
  const focusAppointment =
    activeAppointment ??
    dayAppointments.find(
      (appointment) =>
        !isTerminal(appointment) && Date.parse(appointment.endUtc) > now.getTime(),
    ) ??
    dayAppointments.find((appointment) => !isTerminal(appointment)) ??
    null;
  const nextAppointment = focusAppointment
    ? dayAppointments.find(
        (appointment) =>
          appointment.id !== focusAppointment.id &&
          !isTerminal(appointment) &&
          Date.parse(appointment.startUtc) > Date.parse(focusAppointment.startUtc),
      ) ?? null
    : null;
  const pendingConfirmations = weekAppointments.filter((appointment) =>
    ["Agendada", "ConfirmacaoEnviada"].includes(appointment.status),
  );
  const realized = weekAppointments.filter(
    (appointment) => appointment.status === "Realizada",
  ).length;
  const confirmed = weekAppointments.filter(
    (appointment) => appointment.status === "Confirmada",
  ).length;
  const noShows = weekAppointments.filter(
    (appointment) => appointment.status === "NoShow",
  ).length;
  const dayRealized = dayAppointments.filter(
    (appointment) => appointment.status === "Realizada",
  ).length;
  const dayAwaiting = dayAppointments.filter((appointment) =>
    ["Agendada", "ConfirmacaoEnviada"].includes(appointment.status),
  ).length;

  function changeDay(nextDay: string) {
    setDay(nextDay);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("date", nextDay);
        next.delete("appointmentId");
        next.delete("created");
        return next;
      },
      { replace: true },
    );
  }

  function openNewAppointment() {
    const booking = new URLSearchParams({ date: day });
    if (session?.userId) booking.set("doctorId", session.userId);
    booking.set("origin", "home");
    navigate(`/app/agenda/nova?${booking.toString()}`);
  }

  if (clinic.isLoading) {
    return <LoadingBlock label="Preparando seu dia…" />;
  }

  if (clinic.isError || !clinic.data) {
    return (
      <ErrorBlock
        message="Não foi possível carregar o contexto da clínica."
        retry={() => void clinic.refetch()}
      />
    );
  }

  const today = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const greeting = greetingFor(
    Number(formatInTimeZone(now, timeZone, "H")),
  );
  const displayName = shortName(session?.name ?? null, session?.email ?? "");
  const selectedDayLabel = format(selectedDate, "d 'de' MMMM", {
    locale: ptBR,
  });
  const contextLabel = [clinic.data.name, clinic.data.address]
    .filter(Boolean)
    .join(" · ");
  const summary = [
    pluralize(dayAppointments.length, "consulta", "consultas"),
    `${dayRealized} ${dayRealized === 1 ? "realizada" : "realizadas"}`,
    `${dayAwaiting} aguardando confirmação`,
  ].join(" · ");

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{greeting}, {displayName}</h1>
          <p>{selectedDayLabel} · {contextLabel}</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/app/pacientes/novo")}
          >
            <UserRoundPlus size={17} aria-hidden="true" />
            Novo paciente
          </Button>
          <Button type="button" onClick={openNewAppointment}>
            <Plus size={17} aria-hidden="true" />
            Nova consulta
          </Button>
        </div>
      </header>

      {showCreated ? (
        <SuccessNote>Consulta agendada com sucesso.</SuccessNote>
      ) : null}

      <div className={styles.dashboardGrid}>
        <section className={styles.agendaPanel} aria-labelledby="home-agenda-title">
          <header className={styles.panelHeader}>
            <div>
              <h2 id="home-agenda-title">Agenda do dia</h2>
              <p>{summary}</p>
            </div>
            <div className={styles.dateActions} aria-label="Navegar pelos dias">
              <button
                type="button"
                aria-label="Dia anterior"
                onClick={() => changeDay(format(addDays(selectedDate, -1), "yyyy-MM-dd"))}
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={clsx(styles.todayButton, day === today && styles.todayActive)}
                onClick={() => changeDay(today)}
                aria-pressed={day === today}
              >
                Hoje
              </button>
              <button
                type="button"
                aria-label="Próximo dia"
                onClick={() => changeDay(format(addDays(selectedDate, 1), "yyyy-MM-dd"))}
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.openAgenda}
                onClick={() =>
                  navigate(`/app/agenda?date=${day}&doctorId=${session?.userId ?? ""}`)
                }
              >
                Abrir agenda
              </button>
            </div>
          </header>

          {appointments.isLoading ? (
            <div className={styles.agendaFeedback}>
              <LoadingBlock label="Organizando suas consultas…" />
            </div>
          ) : appointments.isError ? (
            <div className={styles.agendaFeedback}>
              <ErrorBlock
                message="Não foi possível carregar suas consultas."
                retry={() => void appointments.refetch()}
              />
            </div>
          ) : dayAppointments.length === 0 ? (
            <div className={styles.emptyAgenda}>
              <CalendarDays size={24} aria-hidden="true" />
              <strong>Nenhuma consulta neste dia</strong>
              <p>Escolha outra data ou abra sua agenda para ver os horários disponíveis.</p>
              <Button type="button" variant="secondary" onClick={openNewAppointment}>
                Agendar consulta
              </Button>
            </div>
          ) : (
            <ol className={styles.appointmentList} aria-label="Consultas do dia">
              {dayAppointments.map((appointment) => {
                const active = appointment.id === activeAppointment?.id;
                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      className={clsx(styles.appointmentRow, active && styles.activeRow)}
                      onClick={() => navigate(`/app/pacientes/${appointment.patientId}`)}
                      aria-label={`${formatInTimeZone(appointment.startUtc, timeZone, "HH:mm")}, ${appointment.patientName}, ${active ? "em atendimento" : appointmentStatusLabels[appointment.status]}`}
                    >
                      <span className={styles.appointmentTime}>
                        <strong>{formatInTimeZone(appointment.startUtc, timeZone, "HH:mm")}</strong>
                        <small>{appointmentDuration(appointment)} min</small>
                      </span>
                      <span className={styles.patientAvatar} aria-hidden="true">
                        {getInitials(appointment.patientName)}
                      </span>
                      <span className={styles.appointmentCopy}>
                        <strong>{appointment.patientName}</strong>
                        <small>{appointment.notes || appointmentTypeLabels[appointment.type]}</small>
                      </span>
                      <span className={styles.appointmentType}>
                        {appointmentTypeLabels[appointment.type]}
                      </span>
                      {active ? (
                        <span className={styles.activeBadge}>
                          <Stethoscope size={13} aria-hidden="true" />
                          Em atendimento
                        </span>
                      ) : (
                        <StatusBadge status={appointment.status} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className={styles.insights} aria-label="Resumo operacional">
          <section className={styles.focusCard} aria-labelledby="focus-title">
            {focusAppointment ? (
              <>
                <p className={styles.focusEyebrow}>
                  <span aria-hidden="true" />
                  {activeAppointment ? "Em atendimento" : "Próxima consulta"} ·{" "}
                  {formatInTimeZone(focusAppointment.startUtc, timeZone, "HH:mm")}
                  {activeAppointment
                    ? ` · há ${Math.max(0, differenceInMinutes(now, new Date(focusAppointment.startUtc)))} min`
                    : ""}
                </p>
                <h2 id="focus-title">{focusAppointment.patientName}</h2>
                <p className={styles.focusMeta}>
                  {appointmentTypeLabels[focusAppointment.type]} · {appointmentDuration(focusAppointment)} min
                </p>
                <p className={styles.focusNotes}>
                  {focusAppointment.notes || "Consulta sem observações registradas."}
                </p>
                <div className={styles.focusActions}>
                  <button
                    type="button"
                    className={styles.focusPrimary}
                    onClick={() => navigate(`/app/pacientes/${focusAppointment.patientId}`)}
                  >
                    Abrir consulta
                  </button>
                  <button
                    type="button"
                    className={styles.focusSecondary}
                    onClick={() => navigate(`/app/consultas/${focusAppointment.id}`)}
                  >
                    Transcrever
                  </button>
                </div>
                {nextAppointment ? (
                  <p className={styles.nextPatient}>
                    <span aria-hidden="true">{getInitials(nextAppointment.patientName)}</span>
                    A seguir · {formatInTimeZone(nextAppointment.startUtc, timeZone, "HH:mm")} <strong>{nextAppointment.patientName}</strong>
                  </p>
                ) : null}
              </>
            ) : (
              <div className={styles.focusEmpty}>
                <ClipboardList size={24} aria-hidden="true" />
                <h2 id="focus-title">Dia organizado</h2>
                <p>Não há outra consulta aguardando atendimento nesta data.</p>
              </div>
            )}
          </section>

          <section className={styles.pendingPanel} aria-labelledby="pending-title">
            <header className={styles.sidePanelHeader}>
              <h2 id="pending-title">Pendências</h2>
              <span>{pendingConfirmations.length}</span>
            </header>
            <p className={styles.pendingKind}>
              Confirmações {pendingConfirmations.length}
            </p>
            {pendingConfirmations.length ? (
              <ul className={styles.pendingList}>
                {pendingConfirmations.slice(0, 4).map((appointment) => (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/app/pacientes/${appointment.patientId}`)}
                    >
                      <span>
                        <strong>{appointment.patientName}</strong>
                        <small>
                          {formatInTimeZone(appointment.startUtc, timeZone, "EEEE, HH:mm", { locale: ptBR })}
                        </small>
                      </span>
                      <StatusBadge status={appointment.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.sideEmpty}>Nenhuma confirmação pendente nesta semana.</p>
            )}
            <button
              type="button"
              className={styles.reviewButton}
              onClick={() => navigate(`/app/agenda?date=${day}&doctorId=${session?.userId ?? ""}`)}
            >
              Revisar na agenda
            </button>
          </section>

          <section className={styles.weekPanel} aria-labelledby="week-title">
            <header className={styles.sidePanelHeader}>
              <h2 id="week-title">Sua semana</h2>
              <span>{format(weekStart, "d", { locale: ptBR })}–{format(addDays(weekEnd, -1), "d MMM", { locale: ptBR })}</span>
            </header>
            <dl className={styles.weekStats}>
              <div>
                <dt>Consultas realizadas</dt>
                <dd>{realized}</dd>
              </div>
              <div>
                <dt>Consultas confirmadas</dt>
                <dd>{confirmed}</dd>
              </div>
              <div>
                <dt>Aguardando confirmação</dt>
                <dd>{pendingConfirmations.length}</dd>
              </div>
              <div>
                <dt>Não compareceram</dt>
                <dd>{noShows}</dd>
              </div>
            </dl>
            <p className={styles.dataNote}>
              <FileText size={15} aria-hidden="true" />
              Valores calculados pelas consultas desta semana.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
