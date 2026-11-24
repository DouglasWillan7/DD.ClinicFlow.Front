import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { CurrentUser, DoctorSchedule } from "../../api/types";
import { ProfileSettingsPage } from "./ProfileSettingsPage";

const doctorId = "11111111-1111-1111-1111-111111111111";
let requestMock = vi.fn();
let profile: CurrentUser;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, updateSessionName: vi.fn() }),
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
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
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
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

test("médico edita a própria disponibilidade em Meu perfil, com salvar separado da conta", async () => {
  const user = userEvent.setup();
  render(<Harness><ProfileSettingsPage /></Harness>);

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

test("quem não é médico não vê nem carrega disponibilidade", async () => {
  profile = { ...profile, role: "Secretary", medicalLicense: null, specialty: null };
  render(<Harness><ProfileSettingsPage /></Harness>);

  expect(await screen.findByText(/não possui atuação médica/i)).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith("/users/me"));
  expect(
    requestMock.mock.calls.some(([path]) => String(path).includes("/schedule")),
  ).toBe(false);
});
