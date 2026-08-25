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
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    userClinicId: "membership-1",
    clinicRole,
    isAdmin,
    roles,
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
});
