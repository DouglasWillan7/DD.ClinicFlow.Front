import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import type {
  Appointment,
  AuthResponse,
  Clinic,
  DoctorAvailability,
  Member,
} from "../../api/types";
import { AgendaPage } from "./AgendaPage";

let requestMock = vi.fn();

const clinicId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const doctorId = "20000000-0000-4000-8000-000000000001";
const secondDoctorId = "20000000-0000-4000-8000-000000000002";
const patientId = "30000000-0000-4000-8000-000000000001";
const appointmentId = "40000000-0000-4000-8000-000000000001";

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
    accessToken: "token",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};
let activeSession: AuthResponse = session;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: activeSession }),
}));

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
const appointment: Appointment = {
  id: appointmentId,
  patientId,
  patientName: "Marina Oliveira",
  doctorUserId: doctorId,
  startUtc: "2026-08-10T12:00:00Z",
  endUtc: "2026-08-10T12:30:00Z",
  type: "InPerson",
  status: "AwaitingPatientAction",
  notes: "Retorno com exames",
  createdAtUtc: "2026-08-06T12:00:00Z",
};
const teleconsultation: Appointment = {
  id: "40000000-0000-4000-8000-000000000002",
  patientId: "30000000-0000-4000-8000-000000000002",
  patientName: "Carlos Souza",
  doctorUserId: doctorId,
  startUtc: "2026-08-10T14:00:00Z",
  endUtc: "2026-08-10T15:00:00Z",
  type: "Teleconsultation",
  status: "Confirmed",
  notes: null,
  createdAtUtc: "2026-08-06T12:00:00Z",
};
const canceled: Appointment = {
  id: "40000000-0000-4000-8000-000000000003",
  patientId: "30000000-0000-4000-8000-000000000003",
  patientName: "Paula Ramos",
  doctorUserId: doctorId,
  startUtc: "2026-08-10T16:00:00Z",
  endUtc: "2026-08-10T16:30:00Z",
  type: "InPerson",
  status: "Cancelled",
  notes: null,
  createdAtUtc: "2026-08-06T12:00:00Z",
};
const otherDoctorAppointment: Appointment = {
  id: "40000000-0000-4000-8000-000000000004",
  patientId: "30000000-0000-4000-8000-000000000004",
  patientName: "Bianca Souza",
  doctorUserId: secondDoctorId,
  startUtc: "2026-08-10T13:00:00Z",
  endUtc: "2026-08-10T13:30:00Z",
  type: "InPerson",
  status: "Confirmed",
  notes: null,
  createdAtUtc: "2026-08-06T12:00:00Z",
};
const historicalAppointment: Appointment = {
  id: "40000000-0000-4000-8000-000000000005",
  patientId: "30000000-0000-4000-8000-000000000005",
  patientName: "Paciente Histórico",
  doctorUserId: doctorId,
  startUtc: "2000-08-09T12:00:00Z",
  endUtc: "2000-08-09T12:30:00Z",
  type: "InPerson",
  status: "Confirmed",
  notes: "Atendimento anterior",
  createdAtUtc: "2000-08-01T12:00:00Z",
};
const completedAppointment: Appointment = {
  id: "40000000-0000-4000-8000-000000000006",
  patientId: "30000000-0000-4000-8000-000000000006",
  patientName: "Renata Nascimento",
  doctorUserId: doctorId,
  startUtc: "2026-08-10T17:00:00Z",
  endUtc: "2026-08-10T17:30:00Z",
  type: "InPerson",
  status: "Completed",
  notes: "Acompanhamento",
  createdAtUtc: "2026-08-06T12:00:00Z",
};
const awaitingPatientAppointment: Appointment = {
  ...appointment,
  id: "40000000-0000-4000-8000-000000000007",
  status: "AwaitingPatientAction" as Appointment["status"],
};
const accessRequiredAppointment: Appointment = {
  ...appointment,
  id: "40000000-0000-4000-8000-000000000008",
  patientName: "Paciente sem acesso",
  startUtc: "2026-08-10T15:00:00Z",
  endUtc: "2026-08-10T15:30:00Z",
  status: "AccessRequired" as Appointment["status"],
};
const inProgressAppointment: Appointment = {
  ...appointment,
  id: "40000000-0000-4000-8000-000000000009",
  patientName: "Paciente em atendimento",
  startUtc: "2026-08-10T16:00:00Z",
  endUtc: "2026-08-10T16:30:00Z",
  status: "InProgress" as Appointment["status"],
  notes: null,
  actualStartUtc: "2026-08-10T16:05:00Z",
  actualEndUtc: null,
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
          startUtc: "2026-08-10T12:30:00Z",
          endUtc: "2026-08-10T13:00:00Z",
          label: "09:30",
        },
        {
          startUtc: "2026-08-10T13:30:00Z",
          endUtc: "2026-08-10T14:00:00Z",
          label: "10:30",
        },
      ],
    },
    {
      date: "2099-08-10",
      status: "Available",
      slots: [
        {
          startUtc: "2099-08-10T12:30:00Z",
          endUtc: "2099-08-10T13:00:00Z",
          label: "09:30",
        },
      ],
    },
    {
      date: "2099-08-11",
      status: "Available",
      slots: [
        {
          startUtc: "2099-08-11T12:30:00Z",
          endUtc: "2099-08-11T13:00:00Z",
          label: "09:30",
        },
      ],
    },
  ],
};

function QueryHarness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function findTimeline(doctorName = "Dra. Helena Costa") {
  const heading = await screen.findByRole("heading", { name: doctorName });
  return heading.closest("section")!;
}

function mockAgenda(appointments: Appointment[] = [appointment]) {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/appointments?")) return appointments;
    if (path === `/appointments/${appointmentId}`) return appointment;
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path.startsWith(`/doctors/${secondDoctorId}/availability`)) {
      return { ...availability, doctorUserId: secondDoctorId, days: [] };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
}

beforeEach(() => {
  activeSession = session;
  window.history.replaceState({}, "", "/app/agenda?date=2026-08-10");
  mockAgenda();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("abre o menu e mantém o agendamento completo vinculado ao médico ativo", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const trigger = await screen.findByRole("button", {
    name: "Nova consulta · Dra. Helena",
  });
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  await user.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("menu", { name: "Nova consulta" })).toBeVisible();
  await user.click(screen.getByRole("menuitem", { name: /Agendar consulta/ }));

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}`,
  );
});

test("abre a consulta rápida com data e médico ativos", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Nova consulta · Dra. Helena" }),
  );
  await user.click(screen.getByRole("menuitem", { name: /Consulta rápida/ }));

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}&mode=quick`,
  );
});

test("fecha o menu com Escape e devolve o foco ao gatilho", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const trigger = await screen.findByRole("button", {
    name: "Nova consulta · Dra. Helena",
  });
  await user.click(trigger);
  expect(screen.getByRole("menu", { name: "Nova consulta" })).toBeVisible();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("menu", { name: "Nova consulta" })).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});

test("desabilita a consulta rápida e explica quando não há médico ativo", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return [];
    if (path.startsWith("/appointments?")) return [];
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Nova consulta" }),
  );

  expect(
    screen.getByRole("menuitem", { name: /Consulta rápida/ }),
  ).toBeDisabled();
  expect(screen.getByText("Selecione um médico para usar este atalho.")).toBeVisible();
  expect(
    screen.getByRole("menuitem", { name: /Agendar consulta/ }),
  ).toBeEnabled();
});

test("apresenta o médico ativo com especialidade, dia e horários livres", async () => {
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();
  expect(
    within(timeline).getByText("Cardiologia · Segunda-feira, 10 de agosto de 2026"),
  ).toBeVisible();
  expect(within(timeline).getByText("2 horários livres")).toBeVisible();
  expect(screen.getByText("Por médico")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith(
    `/doctors/${doctorId}/availability?from=2026-08-01&to=2026-08-31`,
  );
});

test("monta a linha do tempo com consultas, horários livres e intervalo", async () => {
  mockAgenda([appointment, teleconsultation, canceled]);
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();

  expect(await within(timeline).findByText("Marina Oliveira")).toBeVisible();
  expect(within(timeline).getByText("Retorno com exames · 30 min")).toBeVisible();
  expect(within(timeline).getByText("Carlos Souza")).toBeVisible();
  expect(within(timeline).getByText("Paula Ramos")).toBeVisible();
  expect(
    within(timeline).queryByRole("button", {
      name: "Abrir consulta de Marina Oliveira",
    }),
  ).not.toBeInTheDocument();
  expect(
    within(timeline).getAllByRole("button", { name: /disponível — agendar/ }),
  ).toHaveLength(2);
  expect(within(timeline).getByText("Intervalo · 10:00 – 10:30")).toBeVisible();
});

test("mantém estados sem acesso visíveis, mas sem ação para abrir consulta", async () => {
  activeSession = {
    ...session,
    userId: doctorId,
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    name: "Dra. Helena Costa",
  };
  mockAgenda([awaitingPatientAppointment, accessRequiredAppointment]);

  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();
  expect(
    within(timeline).getByText("Aguardando confirmação do paciente"),
  ).toBeVisible();
  expect(within(timeline).getByText("Acesso necessário")).toBeVisible();
  expect(
    within(timeline).queryByRole("button", { name: /Abrir consulta/ }),
  ).not.toBeInTheDocument();
});

test("permite à secretaria concluir a ação única sem expor dados clínicos no diálogo", async () => {
  activeSession = {
    ...session,
    userClinicId: "50000000-0000-4000-8000-000000000001",
    clinicRole: "Secretary",
    isAdmin: false,
  };
  const pendingAppointment = {
    ...awaitingPatientAppointment,
    notes: null,
  };
  const action = {
    actionId: "60000000-0000-4000-8000-000000000001",
    actionType: "AppointmentWithDataSharing",
    status: "Pending",
    requestedAtUtc: "2026-08-06T12:00:00Z",
    expiresAtUtc: "2026-08-10T12:00:00Z",
    completedAtUtc: null,
    completionMethod: null,
    latestChallenge: {
      challengeId: "70000000-0000-4000-8000-000000000001",
      type: "Token",
      channel: "WhatsApp",
      status: "Sent",
      attemptNumber: 1,
      expiresAtUtc: "2026-08-10T12:00:00Z",
      retryAtUtc: null,
    },
  } as const;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/appointments?")) return [pendingAppointment];
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    if (path === `/patient-actions/appointments/${pendingAppointment.id}`) {
      return action;
    }
    if (
      path ===
      `/patient-actions/challenges/${action.latestChallenge.challengeId}/complete-token`
    ) {
      return { status: "Completed" };
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", {
      name: "Confirmar ação de Marina Oliveira",
    }),
  );

  const dialog = screen.getByRole("dialog", { name: "Confirmação do paciente" });
  expect(within(dialog).queryByText(/exame|diagnóstico|prontuário/i)).not.toBeInTheDocument();
  await user.type(within(dialog).getByLabelText("Código de confirmação"), "12a3456");
  await user.click(within(dialog).getByRole("button", { name: "Confirmar código" }));

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      `/patient-actions/challenges/${action.latestChallenge.challengeId}/complete-token`,
      {
        method: "POST",
        body: JSON.stringify({ token: "123456" }),
      },
    ),
  );
  expect(within(dialog).getByRole("status")).toHaveTextContent(
    "Ação confirmada",
  );
});

test("exibe o início efetivo sem substituir a janela agendada", async () => {
  activeSession = {
    ...session,
    userId: doctorId,
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    name: "Dra. Helena Costa",
  };
  mockAgenda([inProgressAppointment]);

  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();
  expect(within(timeline).getByText("30 min")).toBeVisible();
  expect(
    within(timeline).getByText("Início efetivo · 13:05"),
  ).toBeVisible();
  expect(
    within(timeline).getByRole("button", {
      name: "Abrir consulta de Paciente em atendimento",
    }),
  ).toBeVisible();
});

test("resume o dia sem contar canceladas e conta os horários livres", async () => {
  mockAgenda([appointment, teleconsultation, canceled]);
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();
  await within(timeline).findByText("Marina Oliveira");

  const summary = screen
    .getByRole("heading", { name: "Resumo do dia" })
    .closest("section")!;
  const stats = within(summary).getAllByRole("definition");
  expect(stats.map((stat) => stat.textContent)).toEqual(["2", "1", "1", "2"]);
});

test.each<{ profile: string; roles: AuthResponse["roles"] }>([
  { profile: "médico", roles: ["Doctor"] },
  { profile: "médico administrador", roles: ["Admin", "Doctor"] },
])("adapta Minha Agenda para o $profile", async ({ roles }) => {
  activeSession = {
    ...session,
    userId: doctorId,
    email: "helena@example.test",
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: roles.includes("Admin"),
    roles: [...roles],
    name: "Dra. Helena Costa",
  };
  const user = userEvent.setup();
  mockAgenda([appointment, teleconsultation, completedAppointment]);
  render(
    <QueryHarness>
      <AgendaPage personal />
    </QueryHarness>,
  );

  expect(await screen.findByText("Minha Agenda")).toBeVisible();
  expect(screen.getByText("Agendas")).toBeVisible();
  expect(screen.queryByText("Por médico")).not.toBeInTheDocument();
  const timelineTitle = await screen.findByRole("heading", {
    name: "Segunda-feira, 10 Ago 2026",
  });
  const personalTimeline = timelineTitle.closest("section")!;
  expect(personalTimeline).toBeVisible();
  expect(
    within(personalTimeline).getByRole("button", {
      name: "Abrir consulta de Carlos Souza",
    }),
  ).toBeVisible();
  expect(
    within(personalTimeline).queryByRole("button", {
      name: "Abrir consulta de Marina Oliveira",
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /^Nova consulta$/ }),
  ).toBeVisible();

  const summary = screen
    .getByRole("heading", { name: "Resumo do dia" })
    .closest("section")!;
  expect(
    within(summary).getAllByRole("definition").map((stat) => stat.textContent),
  ).toEqual(["3", "1", "1", "1"]);
  expect(within(summary).getByText("Realizadas")).toBeVisible();
  expect(within(summary).queryByText("Horários livres")).not.toBeInTheDocument();

  const nextAppointment = screen
    .getByRole("heading", { name: "Próxima consulta" })
    .closest("section")!;
  expect(within(nextAppointment).getByText("Carlos Souza")).toBeVisible();
  expect(within(nextAppointment).getByText("11:00 · 60 min")).toBeVisible();
  await user.click(
    within(nextAppointment).getByRole("button", { name: "Abrir prontuário" }),
  );
  expect(window.location.pathname).toBe(
    `/app/pacientes/${teleconsultation.patientId}`,
  );
});

test("Minha Agenda ignora outro médico informado na URL", async () => {
  activeSession = {
    ...session,
    userId: doctorId,
    userClinicId: "uc-doctor-1",
    clinicRole: "Doctor",
    isAdmin: true,
    roles: ["Admin", "Doctor"],
    name: "Dra. Helena Costa",
  };
  window.history.replaceState(
    {},
    "",
    `/app/inicio?date=2026-08-10&doctorId=${secondDoctorId}`,
  );
  mockAgenda([appointment, otherDoctorAppointment]);

  render(
    <QueryHarness>
      <AgendaPage personal />
    </QueryHarness>,
  );

  const timeline = await screen.findByRole("region", {
    name: "Segunda-feira, 10 Ago 2026",
  });
  expect(within(timeline).getByText("Marina Oliveira")).toBeVisible();
  expect(screen.queryByText("Bianca Souza")).not.toBeInTheDocument();
  expect(
    requestMock.mock.calls.some(([path]) =>
      String(path).includes(`/doctors/${secondDoctorId}/availability`),
    ),
  ).toBe(false);
});

test("filtro de tipo marca o horário como ocupado sem mexer no resumo", async () => {
  const user = userEvent.setup();
  mockAgenda([appointment, teleconsultation]);
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline();
  expect(await within(timeline).findByText("Marina Oliveira")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Teleconsulta" }));

  expect(within(timeline).queryByText("Marina Oliveira")).not.toBeInTheDocument();
  expect(
    within(timeline).getByText("Ocupado · presencial (fora do filtro)"),
  ).toBeVisible();
  expect(within(timeline).getByText("Carlos Souza")).toBeVisible();
  expect(within(timeline).getByText("2 horários livres")).toBeVisible();
  const summary = screen
    .getByRole("heading", { name: "Resumo do dia" })
    .closest("section")!;
  expect(
    within(summary).getAllByRole("definition").map((stat) => stat.textContent),
  ).toEqual(["2", "1", "1", "2"]);
});

test("leva o slot livre para o agendamento com médico e horário resolvidos", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "09:30, disponível — agendar" }),
  );

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}&time=09%3A30`,
  );
});

// A escolha do médico é da busca global da topbar; a página só lê ?doctorId=.
test("abre a agenda do médico pedido na URL, sem misturar com o outro", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda?date=2026-08-10&doctorId=${secondDoctorId}`,
  );
  mockAgenda([appointment, otherDoctorAppointment]);
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  const timeline = await findTimeline("Dr. Paulo Nunes");
  expect(await within(timeline).findByText("Bianca Souza")).toBeVisible();
  expect(screen.queryByText("Marina Oliveira")).not.toBeInTheDocument();
  expect(requestMock).toHaveBeenCalledWith(
    `/doctors/${secondDoctorId}/availability?from=2026-08-01&to=2026-08-31`,
  );
});

test("mantém datas indisponíveis sem consultar disponibilidade quando não há médico", async () => {
  window.history.replaceState({}, "", "/app/agenda?date=2000-08-10");
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return [];
    if (path.startsWith("/appointments?")) return [];
    throw new Error(`Unexpected request: ${path}`);
  });
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("button", {
      name: "10 de agosto de 2000, data passada, sem consultas",
    }),
  ).toBeDisabled();
  expect(
    requestMock.mock.calls.some(([path]) =>
      String(path).includes("/availability"),
    ),
  ).toBe(false);
});

test("troca o dia pelo calendário e mantém a data na URL", async () => {
  window.history.replaceState({}, "", "/app/agenda?date=2099-08-10");
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", {
      name: "11 de agosto de 2099, disponível, sem consultas",
    }),
  );

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    "/app/agenda?date=2099-08-11",
  );
  expect(
    await screen.findByText(/Terça-feira, 11 de agosto de 2099/),
  ).toBeVisible();
});

test("habilita somente dias passados com consultas do médico", async () => {
  window.history.replaceState({}, "", "/app/agenda?date=2000-08-10");
  mockAgenda([historicalAppointment]);
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("button", {
      name: "8 de agosto de 2000, data passada, sem consultas",
    }),
  ).toBeDisabled();

  const pastDay = await screen.findByRole("button", {
    name: "9 de agosto de 2000, data passada, 1 consulta",
  });
  expect(pastDay).toBeEnabled();
  await user.click(pastDay);

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    "/app/agenda?date=2000-08-09",
  );
  expect(
    await within(await findTimeline()).findByText("Paciente Histórico"),
  ).toBeVisible();
});

test("busca a disponibilidade novamente ao navegar para outro mês", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await screen.findByRole("table", { name: "Calendário de agosto de 2026" });
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      `/doctors/${doctorId}/availability?from=2026-09-01&to=2026-09-30`,
    ),
  );
  expect(
    await screen.findByText(/Segunda-feira, 10 de agosto de 2026/),
  ).toBeVisible();
});

test("mostra erro recuperável quando a disponibilidade mensal falha", async () => {
  let availabilityAttempts = 0;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/appointments?")) return [appointment];
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
      <AgendaPage />
    </QueryHarness>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar a disponibilidade do médico.",
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

  expect(
    await screen.findByRole("table", { name: "Calendário de agosto de 2026" }),
  ).toBeVisible();
  expect(availabilityAttempts).toBe(2);
});

test("anuncia o desafio criado e remove somente o marcador com replace", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda?date=2026-08-10&appointmentId=${appointmentId}&created=true`,
  );
  let dismissSuccess: (() => void) | null = null;
  const nativeSetTimeout = window.setTimeout.bind(window);
  vi.spyOn(window, "setTimeout").mockImplementation(
    (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 4_000) {
        dismissSuccess = () => {
          if (typeof handler === "function") handler(...args);
        };
        return 4_000;
      }
      return nativeSetTimeout(handler, timeout, ...args);
    },
  );
  const replaceSpy = vi.spyOn(window.history, "replaceState");

  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("status", { name: "Agendamento aguardando paciente" }),
  ).toHaveTextContent(
    "Aguardando a confirmação do paciente e o compartilhamento dos dados com o médico",
  );
  expect(dismissSuccess).not.toBeNull();

  act(() => dismissSuccess?.());

  await waitFor(() =>
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      `/app/agenda?date=2026-08-10&appointmentId=${appointmentId}`,
    ),
  );
  expect(replaceSpy).toHaveBeenCalled();
  expect(
    screen.queryByRole("status", { name: "Agendamento aguardando paciente" }),
  ).not.toBeInTheDocument();
});

test("explica que o novo agendamento aguarda confirmação e compartilhamento", async () => {
  window.history.replaceState(
    {},
    "",
    `/app/agenda?date=2026-08-10&appointmentId=${awaitingPatientAppointment.id}&created=true`,
  );
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/appointments?")) return [awaitingPatientAppointment];
    if (path === `/appointments/${awaitingPatientAppointment.id}`) {
      return awaitingPatientAppointment;
    }
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("status", {
      name: "Agendamento aguardando paciente",
    }),
  ).toHaveTextContent(
    "Aguardando a confirmação do paciente e o compartilhamento dos dados com o médico",
  );
});

test.each(["nao-e-guid", "%2Fadmin%2Fsegredo"])(
  "ignora appointmentId inválido sem buscar detalhe: %s",
  async (invalidId) => {
    window.history.replaceState(
      {},
      "",
      `/app/agenda?date=2026-08-10&appointmentId=${invalidId}&created=true`,
    );
    render(
      <QueryHarness>
        <AgendaPage />
      </QueryHarness>,
    );

    expect(
      await screen.findByRole("heading", { name: "Dra. Helena Costa" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("status", { name: "Consulta agendada" }),
    ).toHaveTextContent("Consulta agendada com sucesso.");
    expect(
      requestMock.mock.calls.some(([path]) =>
        /^\/appointments\/[^?]/.test(String(path)),
      ),
    ).toBe(false);
  },
);

test("recupera falha da agenda com nova tentativa", async () => {
  let attempts = 0;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path.startsWith("/appointments?")) {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return [appointment];
    }
    if (path.startsWith(`/doctors/${doctorId}/availability`)) return availability;
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar as consultas deste dia.",
  );

  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

  const timeline = await findTimeline();
  expect(await within(timeline).findByText("Marina Oliveira")).toBeVisible();
  expect(attempts).toBe(2);
});
