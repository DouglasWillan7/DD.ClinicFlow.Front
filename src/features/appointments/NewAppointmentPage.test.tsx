import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type PropsWithChildren } from "react";
import type {
  Appointment,
  AuthResponse,
  Clinic,
  DoctorAvailability,
  Member,
  Patient,
} from "../../api/types";
import { ApiError } from "../../api/client";
import { NewAppointmentPage } from "./NewAppointmentPage";

let requestMock = vi.fn();
let navigateMock = vi.fn();

const clinicId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const doctorId = "20000000-0000-4000-8000-000000000001";
const secondDoctorId = "20000000-0000-4000-8000-000000000002";
const patientId = "30000000-0000-4000-8000-000000000001";
const secondPatientId = "30000000-0000-4000-8000-000000000002";
const appointmentId = "40000000-0000-4000-8000-000000000001";
const authScope = `uc-secretary:${clinicId}:${userId}`;
const draftKey = `clinicflow.scoped.new-appointment-draft:${encodeURIComponent(
  authScope,
)}`;

const session: AuthResponse = {
  userId,
  email: "secretaria@example.test",
  phone: "+5511999999999",
  clinicId,
  clinicName: "Clínica Vital",
  userClinicId: "uc-secretary",
  clinicRole: "Secretary",
  isAdmin: false,
  roles: ["Secretary"],
  name: "Secretaria",
  availableClinics: [{
    userClinicId: "uc-secretary",
    clinicId,
    clinicName: "Clínica Vital",
    role: "Secretary",
    isAdmin: false,
  }],
  tokens: {
    accessToken: "token-sensitive",
    refreshToken: "refresh-sensitive",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};
let activeSession: AuthResponse = session;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: activeSession }),
}));
vi.mock("../../app/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/navigation")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(window.location.search)],
  };
});

function QueryHarness({
  children,
  staleTime = 0,
  client: externalClient,
}: PropsWithChildren<{ staleTime?: number; client?: QueryClient }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={externalClient ?? client}>
      {children}
    </QueryClientProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const clinic: Clinic = {
  id: clinicId,
  name: "Clínica Vital",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Rua Clínica, 10",
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: null,
  createdAtUtc: "2026-08-01T12:00:00Z",
};
const members: Member[] = [
  {
    userClinicId: "uc-doctor-1",
    userId: doctorId,
    displayName: "Dra. Helena Costa",
    role: "Doctor",
    isAdmin: false,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-doctor-2",
    userId: secondDoctorId,
    displayName: "Dr. Paulo Nunes",
    role: "Doctor",
    isAdmin: false,
    specialty: "Neurologia",
    defaultAppointmentDurationMinutes: 45,
  },
];
const patient: Patient = {
  id: patientId,
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  name: "Marina Oliveira",
  phone: "+5511999990000",
  email: "marina@example.test",
  medicalRecordNumber: 48213,
  bloodType: "APositive",
  sexForClinicalUse: null,
  birthDate: "1980-03-10",
  notes: null,
  isActive: true,
  createdAtUtc: "2026-08-01T12:00:00Z",
};
const secondPatient: Patient = {
  ...patient,
  id: secondPatientId,
  name: "Bianca Souza",
  document: "16899535009",
  medicalRecordNumber: 48214,
};
const availability: DoctorAvailability = {
  doctorUserId: doctorId,
  timeZoneId: "America/Sao_Paulo",
  slotDurationMinutes: 30,
  days: [
    {
      date: "2026-08-10",
      status: "Available",
      slots: [
        {
          startUtc: "2026-08-10T12:00:00Z",
          endUtc: "2026-08-10T12:30:00Z",
          label: "09:00",
        },
      ],
    },
  ],
};
const createdAppointment: Appointment = {
  id: appointmentId,
  patientId: patient.id,
  patientName: patient.name,
  doctorUserId: doctorId,
  startUtc: "2026-08-10T12:00:00Z",
  endUtc: "2026-08-10T12:30:00Z",
  status: "AwaitingPatientAction",
  type: "InPerson",
  notes: null,
  createdAtUtc: "2026-08-06T12:00:00Z",
};

beforeEach(() => {
  activeSession = session;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-06T12:00:00-03:00"));
  sessionStorage.clear();
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&patientId=${patientId}`,
  );
  navigateMock = vi.fn();
});

afterEach(() => vi.useRealTimers());

test("confirma seleção completa e retorna para a consulta criada", async () => {
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === "/appointments" && init?.method === "POST") {
      return createdAppointment;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("heading", { name: "Nova consulta" }),
  ).toBeVisible();
  sessionStorage.setItem(
    draftKey,
    JSON.stringify({ version: 1, patientId }),
  );
  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "InPerson",
      notes: null,
    }),
  });
  expect(navigateMock).toHaveBeenCalledWith(
    `/app/agenda?date=2026-08-10&doctorId=${doctorId}&appointmentId=${appointmentId}&created=true`,
  );
  expect(sessionStorage.getItem(draftKey)).toBeNull();
});

test("oferece somente planos aceitos pelo médico e envia a relação escolhida", async () => {
  const acceptedPlanId = "50000000-0000-4000-8000-000000000001";
  const rejectedPlanId = "50000000-0000-4000-8000-000000000002";
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === "/healthcare-plans") {
      return [
        { id: acceptedPlanId, name: "Unimed" },
        { id: rejectedPlanId, name: "SulAmérica" },
      ];
    }
    if (path === `/clinics/${clinicId}/members/uc-doctor-1/healthcare-plans`) {
      return {
        userClinicId: "uc-doctor-1",
        healthcarePlanIds: [acceptedPlanId],
      };
    }
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === "/appointments" && init?.method === "POST") {
      return {
        ...createdAppointment,
        status: "AwaitingPatientAction",
        healthcarePlanId: acceptedPlanId,
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  expect(
    await screen.findByRole("heading", { name: "Plano de saúde" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Particular" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Unimed" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "SulAmérica" }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Unimed" }));
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));

  const summary = screen.getByRole("heading", { name: "Resumo" }).closest("section")!;
  expect(within(summary).getByText("Unimed")).toBeVisible();
  expect(within(summary).getByText("30 min")).toBeVisible();
  await user.click(
    within(summary).getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "InPerson",
      notes: null,
      healthcarePlanId: acceptedPlanId,
    }),
  });
});

test("consulta rápida busca 62 dias no fuso da clínica e agenda o menor startUtc", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&patientId=${patientId}&doctorId=${doctorId}&mode=quick`,
  );
  const quickClinic = {
    ...clinic,
    timeZoneId: "Pacific/Kiritimati",
  };
  const unorderedAvailability: DoctorAvailability = {
    ...availability,
    timeZoneId: quickClinic.timeZoneId,
    days: [
      {
        date: "2026-08-11",
        status: "Available",
        slots: [
          {
            startUtc: "2026-08-10T22:00:00Z",
            endUtc: "2026-08-10T22:30:00Z",
            label: "12:00",
          },
        ],
      },
      availability.days[0],
    ],
  };
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return quickClinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (
      path ===
      `/doctors/${doctorId}/availability?from=2026-08-07&to=2026-10-07`
    ) {
      return unorderedAvailability;
    }
    if (path === "/appointments" && init?.method === "POST") {
      return createdAppointment;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("heading", { name: "Consulta rápida" }),
  ).toBeVisible();
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      `/doctors/${doctorId}/availability?from=2026-08-07&to=2026-10-07`,
    ),
  );
  expect(
    screen.getByRole("button", { name: "Presencial", pressed: true }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Teleconsulta" }));
  expect(
    screen.getByRole("button", { name: "Teleconsulta", pressed: true }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  expect(screen.queryByRole("table", { name: /Calendário/ })).not.toBeInTheDocument();
  const summary = screen
    .getByRole("heading", { name: "Resumo" })
    .closest("section")!;
  expect(await within(summary).findByText("10 de agosto de 2026")).toBeVisible();
  expect(within(summary).getByText("09:00")).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "InPerson",
      notes: null,
    }),
  });
  expect(navigateMock).toHaveBeenCalledWith(
    `/app/agenda?date=2026-08-10&doctorId=${doctorId}&appointmentId=${appointmentId}&created=true`,
  );
});

test("consulta rápida recalcula o primeiro horário ao trocar de médico", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?doctorId=${doctorId}&mode=quick`,
  );
  const secondAvailability: DoctorAvailability = {
    ...availability,
    doctorUserId: secondDoctorId,
    days: [
      {
        date: "2026-08-09",
        status: "Available",
        slots: [
          {
            startUtc: "2026-08-09T12:30:00Z",
            endUtc: "2026-08-09T13:00:00Z",
            label: "09:30",
          },
        ],
      },
    ],
  };
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path.startsWith(`/doctors/${secondDoctorId}/availability`)) {
      return secondAvailability;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  const summary = (
    await screen.findByRole("heading", { name: "Resumo" })
  ).closest("section")!;
  expect(await within(summary).findByText("09:00")).toBeVisible();

  await user.click(screen.getByRole("button", { name: /Dr\. Paulo Nunes/ }));

  expect(await within(summary).findByText("Dr. Paulo Nunes")).toBeVisible();
  expect(await within(summary).findByText("9 de agosto de 2026")).toBeVisible();
  expect(within(summary).getByText("09:30")).toBeVisible();
  expect(within(summary).queryByText("09:00")).not.toBeInTheDocument();
});

test("consulta rápida não cria encaixe quando faltam horários em 62 dias", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?doctorId=${doctorId}&mode=quick`,
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      return { ...availability, days: [] } satisfies DoctorAvailability;
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByText("Nenhum horário livre nos próximos 62 dias."),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeDisabled();
  expect(screen.queryByRole("table", { name: /Calendário/ })).not.toBeInTheDocument();
});

test("consulta rápida recupera a falha ao buscar o próximo horário", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?doctorId=${doctorId}&mode=quick`,
  );
  let availabilityAttempts = 0;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      availabilityAttempts += 1;
      if (availabilityAttempts === 1) throw new Error("offline");
      return availability;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível buscar o próximo horário livre.",
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

  const summary = screen
    .getByRole("heading", { name: "Resumo" })
    .closest("section")!;
  expect(await within(summary).findByText("09:00")).toBeVisible();
  expect(availabilityAttempts).toBe(2);
});

test(
  "consulta rápida atualiza o horário depois de conflito sem sair do modo",
  async () => {
    window.history.replaceState(
      {},
      "",
      `/app/agenda/nova?patientId=${patientId}&doctorId=${doctorId}&mode=quick`,
    );
    const nextAvailability: DoctorAvailability = {
      ...availability,
      days: [
        {
          date: "2026-08-11",
          status: "Available",
          slots: [
            {
              startUtc: "2026-08-11T13:00:00Z",
              endUtc: "2026-08-11T13:30:00Z",
              label: "10:00",
            },
          ],
        },
      ],
    };
    let availabilityRequests = 0;
    requestMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/clinics/current") return clinic;
      if (path === `/clinics/${clinicId}/members/summary`) return members;
      if (path === `/patients/${patientId}`) return patient;
      if (path.startsWith(`/doctors/${doctorId}/availability`)) {
        availabilityRequests += 1;
        return availabilityRequests === 1 ? availability : nextAvailability;
      }
      if (path === "/appointments" && init?.method === "POST") {
        throw new ApiError("Horário ocupado", 409);
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();

    render(
      <QueryHarness>
        <NewAppointmentPage />
      </QueryHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Confirmar agendamento" }),
    );

    expect(
      await screen.findByRole("alert", undefined, { timeout: 10_000 }),
    ).toHaveTextContent("Horário ocupado");
    const summary = screen
      .getByRole("heading", { name: "Resumo" })
      .closest("section")!;
    expect(await within(summary).findByText("10:00")).toBeVisible();
    expect(within(summary).getByText("11 de agosto de 2026")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Consulta rápida" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    ).toBeEnabled();
    expect(availabilityRequests).toBe(2);
    expect(navigateMock).not.toHaveBeenCalled();
  },
  20_000,
);

test("consulta rápida preserva o modo e as escolhas ao cadastrar paciente", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?patientId=${patientId}&doctorId=${doctorId}&mode=quick`,
  );
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path === `/patients/${secondPatientId}`) return secondPatient;
    if (path === "/patients?includeInactive=false") return [patient];
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === "/appointments" && init?.method === "POST") {
      return {
        ...createdAppointment,
        patientId: secondPatientId,
        patientName: secondPatient.name,
        type: "Teleconsultation",
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  const initialView = render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Teleconsulta" }),
  );
  expect(
    screen.getByRole("button", { name: "Teleconsulta", pressed: true }),
  ).toBeVisible();
  await user.click(await screen.findByRole("button", { name: "Trocar paciente" }));
  await user.click(
    await screen.findByRole("button", { name: "Cadastrar novo paciente" }),
  );

  expect(JSON.parse(sessionStorage.getItem(draftKey)!)).toEqual({
    version: 1,
    patientId,
    doctorId,
    type: "Teleconsultation",
    date: "2026-08-10",
  });
  expect(navigateMock).toHaveBeenCalledWith(
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10%26mode%3Dquick",
  );

  initialView.unmount();
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&mode=quick&patientId=${secondPatientId}`,
  );
  navigateMock.mockClear();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("heading", { name: "Consulta rápida" }),
  ).toBeVisible();
  expect(
    await screen.findByRole("button", {
      name: "Teleconsulta",
      pressed: true,
    }),
  ).toBeVisible();
  const summary = screen
    .getByRole("heading", { name: "Resumo" })
    .closest("section")!;
  expect(await within(summary).findByText(secondPatient.name)).toBeVisible();
  expect(within(summary).getByText("Dra. Helena Costa")).toBeVisible();
  expect(within(summary).getByText("Teleconsulta")).toBeVisible();
  expect(await within(summary).findByText("09:00")).toBeVisible();
  expect(within(summary).getByText("10 de agosto de 2026")).toBeVisible();

  const confirm = screen.getByRole("button", {
    name: "Confirmar agendamento",
  });
  expect(confirm).toBeEnabled();
  await user.click(confirm);

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId: secondPatientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "Teleconsultation",
      notes: null,
    }),
  });
  expect(navigateMock).toHaveBeenCalledWith(
    `/app/agenda?date=2026-08-10&doctorId=${doctorId}&appointmentId=${appointmentId}&created=true`,
  );
});

test("retorna ao Início quando a consulta parte da agenda pessoal", async () => {
  activeSession = {
    ...session,
    userId: doctorId,
    email: "helena@example.test",
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: true,
    roles: ["Admin", "Doctor"],
    name: "Dra. Helena Costa",
  };
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&patientId=${patientId}&doctorId=${doctorId}&origin=home`,
  );
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === "/appointments" && init?.method === "POST") {
      return createdAppointment;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(await screen.findByText("Início")).toBeVisible();
  await user.click(
    await screen.findByRole("button", { name: "Presencial" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(navigateMock).toHaveBeenCalledWith(
    `/app/inicio?date=2026-08-10&appointmentId=${appointmentId}&created=true`,
  );
});

test("volta da criação para o dia aberto no Início", async () => {
  activeSession = {
    ...session,
    userId: doctorId,
    email: "helena@example.test",
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    name: "Dra. Helena Costa",
  };
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}&origin=home`,
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(await screen.findByText("Início")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Voltar para o início" }),
  );

  expect(navigateMock).toHaveBeenCalledWith("/app/inicio?date=2026-08-10");
});

test("mantém o paciente escolhido enquanto a hidratação da URL termina depois", async () => {
  const patientFromUrl = deferred<Patient>();
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patientFromUrl.promise;
    if (path === "/patients?includeInactive=false") return [secondPatient];
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === "/appointments" && init?.method === "POST") {
      return { ...createdAppointment, patientId: secondPatientId };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Selecionar paciente" }),
  );
  await user.click(await screen.findByRole("button", { name: /Bianca Souza/ }));
  const patientPanel = screen
    .getByRole("heading", { name: "Paciente" })
    .closest("section");
  expect(within(patientPanel!).getByText("Bianca Souza")).toBeVisible();

  await act(async () => patientFromUrl.resolve(patient));
  expect(within(patientPanel!).getByText("Bianca Souza")).toBeVisible();

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId: secondPatientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "InPerson",
      notes: null,
    }),
  });
});

test("hidrata o novo patientId quando a URL muda na mesma instância", async () => {
  const firstPatient = deferred<Patient>();
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return firstPatient.promise;
    if (path === `/patients/${secondPatientId}`) return secondPatient;
    throw new Error(`Unexpected request: ${path}`);
  });
  const rendered = render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(`/patients/${patientId}`),
  );

  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&patientId=${secondPatientId}`,
  );
  rendered.rerender(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  const patientPanel = (
    await screen.findByRole("heading", { name: "Paciente" })
  ).closest("section");
  expect(await within(patientPanel!).findByText("Bianca Souza")).toBeVisible();

  await act(async () => firstPatient.resolve(patient));

  expect(within(patientPanel!).getByText("Bianca Souza")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith(`/patients/${secondPatientId}`);
});

test("conclui a tentativa pendente com o snapshot original após mudar a seleção", async () => {
  const booking = deferred<Appointment>();
  const twoDaysAvailability: DoctorAvailability = {
    ...availability,
    days: [
      ...availability.days,
      {
        date: "2026-08-11",
        status: "Available",
        slots: [
          {
            startUtc: "2026-08-11T13:00:00Z",
            endUtc: "2026-08-11T13:30:00Z",
            label: "10:00",
          },
        ],
      },
    ],
  };
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      return twoDaysAvailability;
    }
    if (path === "/appointments" && init?.method === "POST") {
      return booking.promise;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );
  await user.click(
    screen.getByRole("button", { name: "11 de agosto de 2026, disponível" }),
  );

  await act(async () => booking.resolve(createdAppointment));

  expect(requestMock).toHaveBeenCalledWith("/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      doctorUserId: doctorId,
      startUtc: availability.days[0].slots[0].startUtc,
      type: "InPerson",
      notes: null,
    }),
  });
  expect(navigateMock).toHaveBeenCalledWith(
    `/app/agenda?date=2026-08-10&doctorId=${doctorId}&appointmentId=${appointmentId}&created=true`,
  );
});

test("ignora patientId malformado sem interpolar uma rota de paciente", async () => {
  window.history.replaceState(
    {},
    "",
    "/app/agenda/nova?patientId=..%2F..%2Fsegredo",
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/patients/")) return patient;
    throw new Error(`Unexpected request: ${path}`);
  });
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(await screen.findByText("Quem será atendido?")).toBeVisible();
  expect(
    requestMock.mock.calls.some(([path]) =>
      String(path).startsWith("/patients/"),
    ),
  ).toBe(false);
});

test("409 tardio atualiza a tentativa original sem alterar o novo contexto", async () => {
  const booking = deferred<Appointment>();
  let originalAvailabilityRequests = 0;
  let currentAvailabilityRequests = 0;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      originalAvailabilityRequests += 1;
      return availability;
    }
    if (path.startsWith(`/doctors/${secondDoctorId}/availability`)) {
      currentAvailabilityRequests += 1;
      return {
        ...availability,
        doctorUserId: secondDoctorId,
        days: [
          {
            date: "2026-08-11",
            status: "Available",
            slots: [
              {
                startUtc: "2026-08-11T13:00:00Z",
                endUtc: "2026-08-11T13:30:00Z",
                label: "10:00",
              },
            ],
          },
        ],
      } satisfies DoctorAvailability;
    }
    if (path === "/appointments" && init?.method === "POST") {
      return booking.promise;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness staleTime={30_000}>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );
  await user.click(screen.getByRole("button", { name: /Dr\. Paulo Nunes/ }));
  await waitFor(() => expect(currentAvailabilityRequests).toBe(1));
  await user.click(
    screen.getByRole("button", {
      name: "11 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "10:00" }));

  await act(async () => booking.reject(new ApiError("Horário ocupado", 409)));

  await waitFor(() => expect(originalAvailabilityRequests).toBe(2));
  expect(currentAvailabilityRequests).toBe(1);
  expect(screen.queryByText("Horário ocupado")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Dr\. Paulo Nunes/, pressed: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "11 de agosto de 2026, disponível, selecionado",
      pressed: true,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: /10:00/, pressed: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeEnabled();
});

test("409 tardio não altera uma nova geração que retornou aos mesmos valores", async () => {
  const booking = deferred<Appointment>();
  let availabilityRequests = 0;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      availabilityRequests += 1;
      return availability;
    }
    if (path === "/appointments" && init?.method === "POST") {
      return booking.promise;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness staleTime={30_000}>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  await user.click(screen.getByRole("button", { name: "Teleconsulta" }));
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await act(async () => booking.reject(new ApiError("Horário ocupado", 409)));

  await waitFor(() => expect(availabilityRequests).toBe(2));
  expect(screen.queryByText("Horário ocupado")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Presencial", pressed: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: /09:00/, pressed: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeEnabled();
});

test("refaz o HTTP da tentativa original mesmo após remover a query do cache", async () => {
  const booking = deferred<Appointment>();
  let originalAvailabilityRequests = 0;
  let currentAvailabilityRequests = 0;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      originalAvailabilityRequests += 1;
      return availability;
    }
    if (path.startsWith(`/doctors/${secondDoctorId}/availability`)) {
      currentAvailabilityRequests += 1;
      return { ...availability, doctorUserId: secondDoctorId };
    }
    if (path === "/appointments" && init?.method === "POST") {
      return booking.promise;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  const user = userEvent.setup();
  render(
    <QueryHarness client={queryClient}>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );
  await user.click(screen.getByRole("button", { name: /Dr\. Paulo Nunes/ }));
  await waitFor(() => expect(currentAvailabilityRequests).toBe(1));

  const originalAvailabilityKey = [
    "new-appointment",
    authScope,
    "availability",
    doctorId,
    "2026-08-01",
    "2026-08-31",
  ];
  queryClient.removeQueries({
    queryKey: originalAvailabilityKey,
    exact: true,
  });
  expect(queryClient.getQueryState(originalAvailabilityKey)).toBeUndefined();

  await act(async () => booking.reject(new ApiError("Horário ocupado", 409)));

  await waitFor(() => expect(originalAvailabilityRequests).toBe(2));
  expect(currentAvailabilityRequests).toBe(1);
  expect(screen.queryByText("Horário ocupado")).not.toBeInTheDocument();
});

test("conflito preserva o contexto, limpa somente o slot e atualiza a disponibilidade", async () => {
  let availabilityRequests = 0;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      availabilityRequests += 1;
      return availability;
    }
    if (path === "/appointments" && init?.method === "POST") {
      throw new ApiError("Horário ocupado", 409);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Presencial" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Horário ocupado",
  );
  expect(screen.getAllByText("Marina Oliveira").length).toBeGreaterThan(0);
  expect(
    screen.getByRole("button", {
      name: /Dra\. Helena Costa/,
      pressed: true,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Presencial", pressed: true }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "10 de agosto de 2026, disponível, selecionado",
      pressed: true,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeDisabled();
  await waitFor(() => expect(availabilityRequests).toBe(2));
  expect(navigateMock).not.toHaveBeenCalled();
});

test("salva rascunho sem PII antes de cadastrar paciente e o restaura pelo retorno", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path === "/patients?includeInactive=false") return [patient];
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(screen.getByRole("button", { name: "Teleconsulta" }));
  await user.click(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Trocar paciente" }));
  await user.click(
    await screen.findByRole("button", { name: "Cadastrar novo paciente" }),
  );

  const draft = sessionStorage.getItem(draftKey);
  expect(JSON.parse(draft!)).toEqual({
    version: 1,
    patientId,
    doctorId,
    type: "Teleconsultation",
    date: "2026-08-10",
  });
  expect(draft).not.toContain(patient.name);
  expect(draft).not.toContain(patient.document);
  expect(navigateMock).toHaveBeenCalledWith(
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
});

test("leva a data de contexto ao cadastro mesmo sem selecionar uma data", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path === "/patients?includeInactive=false") return [patient];
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(await screen.findByRole("button", { name: "Trocar paciente" }));
  await user.click(
    await screen.findByRole("button", { name: "Cadastrar novo paciente" }),
  );

  expect(navigateMock).toHaveBeenCalledWith(
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
});

test("hidrata patientId do retorno, restaura escolhas válidas e limpa o draft ao cancelar", async () => {
  sessionStorage.setItem(
    draftKey,
    JSON.stringify({
      version: 1,
      patientId: secondPatientId,
      doctorId,
      type: "Teleconsultation",
      date: "2026-08-10",
    }),
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect((await screen.findAllByText("Marina Oliveira")).length).toBeGreaterThan(
    0,
  );
  expect(requestMock).not.toHaveBeenCalledWith(`/patients/${secondPatientId}`);
  expect(
    await screen.findByRole("button", {
      name: /Dra\. Helena Costa/,
      pressed: true,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Teleconsulta", pressed: true }),
  ).toBeVisible();
  expect(
    await screen.findByRole("button", {
      name: "10 de agosto de 2026, disponível, selecionado",
      pressed: true,
    }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "09:00" })).not.toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await user.click(screen.getByRole("button", { name: "Voltar para a agenda" }));
  expect(sessionStorage.getItem(draftKey)).toBeNull();
  expect(navigateMock).toHaveBeenCalledWith(
    "/app/agenda?date=2026-08-10",
  );
});

test("usa date como contexto de mês e retorno sem selecionar um dia bloqueado", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-11&patientId=${patientId}`,
  );
  const blockedAvailability: DoctorAvailability = {
    ...availability,
    days: [{ date: "2026-08-11", status: "Blocked", slots: [] }],
  };
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      expect(path).toContain("from=2026-08-01&to=2026-08-31");
      return blockedAvailability;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  expect(
    await screen.findByRole("table", { name: "Calendário de agosto de 2026" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "11 de agosto de 2026, bloqueado",
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Voltar para a agenda" }));
  expect(navigateMock).toHaveBeenCalledWith(
    "/app/agenda?date=2026-08-11",
  );
});

test("prioriza a data selecionada no cadastro e restaura o novo mês no retorno", async () => {
  const septemberAvailability: DoctorAvailability = {
    ...availability,
    days: [
      {
        date: "2026-09-10",
        status: "Available",
        slots: [
          {
            startUtc: "2026-09-10T12:00:00Z",
            endUtc: "2026-09-10T12:30:00Z",
            label: "09:00",
          },
        ],
      },
    ],
  };
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === `/patients/${patientId}`) return patient;
    if (path === "/patients?includeInactive=false") return [patient];
    if (path.startsWith(`/doctors/${doctorId}/availability`)) {
      return path.includes("from=2026-09-01")
        ? septemberAvailability
        : { ...availability, days: [] };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  const firstVisit = render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: /Dra\. Helena Costa/ }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Próximo mês" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "10 de setembro de 2026, disponível",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Trocar paciente" }));
  await user.click(
    await screen.findByRole("button", { name: "Cadastrar novo paciente" }),
  );

  expect(JSON.parse(sessionStorage.getItem(draftKey)!)).toEqual({
    version: 1,
    patientId,
    doctorId,
    type: null,
    date: "2026-09-10",
  });
  expect(navigateMock).toHaveBeenCalledWith(
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-09-10",
  );

  firstVisit.unmount();
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-09-10&patientId=${patientId}`,
  );
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("button", {
      name: "10 de setembro de 2026, disponível, selecionado",
      pressed: true,
    }),
  ).toBeVisible();
});

test("carrega clínica e membros em paralelo e recupera falha com retry", async () => {
  window.history.replaceState({}, "", "/app/agenda/nova");
  let resolveClinic!: (value: Clinic) => void;
  let resolveMembers!: (value: Member[]) => void;
  const clinicPromise = new Promise<Clinic>((resolve) => {
    resolveClinic = resolve;
  });
  const membersPromise = new Promise<Member[]>((resolve) => {
    resolveMembers = resolve;
  });
  requestMock = vi.fn((path: string) => {
    if (path === "/clinics/current") return clinicPromise;
    if (path === `/clinics/${clinicId}/members/summary`) return membersPromise;
    throw new Error(`Unexpected request: ${path}`);
  });
  const firstRender = render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Preparando pacientes e médicos",
  );
  expect(requestMock).toHaveBeenCalledWith("/clinics/current");
  expect(requestMock).toHaveBeenCalledWith(`/clinics/${clinicId}/members/summary`);
  await act(async () => {
    resolveClinic(clinic);
    resolveMembers(members);
    await Promise.all([clinicPromise, membersPromise]);
  });
  expect(await screen.findByText("Quem será atendido?")).toBeVisible();
  firstRender.unmount();

  let clinicAttempts = 0;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") {
      clinicAttempts += 1;
      if (clinicAttempts === 1) throw new Error("offline");
      return clinic;
    }
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível preparar o novo agendamento",
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Quem será atendido?")).toBeVisible();
  expect(clinicAttempts).toBe(2);
});

test("aceita o médico sem especialidade que a agenda mandou pela URL", async () => {
  const rookieId = "20000000-0000-4000-8000-000000000003";
  const rookie: Member = {
    userClinicId: "uc-doctor-3",
    userId: rookieId,
    displayName: "Dr. Novo Vieira",
    role: "Doctor",
    isAdmin: false,
    specialty: null,
    defaultAppointmentDurationMinutes: 30,
  };
  window.history.replaceState(
    {},
    "",
    `/app/agenda/nova?date=2026-08-10&doctorId=${rookieId}&time=${encodeURIComponent("09:00")}`,
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return [...members, rookie];
    if (path.startsWith(`/doctors/${rookieId}/availability`)) {
      return { ...availability, doctorUserId: rookieId };
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <QueryHarness>
      <NewAppointmentPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("button", { name: "Dr. Novo Vieira, selecionada" }),
  ).toBeVisible();
  expect(
    await screen.findByRole("button", { name: "09:00, selecionado" }),
  ).toHaveAttribute("aria-pressed", "true");
  // Agendar não passa mais por especialidade: nenhum filtro precede o médico.
  expect(
    screen.queryByRole("group", { name: "Especialidade" }),
  ).not.toBeInTheDocument();
});
