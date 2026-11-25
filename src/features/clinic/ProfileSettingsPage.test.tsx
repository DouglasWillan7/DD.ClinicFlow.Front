import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type {
  CurrentUser,
  DoctorSchedule,
  UserClinicHealthcarePlans,
} from "../../api/types";
import { UnsavedChangesProvider } from "../../app/unsavedChanges";
import {
  ProfileAvailabilityPage,
  ProfilePlansPage,
  ProfileSettingsPage,
} from "./profileSettingsPages";

const doctorId = "11111111-1111-1111-1111-111111111111";
const ownPlansPath = "/clinics/clinic-1/members/membership-1/healthcare-plans";
let requestMock = vi.fn();
let profile: CurrentUser;
let isAdmin = false;
let ownPlans: UserClinicHealthcarePlans;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    session: {
      userId: doctorId,
      clinicId: "clinic-1",
      userClinicId: "membership-1",
      clinicRole: profile.role,
      isAdmin,
    },
    request: requestMock,
    updateSessionName: vi.fn(),
  }),
}));

const schedule: DoctorSchedule = {
  doctorUserId: doctorId,
  slotDurationMinutes: 30,
  blocks: [],
  intervals: [
    { id: "interval-1", dayOfWeek: "Monday", startLocal: "08:00:00", endLocal: "12:00:00" },
  ],
};

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </QueryClientProvider>
  );
}

function requestedPaths() {
  return requestMock.mock.calls.map(([path]) => String(path));
}

beforeEach(() => {
  // As abas usam o roteador real: a aba atual sai do endereço.
  window.history.replaceState({}, "", "/app/configuracoes/perfil");
  profile = {
    userId: doctorId,
    email: "marina@example.test",
    phone: "+5511999999999",
    name: "Dra. Marina Lopes",
    role: "Doctor",
    isAdmin: false,
    medicalLicense: "12345",
    medicalLicenseState: "SP",
    specialty: "Gastroenterologia",
  };
  isAdmin = false;
  ownPlans = {
    userClinicId: "membership-1",
    mode: "ClinicDefault",
    healthcarePlanIds: ["plan-unimed"],
  };
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/healthcare-plans") {
      return [
        { id: "plan-unimed", name: "Unimed" },
        { id: "plan-amil", name: "Amil" },
      ];
    }
    if (path === "/clinics/current/healthcare-plans") {
      return {
        healthcarePlanIds: ["plan-unimed", "plan-amil"],
        defaultHealthcarePlanIds: ["plan-unimed"],
      };
    }
    if (path === ownPlansPath) {
      if (init?.method !== "PUT") return ownPlans;
      const body = JSON.parse(String(init.body));
      return { ...ownPlans, mode: body.mode, healthcarePlanIds: body.healthcarePlanIds };
    }
    if (path === "/users/me") return profile;
    if (path === "/clinics/current") return { timeZoneId: "America/Sao_Paulo" };
    if (path === `/doctors/${doctorId}/schedule`) {
      return init?.method === "PUT"
        ? { ...schedule, intervals: [] }
        : schedule;
    }
    throw new Error(`Rota inesperada: ${path}`);
  });
});

test("médico navega por Conta, Disponibilidade e Convênios, com a conta como entrada", async () => {
  render(<Harness><ProfileSettingsPage /></Harness>);

  const tabs = within(screen.getByRole("navigation", { name: "Meu perfil" }));
  expect(tabs.getByRole("link", { name: "Conta" })).toHaveAttribute("aria-current", "page");
  expect(tabs.getByRole("link", { name: "Disponibilidade" })).toHaveAttribute(
    "href",
    "/app/configuracoes/perfil/disponibilidade",
  );
  expect(tabs.getByRole("link", { name: "Convênios" })).toHaveAttribute(
    "href",
    "/app/configuracoes/perfil/convenios",
  );

  expect(await screen.findByLabelText("Registro profissional")).toHaveValue("12345");
  // Cada aba carrega só o que mostra: a conta não busca agenda nem convênios.
  expect(
    screen.queryByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).not.toBeInTheDocument();
  expect(
    requestedPaths().some(
      (path) => path.includes("/schedule") || path.includes("healthcare-plans"),
    ),
  ).toBe(false);
});

test("o cabeçalho é o mesmo nas três abas e a aba atual acompanha o endereço", async () => {
  window.history.replaceState({}, "", "/app/configuracoes/perfil/convenios");
  render(<Harness><ProfilePlansPage /></Harness>);

  expect(screen.getByRole("heading", { level: 1, name: "Meu perfil" })).toBeVisible();
  const tabs = within(screen.getByRole("navigation", { name: "Meu perfil" }));
  expect(tabs.getByRole("link", { name: "Convênios" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(tabs.getByRole("link", { name: "Conta" })).not.toHaveAttribute("aria-current");
  expect(await screen.findByRole("heading", { name: "Convênios" })).toBeVisible();
  expect(screen.queryByLabelText("Registro profissional")).not.toBeInTheDocument();
});

test("trocar de aba com a conta alterada pede confirmação antes de descartar", async () => {
  const user = userEvent.setup();
  render(<Harness><ProfileSettingsPage /></Harness>);

  const name = await screen.findByLabelText("Nome");
  await waitFor(() => expect(name).toHaveValue("Dra. Marina Lopes"));
  await user.type(name, " Silva");
  await user.click(screen.getByRole("link", { name: "Disponibilidade" }));

  expect(await screen.findByText("Descartar alterações?")).toBeVisible();
  expect(window.location.pathname).toBe("/app/configuracoes/perfil");

  await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(name).toHaveValue("Dra. Marina Lopes Silva");
});

test("salvar a conta libera a troca de aba sem aviso", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/users/me" && init?.method === "PUT") {
      return { ...profile, ...JSON.parse(String(init.body)) };
    }
    if (path === "/users/me") return profile;
    throw new Error(`Rota inesperada: ${path}`);
  });
  render(<Harness><ProfileSettingsPage /></Harness>);

  const name = await screen.findByLabelText("Nome");
  await waitFor(() => expect(name).toHaveValue("Dra. Marina Lopes"));
  await user.type(name, " Silva");
  await user.click(screen.getByRole("button", { name: "Salvar conta" }));
  expect(await screen.findByText("Perfil atualizado.")).toBeVisible();

  await user.click(screen.getByRole("link", { name: "Disponibilidade" }));
  expect(screen.queryByText("Descartar alterações?")).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/app/configuracoes/perfil/disponibilidade");
});

test("médico edita a própria disponibilidade na aba Disponibilidade, com salvar separado da conta", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/app/configuracoes/perfil/disponibilidade");
  render(<Harness><ProfileAvailabilityPage /></Harness>);

  expect(
    await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Segunda-feira, período 1, início")).toHaveValue("08:00");

  await user.click(screen.getByRole("checkbox", { name: /Segunda-feira/ }));
  await user.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

  expect(await screen.findByText("Disponibilidade atualizada.")).toBeVisible();
  const writes = requestMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(`/doctors/${doctorId}/schedule`);
  expect(JSON.parse(String(writes[0][1].body))).toEqual({
    defaultAppointmentDurationMinutes: 30,
    intervals: [],
  });
});

test("horário alterado e não salvo segura a troca de aba", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/app/configuracoes/perfil/disponibilidade");
  render(<Harness><ProfileAvailabilityPage /></Harness>);

  await user.click(await screen.findByRole("checkbox", { name: /Segunda-feira/ }));
  await user.click(screen.getByRole("link", { name: "Conta" }));

  expect(await screen.findByText("Descartar alterações?")).toBeVisible();
  expect(window.location.pathname).toBe("/app/configuracoes/perfil/disponibilidade");
});

test("quem não é médico só tem a conta: sem abas, sem disponibilidade e sem convênios", async () => {
  profile = { ...profile, role: "Secretary", medicalLicense: null, specialty: null };
  render(<Harness><ProfileSettingsPage /></Harness>);

  expect(await screen.findByText(/não possui atuação médica/i)).toBeVisible();
  expect(screen.getByLabelText("Nome")).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Meu perfil" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith("/users/me"));
  expect(
    requestMock.mock.calls.some(([path]) => String(path).includes("/schedule")),
  ).toBe(false);
  expect(
    screen.queryByRole("heading", { name: "Convênios" }),
  ).not.toBeInTheDocument();
  expect(
    requestMock.mock.calls.some(([path]) => String(path).includes("healthcare-plans")),
  ).toBe(false);
});

test("médico administrador escolhe os próprios convênios na aba Convênios", async () => {
  isAdmin = true;
  const user = userEvent.setup();
  render(<Harness><ProfilePlansPage /></Harness>);

  expect(
    await screen.findByRole("heading", { name: "Convênios" }),
  ).toBeVisible();
  expect(await screen.findByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
  // Sem mudança não há o que salvar.
  expect(screen.getByRole("button", { name: "Salvar convênios" })).toBeDisabled();

  await user.click(screen.getByRole("radio", { name: /Personalizado/ }));
  await user.click(screen.getByRole("checkbox", { name: "Amil" }));
  await user.click(screen.getByRole("button", { name: "Salvar convênios" }));

  expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
  const writes = requestMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(ownPlansPath);
  expect(JSON.parse(String(writes[0][1].body))).toEqual({
    mode: "Custom",
    healthcarePlanIds: ["plan-unimed", "plan-amil"],
  });
  expect(screen.getByRole("radio", { name: /Personalizado/ })).toBeChecked();
});

test("médico que não administra a clínica só consulta os próprios convênios", async () => {
  ownPlans = { ...ownPlans, mode: "Custom", healthcarePlanIds: ["plan-amil"] };
  render(<Harness><ProfilePlansPage /></Harness>);

  expect(
    await screen.findByRole("heading", { name: "Convênios" }),
  ).toBeVisible();
  const list = await screen.findByRole("list", { name: "Convênios que você atende" });
  expect(list).toHaveTextContent("Amil");
  expect(list).not.toHaveTextContent("Unimed");
  expect(screen.getByText("Personalizado")).toBeVisible();
  expect(
    screen.getByText(/definidos pela administração da clínica/i),
  ).toBeVisible();
  expect(screen.queryByRole("radio", { name: /Personalizado/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
});

test("médico sem convênios vê que atende apenas particular", async () => {
  ownPlans = { ...ownPlans, mode: "Custom", healthcarePlanIds: [] };
  render(<Harness><ProfilePlansPage /></Harness>);

  expect(
    await screen.findByText("Você atende apenas consulta particular nesta clínica."),
  ).toBeVisible();
});

