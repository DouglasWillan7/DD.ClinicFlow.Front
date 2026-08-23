import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Check, ChevronLeft, MapPin, Video } from "lucide-react";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ApiError } from "../../api/client";
import { parseGuid } from "../../api/identifiers";
import type {
  Appointment,
  AppointmentType,
  Clinic,
  DoctorAvailability,
  Member,
  Patient,
} from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { hasRole } from "../../auth/roles";
import { getAuthScope } from "../../auth/sessionScope";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { onboardingKey } from "../onboarding/onboarding";
import { AppointmentCalendar } from "./AppointmentCalendar";
import { AppointmentSummary } from "./AppointmentSummary";
import { appointmentTypeLabels, parseDateOnly } from "./appointmentLabels";
import { DoctorPicker } from "./DoctorPicker";
import {
  clearDraft,
  emptyNewAppointmentSelection,
  restoreDraft,
  saveDraft,
  selectionReducer,
  type NewAppointmentSelectionAction,
  type NewAppointmentSelection,
} from "./newAppointmentState";
import { PatientPicker } from "./PatientPicker";
import { PatientSearchDialog } from "./PatientSearchDialog";
import { TimeSlotPicker } from "./TimeSlotPicker";
import styles from "./NewAppointmentPage.module.css";

const appointmentTypes: Array<{
  value: AppointmentType;
  icon: typeof MapPin;
}> = [
  { value: "InPerson", icon: MapPin },
  { value: "Teleconsultation", icon: Video },
];

type BookingAttempt = Readonly<{
  payload: Readonly<{
    patientId: string;
    doctorUserId: string;
    startUtc: string;
    type: AppointmentType;
    notes: null;
  }>;
  date: string;
  availabilityKey: QueryKey;
  availabilityPath: string;
  selectionRevision: number;
}>;

function selectionMatchesAttempt(
  selection: NewAppointmentSelection,
  attempt: BookingAttempt,
) {
  return (
    selection.patient?.id === attempt.payload.patientId &&
    selection.doctor?.userId === attempt.payload.doctorUserId &&
    selection.type === attempt.payload.type &&
    selection.date === attempt.date &&
    selection.slot?.startUtc === attempt.payload.startUtc
  );
}

function safeDate(value: string | null) {
  return value && parseDateOnly(value) ? value : null;
}

function safeTime(value: string | null) {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Não foi possível criar a consulta. Tente novamente.";
}

export function NewAppointmentPage() {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const authScope = session ? getAuthScope(session) : "";
  const openedFromHome =
    params.get("origin") === "home" && hasRole(session, "Doctor");
  const [restoredDraft] = useState(() =>
    authScope ? restoreDraft(authScope) : null,
  );
  const patientIdFromUrl = parseGuid(params.get("patientId"));
  const requestedPatientId =
    patientIdFromUrl ?? parseGuid(restoredDraft?.patientId);
  const contextDate = safeDate(params.get("date"));
  // Slot livre clicado na agenda: dia, médico e horário já resolvidos.
  const doctorIdFromUrl = parseGuid(params.get("doctorId"));
  const contextTime = safeTime(params.get("time"));
  const initialMonthDate =
    contextDate ?? safeDate(restoredDraft?.date ?? null);
  const [month, setMonth] = useState(() =>
    startOfMonth(initialMonthDate ? parseDateOnly(initialMonthDate)! : new Date()),
  );
  const [selection, dispatch] = useReducer(selectionReducer, {
    ...emptyNewAppointmentSelection,
    type: restoredDraft?.type ?? null,
  });
  const selectionRevision = useRef(0);
  const latestSelection = useRef(selection);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [confirmError, setConfirmError] = useReducer(
    (_current: string | null, next: string | null) => next,
    null,
  );
  const patientParamGeneration = useRef(requestedPatientId);
  const pendingPatientHydration = useRef(requestedPatientId);
  const restoredDoctor = useRef(false);
  const restoredDate = useRef(false);

  const dispatchSelection = useCallback(
    (action: NewAppointmentSelectionAction) => {
      selectionRevision.current += 1;
      dispatch(action);
    },
    [],
  );

  useLayoutEffect(() => {
    latestSelection.current = selection;
  }, [selection]);

  useLayoutEffect(() => {
    if (patientParamGeneration.current === requestedPatientId) return;
    patientParamGeneration.current = requestedPatientId;
    pendingPatientHydration.current = requestedPatientId;
  }, [requestedPatientId]);

  const clinic = useQuery({
    queryKey: ["new-appointment", authScope, "clinic"],
    queryFn: () => request<Clinic>("/clinics/current"),
    enabled: Boolean(authScope),
  });
  const members = useQuery({
    queryKey: ["new-appointment", authScope, "members"],
    queryFn: () => request<Member[]>("/clinics/members"),
    enabled: Boolean(authScope),
  });
  const patient = useQuery({
    queryKey: ["new-appointment", authScope, "patient", requestedPatientId],
    queryFn: () =>
      request<Patient>(`/patients/${encodeURIComponent(requestedPatientId!)}`),
    enabled: Boolean(authScope && requestedPatientId),
  });

  useEffect(() => {
    if (
      !patient.data ||
      pendingPatientHydration.current !== requestedPatientId
    ) {
      return;
    }
    pendingPatientHydration.current = null;
    dispatchSelection({ type: "patient", patient: patient.data });
  }, [dispatchSelection, patient.data, requestedPatientId]);

  useEffect(() => {
    if (restoredDoctor.current || !members.data) return;
    restoredDoctor.current = true;
    const doctorId = doctorIdFromUrl ?? restoredDraft?.doctorId;
    const doctor = doctorId
      ? members.data.find((member) => member.userId === doctorId)
      : null;
    if (!doctor) return;
    dispatchSelection({ type: "doctor", doctor });
  }, [dispatchSelection, doctorIdFromUrl, members.data, restoredDraft]);

  const monthFrom = format(startOfMonth(month), "yyyy-MM-dd");
  const monthTo = format(endOfMonth(month), "yyyy-MM-dd");
  const availabilityKey: QueryKey = [
    "new-appointment",
    authScope,
    "availability",
    selection.doctor?.userId,
    monthFrom,
    monthTo,
  ];
  const availabilityPath = selection.doctor
    ? `/doctors/${encodeURIComponent(selection.doctor.userId)}/availability?from=${monthFrom}&to=${monthTo}`
    : null;
  const availability = useQuery({
    queryKey: availabilityKey,
    queryFn: () =>
      request<DoctorAvailability>(availabilityPath!),
    enabled: Boolean(authScope && availabilityPath),
  });

  useEffect(() => {
    if (restoredDate.current || !availability.data) return;
    restoredDate.current = true;
    // O dia só vem pronto da URL quando a agenda mandou um horário específico.
    const wantedDate = contextTime ? contextDate : restoredDraft?.date;
    const day = availability.data.days.find(
      (candidate) => candidate.date === wantedDate,
    );
    if (day?.status !== "Available" || day.slots.length === 0) return;
    dispatchSelection({ type: "date", date: day.date });
    const slot = contextTime
      ? day.slots.find((candidate) => candidate.label === contextTime)
      : null;
    if (slot) dispatchSelection({ type: "slot", slot });
  }, [
    availability.data,
    contextDate,
    contextTime,
    dispatchSelection,
    restoredDraft,
  ]);

  useEffect(() => {
    if (!selection.slot || !availability.data) return;
    const stillAvailable = availability.data.days.some((day) =>
      day.slots.some((slot) => slot.startUtc === selection.slot?.startUtc),
    );
    if (!stillAvailable) {
      dispatchSelection({ type: "slot", slot: null });
      setConfirmError(
        "O horário selecionado não está mais disponível. Escolha outro.",
      );
    }
  }, [availability.data, dispatchSelection, selection.slot]);

  const selectedDay = useMemo(
    () =>
      availability.data?.days.find((day) => day.date === selection.date) ??
      null,
    [availability.data, selection.date],
  );

  const mutation = useMutation({
    mutationFn: (attempt: BookingAttempt) =>
      request<Appointment>("/appointments", {
        method: "POST",
        body: JSON.stringify(attempt.payload),
      }),
    onSuccess: (appointment, attempt) => {
      clearDraft(authScope);
      setConfirmError(null);
      queryClient.setQueryData(
        ["appointments", "detail", appointment.id],
        appointment,
      );
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({
        queryKey: attempt.availabilityKey,
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      const destination = openedFromHome
        ? `/app/inicio?date=${attempt.date}&appointmentId=${encodeURIComponent(appointment.id)}&created=true`
        : `/app/agenda?date=${attempt.date}&doctorId=${encodeURIComponent(appointment.doctorUserId)}&appointmentId=${encodeURIComponent(appointment.id)}&created=true`;
      navigate(destination);
    },
    onError: (error, attempt) => {
      const attemptIsStillActive = selectionMatchesAttempt(
        latestSelection.current,
        attempt,
      ) && selectionRevision.current === attempt.selectionRevision;
      if (attemptIsStillActive) setConfirmError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        if (attemptIsStillActive) {
          dispatchSelection({ type: "slot", slot: null });
        }
        void queryClient
          .invalidateQueries({
            queryKey: attempt.availabilityKey,
            exact: true,
            refetchType: "none",
          })
          .then(() =>
            queryClient.fetchQuery({
              queryKey: attempt.availabilityKey,
              queryFn: () =>
                request<DoctorAvailability>(attempt.availabilityPath),
              staleTime: 0,
            }),
          )
          .catch(() => undefined);
      }
    },
  });

  function returnToAgenda() {
    clearDraft(authScope);
    const date = contextDate ?? selection.date;
    const destination = openedFromHome ? "/app/inicio" : "/app/agenda";
    navigate(date ? `${destination}?date=${date}` : destination);
  }

  function createPatient() {
    saveDraft(selection, authScope);
    setPatientDialogOpen(false);
    const returnParams = new URLSearchParams();
    const returnDate = selection.date ?? contextDate;
    if (returnDate) returnParams.set("date", returnDate);
    if (openedFromHome) returnParams.set("origin", "home");
    const returnQuery = returnParams.toString();
    const returnTo = `/app/agenda/nova${returnQuery ? `?${returnQuery}` : ""}`;
    navigate(
      `/app/pacientes/novo?${new URLSearchParams({ returnTo }).toString()}`,
    );
  }

  function changeMonth(nextMonth: Date) {
    const next = startOfMonth(nextMonth);
    setMonth(next);
    setConfirmError(null);
    if (
      selection.date &&
      selection.date.slice(0, 7) !== format(next, "yyyy-MM")
    ) {
      dispatchSelection({ type: "date", date: null });
    }
  }

  const loadingResources = clinic.isPending || members.isPending;
  const resourceError = clinic.isError || members.isError;

  return (
    <main className={styles.bookingPage}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <button
          type="button"
          className={styles.backButton}
          aria-label={
            openedFromHome ? "Voltar para o início" : "Voltar para a agenda"
          }
          onClick={returnToAgenda}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className={styles.breadcrumbParent}>
          {openedFromHome ? "Início" : "Agendas"}
        </span>
        <span className={styles.breadcrumbSeparator} aria-hidden="true">
          ›
        </span>
        <h1 className={styles.breadcrumbCurrent}>Nova consulta</h1>
      </nav>

      {loadingResources ? (
        <LoadingBlock label="Preparando pacientes e médicos…" />
      ) : resourceError || !clinic.data || !members.data ? (
        <ErrorBlock
          message="Não foi possível preparar o novo agendamento."
          retry={() => {
            void clinic.refetch();
            void members.refetch();
          }}
        />
      ) : (
        <div className={styles.bookingColumns}>
          <div className={styles.bookingColumn}>
            <PatientPicker
              patient={selection.patient}
              onOpen={() => setPatientDialogOpen(true)}
            />

            {patient.isError ? (
              <ErrorBlock
                message="Não foi possível carregar o paciente informado."
                retry={() => void patient.refetch()}
              />
            ) : null}

            <DoctorPicker
              members={members.data}
              doctorId={selection.doctor?.userId ?? null}
              search={doctorSearch}
              onSearchChange={setDoctorSearch}
              onDoctorChange={(doctor) => {
                setConfirmError(null);
                dispatchSelection({ type: "doctor", doctor });
              }}
            />

            <section
              className={styles.card}
              aria-labelledby="appointment-type-title"
            >
              <h2 id="appointment-type-title" className={styles.cardTitle}>
                Tipo de atendimento
              </h2>
              <div className={styles.chipList}>
                {appointmentTypes.map((option) => {
                  const selected = selection.type === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={styles.chip}
                      aria-label={appointmentTypeLabels[option.value]}
                      aria-pressed={selected}
                      onClick={() => {
                        setConfirmError(null);
                        dispatchSelection({
                          type: "appointmentType",
                          appointmentType: option.value,
                        });
                      }}
                    >
                      {selected ? (
                        <Check
                          size={16}
                          className={styles.chipCheck}
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon size={17} aria-hidden="true" />
                      )}
                      <span>{appointmentTypeLabels[option.value]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className={styles.bookingColumn}>
            {!selection.doctor ? (
              <section className={styles.card} aria-labelledby="date-title">
                <h2 id="date-title" className={styles.cardTitle}>
                  Data
                </h2>
                <p className={styles.emptyMessage} role="status">
                  Selecione um médico para carregar a disponibilidade real.
                </p>
              </section>
            ) : availability.isPending ? (
              <section className={styles.card} aria-label="Disponibilidade">
                <LoadingBlock label="Carregando disponibilidade…" />
              </section>
            ) : availability.isError || !availability.data ? (
              <section className={styles.card} aria-label="Disponibilidade">
                <ErrorBlock
                  message="Não foi possível carregar a disponibilidade do médico."
                  retry={() => void availability.refetch()}
                />
              </section>
            ) : (
              <AppointmentCalendar
                month={month}
                days={availability.data.days}
                timeZoneId={availability.data.timeZoneId}
                selectedDate={selection.date}
                onMonthChange={changeMonth}
                onDateChange={(date) => {
                  setConfirmError(null);
                  dispatchSelection({ type: "date", date });
                }}
              />
            )}

            <TimeSlotPicker
              slots={selectedDay?.slots ?? []}
              selectedStartUtc={selection.slot?.startUtc ?? null}
              disabled={!selection.doctor || !selection.date}
              onChange={(slot) => {
                setConfirmError(null);
                dispatchSelection({ type: "slot", slot });
              }}
            />

            <AppointmentSummary
              selection={selection}
              pending={mutation.isPending}
              error={confirmError}
              onConfirm={() => {
                if (
                  !selection.patient ||
                  !selection.doctor ||
                  !selection.type ||
                  !selection.date ||
                  !selection.slot
                ) {
                  return;
                }
                mutation.mutate({
                  payload: {
                    patientId: selection.patient.id,
                    doctorUserId: selection.doctor.userId,
                    startUtc: selection.slot.startUtc,
                    type: selection.type,
                    notes: null,
                  },
                  date: selection.date,
                  availabilityKey: [...availabilityKey],
                  availabilityPath: availabilityPath!,
                  selectionRevision: selectionRevision.current,
                });
              }}
            />
          </div>
        </div>
      )}

      <PatientSearchDialog
        open={patientDialogOpen}
        selectedId={selection.patient?.id ?? null}
        onSelect={(nextPatient) => {
          pendingPatientHydration.current = null;
          dispatchSelection({ type: "patient", patient: nextPatient });
        }}
        onClose={() => setPatientDialogOpen(false)}
        onCreate={createPatient}
      />
    </main>
  );
}
