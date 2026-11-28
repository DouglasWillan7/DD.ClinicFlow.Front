import { render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { ApiError } from "../api/client";
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

  test("secretaria não abre as receitas do paciente e volta para a agenda", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", false, ["Secretary"])),
    );
    window.history.replaceState(
      {},
      "",
      "/app/pacientes/30000000-0000-4000-8000-000000000001/receitas?acao=nova",
    );

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/agenda"));
    expect(
      apiRequest.mock.calls.map(([path]) => path).filter((path) => String(path).startsWith("/prescriptions")),
    ).toEqual([]);
  });

  test("médico abre as receitas do paciente pela rota própria", async () => {
    const patientId = "30000000-0000-4000-8000-000000000001";
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Doctor", false, ["Doctor"])),
    );
    window.history.replaceState({}, "", `/app/pacientes/${patientId}/receitas`);
    apiRequest.mockImplementation(async (path: string) => {
      if (path === `/patients/${patientId}`) {
        return {
          id: patientId,
          documentCountryCode: "BR",
          documentType: "CPF",
          document: "52998224725",
          name: "Rita de Cássia Alves",
          phone: "",
          email: null,
          birthDate: null,
          isActive: true,
          createdAtUtc: "2025-01-01T12:00:00Z",
        };
      }
      if (path === `/prescriptions/patients/${patientId}`) {
        return { items: [], capabilities: { canIssue: true } };
      }
      return [];
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Receitas" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe(`/app/pacientes/${patientId}/receitas`);
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

  test("o link antigo de disponibilidade leva o médico à aba de Meu perfil", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Doctor", true, ["Doctor", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/agenda");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          userId: "user-1",
          email: "pessoa@clinic.test",
          phone: "+5511999999999",
          name: "Pessoa da clínica",
          role: "Doctor",
          isAdmin: true,
          medicalLicense: null,
          medicalLicenseState: null,
          specialty: null,
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

    await waitFor(() =>
      expect(window.location.pathname).toBe("/app/configuracoes/perfil/disponibilidade"),
    );
    expect(
      await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
    ).toBeVisible();
  });

  test("o link antigo de disponibilidade leva a administração à aba do primeiro médico", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Secretary", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/agenda");
    const doctor = {
      userClinicId: "doctor-membership",
      userId: "doctor-user",
      clinicId: "clinic-1",
      displayName: "Dra. Helena Martins",
      status: "Active",
      role: "Doctor",
      isAdmin: false,
      isOwner: false,
      email: "helena@centro.test",
      phone: "+5511999998888",
      emailConfirmedAtUtc: "2026-08-01T10:00:00Z",
      phoneConfirmedAtUtc: null,
      doctorProfile: {
        professionalAuthority: "CRM",
        professionalRegistrationNumber: "123",
        professionalRegistrationRegion: "SP",
        professionalRegistrationCountryCode: "BR",
        specialty: null,
        practiceAreas: null,
        bio: null,
        defaultAppointmentDurationMinutes: 30,
      },
      defaultAppointmentDurationSource: "Configured",
      sessionVersion: 1,
      createdAtUtc: "2026-08-01T10:00:00Z",
      updatedAtUtc: "2026-08-01T10:00:00Z",
    };
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/clinics/clinic-1/members/summary") {
        return [
          { userClinicId: "membership-1", userId: "user-1", displayName: "Pessoa da clínica", role: "Secretary", isAdmin: true, specialty: null, defaultAppointmentDurationMinutes: null },
          { userClinicId: "doctor-membership", userId: "doctor-user", displayName: "Dra. Helena Martins", role: "Doctor", isAdmin: false, specialty: null, defaultAppointmentDurationMinutes: 30 },
        ];
      }
      if (path === "/clinics/clinic-1/members") return [doctor];
      if (path === "/doctors/doctor-user/schedule") {
        return {
          doctorUserId: "doctor-user",
          slotDurationMinutes: 30,
          intervals: [],
          blocks: [],
        };
      }
      return [];
    });

    render(<App />);

    await waitFor(() =>
      expect(window.location.pathname).toBe("/app/equipe/doctor-membership/disponibilidade"),
    );
    expect(
      await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
    ).toBeVisible();
    const tabs = within(screen.getByRole("navigation", { name: "Seções do perfil" }));
    expect(tabs.getByRole("link", { name: "Disponibilidade" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("administração sem médico na clínica cai no cadastro de médico", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Secretary", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/agenda");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/clinics/clinic-1/members/summary") {
        return [
          { userClinicId: "membership-1", userId: "user-1", displayName: "Pessoa da clínica", role: "Secretary", isAdmin: true, specialty: null, defaultAppointmentDurationMinutes: null },
        ];
      }
      return [];
    });

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/equipe/novo"));
  });

  test("médico abre a aba Disponibilidade de Meu perfil pela rota própria", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Doctor", false, ["Doctor"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/perfil/disponibilidade");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          userId: "user-1",
          email: "pessoa@clinic.test",
          phone: "+5511999999999",
          name: "Pessoa da clínica",
          role: "Doctor",
          isAdmin: false,
          medicalLicense: null,
          medicalLicenseState: null,
          specialty: null,
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
    const tabs = within(screen.getByRole("navigation", { name: "Meu perfil" }));
    expect(tabs.getByRole("link", { name: "Disponibilidade" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(window.location.pathname).toBe("/app/configuracoes/perfil/disponibilidade");
  });

  test.each([
    "/app/configuracoes/perfil/disponibilidade",
    "/app/configuracoes/perfil/convenios",
  ])("quem não atende como médico volta para a conta ao abrir %s", async (path) => {
    // Administrar a clínica não dá agenda nem convênios próprios.
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Secretary", "Admin"])),
    );
    window.history.replaceState({}, "", path);

    render(<App />);

    await waitFor(() =>
      expect(window.location.pathname).toBe("/app/configuracoes/perfil"),
    );
    expect(
      apiRequest.mock.calls
        .map(([requested]) => String(requested))
        .filter((requested) => requested.includes("/schedule") || requested.includes("healthcare-plans")),
    ).toEqual([]);
  });

  test("administração abre o receituário como aba da configuração da clínica", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Secretary", true, ["Secretary", "Admin"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/clinica/receituario");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/clinics/prescription-template") {
        throw new ApiError("Receituário não encontrado.", 404);
      }
      return [];
    });

    render(<App />);

    expect(await screen.findByText("A clínica usa o cabeçalho padrão")).toBeVisible();
    expect(window.location.pathname).toBe("/app/configuracoes/clinica/receituario");
  });

  test("médico sem administração não abre o receituário e volta ao início", async () => {
    sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(contextualSession("Doctor", false, ["Doctor"])),
    );
    window.history.replaceState({}, "", "/app/configuracoes/clinica/receituario");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/app/inicio"));
    expect(
      apiRequest.mock.calls.map(([path]) => path).filter((path) => String(path).includes("prescription-template")),
    ).toEqual([]);
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
