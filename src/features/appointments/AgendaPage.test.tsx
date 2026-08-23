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
  clinicId,
  roles: ["Secretary"],
  name: "Secretaria",
  tokens: {
    accessToken: "token",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session }),
}));

const clinic: Clinic = {
  id: clinicId,
  name: "Clínica Vital",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Rua Clínica, 10",
  defaultAppointmentDurationMinutes: 30,
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: null,
  createdAtUtc: "2026-08-01T12:00:00Z",
};
const members: Member[] = [
  {
    userId: doctorId,
    email: "helena@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    specialty: "Cardiologia",
  },
  {
    userId: secondDoctorId,
    email: "paulo@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dr. Paulo Nunes",
    specialty: "Neurologia",
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
  status: "Agendada",
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
  status: "Confirmada",
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
  status: "Cancelada",
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
  status: "Confirmada",
  notes: null,
  createdAtUtc: "2026-08-06T12:00:00Z",
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
    if (path === "/clinics/members") return members;
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
  window.history.replaceState({}, "", "/app/agenda?date=2026-08-10");
  mockAgenda();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("abre a página dedicada já vinculada ao médico ativo", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Nova consulta · Dra. Helena" }),
  );

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}`,
  );
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
    within(timeline).getAllByRole("button", { name: /disponível — agendar/ }),
  ).toHaveLength(2);
  expect(within(timeline).getByText("Intervalo · 10:00 – 10:30")).toBeVisible();
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
});

test("troca o dia pelo calendário e mantém a data na URL", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <AgendaPage />
    </QueryHarness>,
  );

  await user.click(
    await screen.findByRole("button", {
      name: "11 de agosto de 2026, sem consultas",
    }),
  );

  expect(`${window.location.pathname}${window.location.search}`).toBe(
    "/app/agenda?date=2026-08-11",
  );
  expect(
    await screen.findByText(/Terça-feira, 11 de agosto de 2026/),
  ).toBeVisible();
});

test("anuncia a consulta criada e remove somente o marcador com replace", async () => {
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
    await screen.findByRole("status", { name: "Consulta agendada" }),
  ).toHaveTextContent(
    "Consulta agendada: Dra. Helena Costa, 10 de agosto de 2026 às 09:00 (Presencial)",
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
    screen.queryByRole("status", { name: "Consulta agendada" }),
  ).not.toBeInTheDocument();
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
    if (path === "/clinics/members") return members;
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
