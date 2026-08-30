import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { AuthResponse } from "../api/types";
import { App } from "./App";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiRequest,
}));

function contextualSession(
  clinicRole: "Doctor" | "Nurse" | "Secretary",
  isAdmin: boolean,
  roles: AuthResponse["roles"],
): AuthResponse {
  return {
    userId: "user-1",
    name: "Pessoa da clínica",
    email: "pessoa@clinic.test",
    phone: "+5511999999999",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    userClinicId: "membership-1",
    clinicRole,
    isAdmin,
    roles,
    availableClinics: [{
      userClinicId: "membership-1",
      clinicId: "clinic-1",
      clinicName: "Clínica Centro",
      role: clinicRole,
      isAdmin,
    }],
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    },
  };
}

describe("App routing", () => {
  beforeEach(() => {
    sessionStorage.clear();
    if (typeof localStorage.removeItem === "function") {
      localStorage.removeItem("clinicflow.session");
    }
    window.history.replaceState({}, "", "/");
    apiRequest.mockReset();
    apiRequest.mockResolvedValue([]);
  });

  test("abre o login ao acessar a raiz sem sessão", async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/entrar");
  });

  test("abre o cadastro inicial sem exigir sessão", async () => {
    window.history.replaceState({}, "", "/cadastro");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Comece pela sua conta" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/cadastro");
  });

  test("abre a ação pública sem exigir sessão", async () => {
    window.history.replaceState({}, "", "/acao-paciente/opaque-reference");
    apiRequest.mockResolvedValue({
      actionType: "AppointmentWithDataSharing",
      status: "Pending",
      termsVersion: "appointment-with-data-sharing-v1",
      snapshot: {
        clinicName: "Clínica Horizonte",
        doctorName: "Dra. Helena Costa",
        scheduledStartUtc: "2026-08-27T12:00:00Z",
        dataSharing: "Dados necessários ao atendimento.",
      },
      requestedAtUtc: "2026-08-25T12:00:00Z",
      expiresAtUtc: "2099-08-27T12:00:00Z",
      challengeStatus: "Sent",
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Confirme sua consulta" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/acao-paciente/opaque-reference");
    expect(apiRequest).toHaveBeenCalledWith(
      "/public/patient-actions/opaque-reference",
    );
  });

  test("abre o convite médico público sem exigir sessão e mantém a referência fora da URL da API", async () => {
    window.history.replaceState({}, "", "/convite-medico/opaque-reference");
    apiRequest.mockResolvedValue({
      clinicName: "Clínica Horizonte",
      inviteeName: "Dra. Helena Costa",
      role: "Doctor",
      emailMasked: "he***@exemplo.com",
      expiresAtUtc: "2099-08-31T12:00:00Z",
      mode: "SetInitialPassword",
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Ative seu acesso à clínica" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/convite-medico/opaque-reference");
    expect(apiRequest).toHaveBeenCalledWith(
      "/public/clinic-membership-invitations/resolve",
      {
        method: "POST",
        body: JSON.stringify({ reference: "opaque-reference" }),
      },
    );
  });

  test("admin de secretaria não entra em rota clínica profunda", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Doctor", "Admin"])),
    );
    window.history.replaceState(
      {},
      "",
      "/app/pacientes/30000000-0000-4000-8000-000000000001/exames",
    );

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/agenda"));
  });

  test("administração contextual mantém acesso à equipe", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Secretary", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/equipe");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/equipe"));
    expect(window.location.pathname).not.toBe("/app/agenda");
  });

  test("array legado não libera equipe no contexto de enfermagem", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Nurse", false, ["Nurse", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/equipe");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/agenda"));
  });

  test("médico abre a configuração de disponibilidade da clínica atual", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Doctor", false, ["Doctor"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/agenda");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/clinics/current") {
        return {
          id: "clinic-1",
          name: "Clínica Centro",
          timeZoneId: "America/Sao_Paulo",
          phone: "+551130000000",
          address: "Rua das Flores, 100",
          plan: "Clinic",
          subscriptionStatus: "Active",
          maxDoctors: 10,
          createdAtUtc: "2026-08-01T12:00:00Z",
        };
      }
      if (path === "/doctors/user-1/schedule") {
        return {
          doctorUserId: "user-1",
          slotDurationMinutes: 30,
          intervals: [],
          blocks: [],
        };
      }
      return [];
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/app/configuracoes/agenda");
  });

  test("enfermagem sem administração não abre configuração de disponibilidade", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Nurse", false, ["Nurse"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/agenda");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/agenda"));
  });
});
