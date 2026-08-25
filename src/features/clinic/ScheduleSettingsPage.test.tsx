import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AuthResponse,
  Clinic,
  DoctorSchedule,
  Member,
  UpdateDoctorScheduleRequest,
} from "../../api/types";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";

const doctorId = "11111111-1111-1111-1111-111111111111";
const secondDoctorId = "22222222-2222-2222-2222-222222222222";
const clinicId = "33333333-3333-3333-3333-333333333333";
let requestMock = vi.fn();
let session: AuthResponse;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session }),
}));

const clinic: Clinic = {
  id: clinicId,
  name: "Clínica Horizonte",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Rua das Flores, 100",
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: 10,
  createdAtUtc: "2026-08-01T12:00:00Z",
};

const schedule: DoctorSchedule = {
  doctorUserId: doctorId,
  slotDurationMinutes: 30,
  blocks: [],
  intervals: [
    {
      id: "interval-1",
      dayOfWeek: "Monday",
      startLocal: "08:00:00",
      endLocal: "12:00:00",
    },
  ],
};

const doctors: Member[] = [
  {
    userClinicId: "membership-1",
    userId: doctorId,
    displayName: "Dra. Marina Lopes",
    role: "Doctor",
    isAdmin: true,
    specialty: "Gastroenterologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "membership-2",
    userId: secondDoctorId,
    displayName: "Dr. André Costa",
    role: "Doctor",
    isAdmin: false,
    specialty: "Clínica médica",
    defaultAppointmentDurationMinutes: 45,
  },
];

function doctorSession(isAdmin = false): AuthResponse {
  return {
    userId: doctorId,
    name: "Dra. Marina Lopes",
    email: "marina@example.test",
    phone: "+5511999999999",
    clinicId,
    clinicName: clinic.name,
    userClinicId: "membership-1",
    clinicRole: "Doctor",
    isAdmin,
    roles: isAdmin ? ["Doctor", "Admin"] : ["Doctor"],
    availableClinics: [],
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresAtUtc: "2026-08-25T20:00:00Z",
    },
  };
}

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPage() {
  return render(
    <Harness>
      <ScheduleSettingsPage />
    </Harness>,
  );
}

beforeEach(() => {
  session = doctorSession();
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current") return clinic;
    if (path === `/doctors/${doctorId}/schedule` && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as UpdateDoctorScheduleRequest;
      return {
        ...schedule,
        slotDurationMinutes: body.defaultAppointmentDurationMinutes,
        intervals: body.intervals.map((interval, index) => ({
          id: `saved-${index}`,
          ...interval,
        })),
      };
    }
    if (path === `/doctors/${doctorId}/schedule`) return schedule;
    throw new Error(`Rota inesperada: ${path}`);
  });
});

describe("ScheduleSettingsPage", () => {
  test("médico salva duração, dias e múltiplos períodos da própria clínica", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Dra. Marina Lopes")).toBeVisible();
    await user.clear(screen.getByLabelText("Duração da consulta (minutos)"));
    await user.type(screen.getByLabelText("Duração da consulta (minutos)"), "45");
    await user.click(screen.getByRole("button", { name: "Adicionar período" }));
    await user.click(screen.getByLabelText(/Terça-feira/));
    await user.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

    await waitFor(() => {
      const put = requestMock.mock.calls.find(
        ([path, init]) => path === `/doctors/${doctorId}/schedule` && init?.method === "PUT",
      );
      expect(JSON.parse(String(put?.[1]?.body))).toEqual({
        defaultAppointmentDurationMinutes: 45,
        intervals: [
          { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
          { dayOfWeek: "Monday", startLocal: "12:00", endLocal: "13:00" },
          { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "12:00" },
        ],
      });
    });
    expect(await screen.findByText("Disponibilidade atualizada.")).toBeVisible();
  });

  test("sobreposição impede envio e mantém os valores editados", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Dra. Marina Lopes");
    await user.click(screen.getByRole("button", { name: "Adicionar período" }));
    const secondStart = screen.getByLabelText("Segunda-feira, período 2, início");
    await user.clear(secondStart);
    await user.type(secondStart, "11:30");
    await user.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

    expect(
      await screen.findByText("Os períodos de Segunda-feira não podem se sobrepor."),
    ).toBeVisible();
    expect(secondStart).toHaveValue("11:30");
    expect(requestMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  test("administrador seleciona e carrega outro médico", async () => {
    session = doctorSession(true);
    requestMock = vi.fn(async (path: string) => {
      if (path === "/clinics/current") return clinic;
      if (path === `/clinics/${clinicId}/members/summary`) return doctors;
      if (path === `/doctors/${doctorId}/schedule`) return schedule;
      if (path === `/doctors/${secondDoctorId}/schedule`) {
        return { ...schedule, doctorUserId: secondDoctorId, slotDurationMinutes: 45 };
      }
      throw new Error(`Rota inesperada: ${path}`);
    });
    const user = userEvent.setup();
    renderPage();

    const selector = await screen.findByLabelText("Médico");
    await user.selectOptions(selector, secondDoctorId);

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(`/doctors/${secondDoctorId}/schedule`),
    );
    expect(screen.getByRole("heading", { name: "Dr. André Costa" })).toBeVisible();
    expect(screen.getByLabelText("Duração da consulta (minutos)")).toHaveValue(45);
  });

  test("orienta o administrador quando ainda não existe médico", async () => {
    session = doctorSession(true);
    requestMock = vi.fn(async (path: string) => {
      if (path === "/clinics/current") return clinic;
      if (path === `/clinics/${clinicId}/members/summary`) return [];
      throw new Error(`Rota inesperada: ${path}`);
    });
    renderPage();

    const empty = await screen.findByRole("heading", {
      name: "Adicione um médico antes de configurar horários",
    });
    expect(empty).toBeVisible();
    expect(within(empty.closest("section")!).getByRole("link", { name: "Adicionar médico" }))
      .toHaveAttribute("href", "/app/equipe/novo");
  });
});
