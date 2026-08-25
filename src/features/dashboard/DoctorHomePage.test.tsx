import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import type { Appointment, AuthResponse, Clinic } from "../../api/types";
import { DoctorHomePage } from "./DoctorHomePage";

const doctorId = "20000000-0000-4000-8000-000000000001";
const patientId = "30000000-0000-4000-8000-000000000001";

const session: AuthResponse = {
  userId: doctorId,
  email: "helena@example.test",
  clinicId: "10000000-0000-4000-8000-000000000001",
  roles: ["Doctor"],
  name: "Dra. Helena Costa",
  tokens: {
    accessToken: "token",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};
let activeSession: AuthResponse = session;
let requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: activeSession }),
}));

const clinic: Clinic = {
  id: session.clinicId,
  name: "Clínica Vital",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Unidade Paulista · consultório 3",
  defaultAppointmentDurationMinutes: 30,
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: null,
  createdAtUtc: "2026-08-01T12:00:00Z",
};

function appointment(
  overrides: Partial<Appointment> & Pick<Appointment, "id" | "patientName" | "startUtc" | "endUtc" | "status">,
): Appointment {
  return {
    patientId,
    doctorUserId: doctorId,
    type: "InPerson",
    notes: null,
    createdAtUtc: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

const appointments: Appointment[] = [
  appointment({
    id: "40000000-0000-4000-8000-000000000001",
    patientName: "Marina Lopes Castro",
    startUtc: "2026-08-10T11:00:00Z",
    endUtc: "2026-08-10T11:30:00Z",
    status: "Realizada",
    notes: "Retorno com exames recentes",
  }),
  appointment({
    id: "40000000-0000-4000-8000-000000000002",
    patientName: "Roberto Nunes Vidal",
    startUtc: "2026-08-10T12:00:00Z",
    endUtc: "2026-08-10T12:40:00Z",
    status: "Confirmada",
    notes: "Dor epigástrica há 3 meses",
  }),
  appointment({
    id: "40000000-0000-4000-8000-000000000003",
    patientName: "Helena Braga Ferreira",
    startUtc: "2026-08-10T13:00:00Z",
    endUtc: "2026-08-10T13:30:00Z",
    status: "ConfirmacaoEnviada",
    type: "Teleconsultation",
  }),
];

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-10T09:15:00-03:00"));
  activeSession = session;
  window.history.replaceState({}, "", "/app/inicio?date=2026-08-10");
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path.startsWith("/appointments?")) {
      expect(path).toContain(`doctorId=${doctorId}`);
      return appointments;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});

afterEach(() => vi.useRealTimers());

test.each([
  { profile: "médico", roles: ["Doctor"] as const },
  { profile: "médico administrador", roles: ["Admin", "Doctor"] as const },
])("mostra o dashboard pessoal para o $profile", async ({ roles }) => {
  activeSession = { ...session, roles: [...roles] };
  const user = userEvent.setup();

  render(
    <Harness>
      <DoctorHomePage />
    </Harness>,
  );

  expect(
    await screen.findByRole("heading", { name: "Bom dia, Dra. Helena" }),
  ).toBeVisible();
  expect(screen.getByText(/Clínica Vital/)).toBeVisible();

  const agenda = screen.getByRole("region", { name: "Agenda do dia" });
  expect(await within(agenda).findByText("Roberto Nunes Vidal")).toBeVisible();
  expect(within(agenda).getAllByText("Em atendimento").length).toBeGreaterThan(0);

  const focus = screen.getByRole("region", { name: "Roberto Nunes Vidal" });
  expect(within(focus).getByText("Dor epigástrica há 3 meses")).toBeVisible();
  expect(within(focus).getByRole("button", { name: "Transcrever" })).toBeVisible();

  const pending = screen.getByRole("region", { name: "Pendências" });
  expect(within(pending).getByText("Helena Braga Ferreira")).toBeVisible();

  const week = screen.getByRole("region", { name: "Sua semana" });
  expect(
    within(week).getAllByRole("definition").map((item) => item.textContent),
  ).toEqual(["1", "1", "1", "0"]);

  await user.click(screen.getByRole("button", { name: "Nova consulta" }));
  expect(`${window.location.pathname}${window.location.search}`).toBe(
    `/app/agenda/nova?date=2026-08-10&doctorId=${doctorId}&origin=home`,
  );
});

test("navega pelos dias mantendo o contexto na URL", async () => {
  const user = userEvent.setup();
  render(
    <Harness>
      <DoctorHomePage />
    </Harness>,
  );

  await screen.findByRole("heading", { name: "Agenda do dia" });
  await user.click(screen.getByRole("button", { name: "Próximo dia" }));

  expect(window.location.search).toBe("?date=2026-08-11");
  expect(await screen.findByText(/11 de agosto/)).toBeVisible();
  expect(screen.getByText("Nenhuma consulta neste dia")).toBeVisible();
});

test("oferece nova tentativa quando a agenda falha", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path.startsWith("/appointments?")) throw new Error("offline");
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <Harness>
      <DoctorHomePage />
    </Harness>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar suas consultas.",
  );
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("não oferece transcrição quando o acesso do paciente é necessário", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/current") return clinic;
    if (path.startsWith("/appointments?")) {
      return [
        appointment({
          id: "40000000-0000-4000-8000-000000000010",
          patientName: "Paciente sem acesso",
          startUtc: "2026-08-10T12:00:00Z",
          endUtc: "2026-08-10T12:40:00Z",
          status: "AccessRequired",
        }),
      ];
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <Harness>
      <DoctorHomePage />
    </Harness>,
  );

  expect(
    await screen.findByRole("region", { name: "Paciente sem acesso" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Transcrever" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Abrir prontuário" }),
  ).toBeVisible();
});
