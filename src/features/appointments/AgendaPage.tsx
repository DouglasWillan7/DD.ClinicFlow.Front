import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Plus,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Appointment,
  AvailabilitySlot,
  Clinic,
  DoctorAvailability,
  Member,
  OnboardingStatus,
} from "../../api/types";
import { parseGuid } from "../../api/identifiers";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { OnboardingChecklist } from "../onboarding/OnboardingChecklist";
import { AppointmentPatientActionDialog } from "../patient-actions/AppointmentPatientActionDialog";
import { DoctorBlocksCard } from "./DoctorBlocksCard";
import { onboardingKey } from "../onboarding/onboarding";
import {
  appointmentTypeLabels,
  parseDateOnly,
} from "./appointmentLabels";
import {
  buildDayTimeline,
  countFreeSlots,
  getDayStats,
  type TypeFilter,
} from "./agendaTimeline";
import {
  getDoctorName,
  getShortDoctorName,
  listDoctors,
  resolveActiveDoctor,
} from "./agendaDoctors";
import { AgendaMonthCalendar } from "./AgendaMonthCalendar";
import { DayTimeline } from "./DayTimeline";
import { NextAppointmentCard } from "./NextAppointmentCard";
import {
  isAppointmentCancelled,
  isAppointmentConfirmed,
} from "./appointmentStatus";
import styles from "./AgendaPage.module.css";

const typeFilters: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "InPerson", label: appointmentTypeLabels.InPerson },
  { value: "Teleconsultation", label: appointmentTypeLabels.Teleconsultation },
];

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function AgendaPage({
  personal = false,
}: {
  personal?: boolean;
}) {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState(() => {
    const requested = params.get("date");
    return requested && parseDateOnly(requested)
      ? requested
      : format(new Date(), "yyyy-MM-dd");
  });
  const [month, setMonth] = useState(() => startOfMonth(parseISO(day)));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showCreated, setShowCreated] = useState(
    () => params.get("created") === "true",
  );
  const [appointmentMenuOpen, setAppointmentMenuOpen] = useState(false);
  const [patientActionAppointment, setPatientActionAppointment] =
    useState<Appointment | null>(null);
  const appointmentMenuRef = useRef<HTMLDivElement>(null);
  const appointmentMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const createdId = parseGuid(params.get("appointmentId"));
  // O médico ativo mora na URL: a busca global da topbar escreve `?doctorId=`,
  // a página lê, e um link compartilhado abre exatamente a mesma agenda.
  const requestedDoctorId = personal ? null : parseGuid(params.get("doctorId"));

  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const members = useQuery({
    queryKey: ["clinic", "members"],
    queryFn: () => request<Member[]>("/clinics/members"),
  });
  const onboarding = useQuery({
    queryKey: onboardingKey,
    enabled: can(session, "ManageClinicSettings"),
    queryFn: () => request<OnboardingStatus>("/onboarding/status"),
  });

  const timeZone = clinic.data?.timeZoneId ?? "America/Sao_Paulo";
  const monthKey = format(month, "yyyy-MM");

  const monthRange = useMemo(() => {
    if (!clinic.data) return null;
    return {
      from: fromZonedTime(`${monthKey}-01T00:00:00`, timeZone),
      to: fromZonedTime(
        `${format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd")}T00:00:00`,
        timeZone,
      ),
    };
  }, [clinic.data, month, monthKey, timeZone]);

  const appointments = useQuery({
    queryKey: ["appointments", "month", monthKey, timeZone],
    enabled: Boolean(monthRange),
    queryFn: () =>
      request<Appointment[]>(
        `/appointments?from=${encodeURIComponent(monthRange!.from.toISOString())}&to=${encodeURIComponent(monthRange!.to.toISOString())}`,
      ),
  });

  const doctors = useMemo(
    () => listDoctors(members.data ?? []),
    [members.data],
  );
  // O Início nunca pode cair silenciosamente na agenda de um colega caso o
  // vínculo do usuário logado esteja ausente ou ainda não tenha carregado.
  const doctor = personal
    ? doctors.find((candidate) => candidate.userId === session?.userId) ?? null
    : resolveActiveDoctor(doctors, requestedDoctorId, session?.userId);
  const personalAgenda = Boolean(personal && can(session, "ReadClinicalRecord"));

  const availabilityFrom = format(startOfMonth(month), "yyyy-MM-dd");
  const availabilityTo = format(endOfMonth(month), "yyyy-MM-dd");
  const monthAvailability = useQuery({
    queryKey: ["availability", doctor?.userId, monthKey],
    enabled: Boolean(doctor),
    queryFn: () =>
      request<DoctorAvailability>(
        `/doctors/${encodeURIComponent(doctor!.userId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`,
      ),
  });
  const selectedDayInDisplayedMonth = day.slice(0, 7) === monthKey;
  const selectedDayAvailability = useQuery({
    queryKey: ["availability", doctor?.userId, day],
    enabled: Boolean(doctor && !selectedDayInDisplayedMonth),
    queryFn: () =>
      request<DoctorAvailability>(
        `/doctors/${encodeURIComponent(doctor!.userId)}/availability?from=${day}&to=${day}`,
      ),
  });
  const availabilityForDay = selectedDayInDisplayedMonth
    ? monthAvailability
    : selectedDayAvailability;

  const created = useQuery({
    queryKey: ["appointments", "detail", createdId],
    enabled: Boolean(showCreated && createdId),
    queryFn: () =>
      request<Appointment>(`/appointments/${encodeURIComponent(createdId!)}`),
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

  useEffect(() => {
    if (!appointmentMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        appointmentMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setAppointmentMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAppointmentMenuOpen(false);
      appointmentMenuTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [appointmentMenuOpen]);

  const doctorAppointments = useMemo(
    () =>
      (appointments.data ?? []).filter(
        (appointment) => appointment.doctorUserId === doctor?.userId,
      ),
    [appointments.data, doctor?.userId],
  );

  const countByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of doctorAppointments) {
      if (isAppointmentCancelled(appointment.status)) continue;
      const date = formatInTimeZone(
        appointment.startUtc,
        timeZone,
        "yyyy-MM-dd",
      );
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    return counts;
  }, [doctorAppointments, timeZone]);

  const dayAppointments = useMemo(
    () =>
      doctorAppointments.filter(
        (appointment) =>
          formatInTimeZone(appointment.startUtc, timeZone, "yyyy-MM-dd") === day,
      ),
    [day, doctorAppointments, timeZone],
  );

  const availabilityDay = availabilityForDay.data?.days.find(
    (entry) => entry.date === day,
  );

  const rows = useMemo(
    () =>
      buildDayTimeline({
        appointments: dayAppointments,
        slots: availabilityDay?.slots ?? [],
        timeZone,
        typeFilter,
      }),
    [availabilityDay?.slots, dayAppointments, timeZone, typeFilter],
  );

  const stats = getDayStats(dayAppointments);
  const freeSlots = countFreeSlots(rows);
  const nextAppointment = personalAgenda
    ? dayAppointments
        .filter((appointment) => isAppointmentConfirmed(appointment.status))
        .sort(
          (first, second) =>
            Date.parse(first.startUtc) - Date.parse(second.startUtc),
        )[0] ?? null
    : null;

  function updateParams(apply: (next: URLSearchParams) => void) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        apply(next);
        return next;
      },
      { replace: true },
    );
  }

  function changeDay(nextDay: string) {
    setDay(nextDay);
    setMonth(startOfMonth(parseISO(nextDay)));
    updateParams((next) => {
      next.set("date", nextDay);
      next.delete("appointmentId");
      next.delete("created");
    });
  }

  /** Sem slot, a nova consulta começa no horário em branco; o médico ativo já vai junto. */
  function bookSlot(slot: AvailabilitySlot | null) {
    setAppointmentMenuOpen(false);
    const booking = new URLSearchParams({ date: day });
    if (doctor) booking.set("doctorId", doctor.userId);
    if (slot) booking.set("time", slot.label);
    navigate(`/app/agenda/nova?${booking.toString()}`);
  }

  function bookQuickAppointment() {
    if (!doctor) return;
    setAppointmentMenuOpen(false);
    const booking = new URLSearchParams({ date: day });
    booking.set("doctorId", doctor.userId);
    booking.set("mode", "quick");
    navigate(`/app/agenda/nova?${booking.toString()}`);
  }

  if (clinic.isLoading || members.isLoading) {
    return <LoadingBlock label="Preparando a agenda…" />;
  }

  if (clinic.isError || members.isError || !clinic.data) {
    return (
      <div className={styles.page}>
        <ErrorBlock
          message="Não foi possível preparar a agenda da clínica."
          retry={() => {
            void clinic.refetch();
            void members.refetch();
          }}
        />
      </div>
    );
  }

  const dayTitle = capitalize(
    format(parseISO(day), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
  );
  const personalDayTitle = `${capitalize(
    format(parseISO(day), "EEEE", { locale: ptBR }),
  )}, ${format(parseISO(day), "d")} ${capitalize(
    format(parseISO(day), "MMM", { locale: ptBR }).replace(".", ""),
  )} ${format(parseISO(day), "yyyy")}`;
  const filterLabel = typeFilters
    .find((filter) => filter.value === typeFilter)
    ?.label.toLocaleLowerCase("pt-BR");
  const emptyMessage =
    availabilityDay?.status === "NoSchedule"
      ? "Sem agenda configurada para este dia."
      : availabilityDay?.status === "Blocked"
        ? "Dia bloqueado na agenda do médico."
        : typeFilter === "all"
          ? "Nenhuma consulta neste dia."
          : `Nenhuma consulta (${filterLabel}) neste dia.`;

  return (
    <div className={styles.page}>
      <div className={styles.contextRow}>
        <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
          <span>Agendas</span>
          <span aria-hidden="true">›</span>
          <strong>{personalAgenda ? "Minha Agenda" : "Por médico"}</strong>
          {doctor && !personalAgenda ? (
            <>
              <span aria-hidden="true">›</span>
              <span className={styles.breadcrumbDoctor}>
                {doctor.name?.trim() || doctor.email}
              </span>
            </>
          ) : null}
        </nav>

        <span className={styles.contextSpacer} />

        <div className={styles.filters} role="group" aria-label="Filtrar por tipo">
          {typeFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={styles.chip}
              aria-pressed={typeFilter === filter.value}
              onClick={() => setTypeFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div ref={appointmentMenuRef} className={styles.newAppointmentMenu}>
          <button
            ref={appointmentMenuTriggerRef}
            type="button"
            className={styles.newAppointment}
            aria-haspopup="menu"
            aria-expanded={appointmentMenuOpen}
            aria-controls="new-appointment-actions"
            onClick={() => setAppointmentMenuOpen((open) => !open)}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            {doctor && !personalAgenda
              ? `Nova consulta · ${getShortDoctorName(doctor)}`
              : "Nova consulta"}
            <ChevronDown
              size={15}
              strokeWidth={1.8}
              className={styles.menuChevron}
              aria-hidden="true"
            />
          </button>

          {appointmentMenuOpen ? (
            <div
              id="new-appointment-actions"
              className={styles.appointmentActions}
              role="menu"
              aria-label="Nova consulta"
            >
              <button
                type="button"
                role="menuitem"
                className={styles.appointmentAction}
                onClick={() => bookSlot(null)}
              >
                <span className={styles.appointmentActionIcon} aria-hidden="true">
                  <CalendarPlus size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.appointmentActionCopy}>
                  <strong>Agendar consulta</strong>
                  <span>Escolha paciente, data e horário.</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                className={styles.appointmentAction}
                disabled={!doctor}
                onClick={bookQuickAppointment}
              >
                <span className={styles.appointmentActionIcon} aria-hidden="true">
                  <Zap size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.appointmentActionCopy}>
                  <strong>Consulta rápida</strong>
                  <span>
                    {doctor
                      ? `Use o próximo horário livre de ${getShortDoctorName(doctor)}.`
                      : "Selecione um médico para usar este atalho."}
                  </span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showCreated ? (
        <div
          className={styles.successBanner}
          role="status"
          aria-label={
            created.data?.status === "AwaitingPatientAction"
              ? "Agendamento aguardando paciente"
              : "Consulta agendada"
          }
          aria-live="polite"
        >
          <CheckCircle2 size={19} aria-hidden="true" />
          {created.data?.status === "AwaitingPatientAction" ? (
            <span>
              Aguardando a confirmação do paciente e o compartilhamento dos
              dados com o médico. A consulta ficará disponível após essa ação.
            </span>
          ) : created.data ? (
            <span>
              Consulta agendada:{" "}
              {members.data?.find(
                (member) => member.userId === created.data.doctorUserId,
              )?.name ?? "Médico"}
              ,{" "}
              {formatInTimeZone(
                created.data.startUtc,
                timeZone,
                "d 'de' MMMM 'de' yyyy",
                { locale: ptBR },
              )}{" "}
              às {formatInTimeZone(created.data.startUtc, timeZone, "HH:mm")} (
              {appointmentTypeLabels[created.data.type]})
            </span>
          ) : (
            <span>Consulta agendada com sucesso.</span>
          )}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.sideColumn}>
          {!doctor ? (
            <AgendaMonthCalendar
              month={month}
              selectedDate={day}
              days={[]}
              timeZoneId={timeZone}
              pastDatesSelectable={false}
              countByDate={countByDate}
              onMonthChange={setMonth}
              onDateChange={changeDay}
            />
          ) : monthAvailability.isLoading ? (
            <section className={styles.card} aria-label="Calendário da agenda">
              <LoadingBlock label="Carregando disponibilidade…" />
            </section>
          ) : monthAvailability.isError || !monthAvailability.data ? (
            <section className={styles.card} aria-label="Calendário da agenda">
              <ErrorBlock
                message="Não foi possível carregar a disponibilidade do médico."
                retry={() => void monthAvailability.refetch()}
              />
            </section>
          ) : (
            <AgendaMonthCalendar
              month={month}
              selectedDate={day}
              days={monthAvailability.data.days}
              timeZoneId={monthAvailability.data.timeZoneId}
              pastDatesSelectable
              countByDate={countByDate}
              onMonthChange={setMonth}
              onDateChange={changeDay}
            />
          )}

          <section className={styles.card} aria-labelledby="agenda-summary-title">
            <h2 id="agenda-summary-title" className={styles.cardTitle}>
              Resumo do dia
            </h2>
            <dl className={styles.statGrid}>
              <div className={styles.stat}>
                <dd>{stats.total}</dd>
                <dt>Consultas</dt>
              </div>
              <div className={styles.stat}>
                <dd>{stats.teleconsultations}</dd>
                <dt>Teleconsultas</dt>
              </div>
              <div className={`${styles.stat} ${styles.statPending}`}>
                <dd>{stats.pending}</dd>
                <dt>Aguardando</dt>
              </div>
              <div className={`${styles.stat} ${styles.statFree}`}>
                <dd>{personalAgenda ? stats.completed : freeSlots}</dd>
                <dt>{personalAgenda ? "Realizadas" : "Horários livres"}</dt>
              </div>
            </dl>
          </section>

          {nextAppointment ? (
            <NextAppointmentCard
              appointment={nextAppointment}
              timeZone={timeZone}
            />
          ) : null}

          {doctor ? (
            <DoctorBlocksCard
              key={doctor.userId}
              doctorId={doctor.userId}
              doctorName={getDoctorName(doctor)}
              selectedDate={day}
              canEdit={
                can(session, "ManageClinicMemberships") ||
                (can(session, "ReadClinicalRecord") &&
                  doctor.userId === session?.userId)
              }
            />
          ) : null}

          {onboarding.data && !onboarding.data.completed ? (
            <OnboardingChecklist status={onboarding.data} compact />
          ) : null}
        </div>

        {!doctor ? (
          <section className={styles.card} aria-labelledby="agenda-day-title">
            <h2 id="agenda-day-title" className={styles.cardTitle}>
              {dayTitle}
            </h2>
            <p className={styles.emptyMessage} role="status">
              {personalAgenda
                ? "Não foi possível localizar seu cadastro médico."
                : "Cadastre um médico para montar a agenda da clínica."}
            </p>
          </section>
        ) : appointments.isLoading || availabilityForDay.isLoading ? (
          <section className={styles.card} aria-label="Agenda do dia">
            <LoadingBlock label="Organizando os horários…" />
          </section>
        ) : appointments.isError ? (
          <section className={styles.card} aria-label="Agenda do dia">
            <ErrorBlock
              message="Não foi possível carregar as consultas deste dia."
              retry={() => void appointments.refetch()}
            />
          </section>
        ) : availabilityForDay.isError ? (
          <section className={styles.card} aria-label="Agenda do dia">
            {selectedDayInDisplayedMonth ? (
              <p className={styles.emptyMessage} role="status">
                Recarregue a disponibilidade no calendário para ver os horários
                deste dia.
              </p>
            ) : (
              <ErrorBlock
                message="Não foi possível carregar a disponibilidade do médico."
                retry={() => void selectedDayAvailability.refetch()}
              />
            )}
          </section>
        ) : (
          <DayTimeline
            doctor={doctor}
            dayTitle={personalAgenda ? personalDayTitle : dayTitle}
            freeSlots={freeSlots}
            rows={rows}
            emptyMessage={emptyMessage}
            personal={personalAgenda}
            canOpenConsultation={can(session, "ReadTranscription")}
            canManagePatientAction={can(
              session,
              "ManageAppointmentConfirmation",
            )}
            timeZone={timeZone}
            onSelectFreeSlot={bookSlot}
            onManagePatientAction={setPatientActionAppointment}
          />
        )}
      </div>
      {patientActionAppointment ? (
        <AppointmentPatientActionDialog
          appointment={patientActionAppointment}
          onClose={() => setPatientActionAppointment(null)}
          onUpdated={async () => {
            await appointments.refetch();
            if (createdId) await created.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
