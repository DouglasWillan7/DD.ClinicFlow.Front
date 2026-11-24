import { render, screen, waitFor } from "@testing-library/react";
import type { AuthResponse } from "../api/types";
import { App } from "./App";

// Arquivo próprio: o QueryClient do App é único por módulo, e o progresso em cache de
// outro teste de rota (que responde `[]` a tudo) chegaria aqui no lugar do mock.
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiRequest,
}));

function session(
  clinicRole: "Doctor" | "Secretary",
  isAdmin: boolean,
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
    roles: isAdmin ? [clinicRole, "Admin"] : [clinicRole],
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

beforeEach(() => {
  sessionStorage.clear();
  apiRequest.mockReset();
  apiRequest.mockImplementation(async (path: string) => {
    if (path === "/onboarding/status") {
      return {
        completed: false,
        completedCount: 0,
        totalCount: 1,
        steps: [{
          code: "clinic",
          label: "Completar dados da clínica",
          // A API antiga ainda aponta para o índice; a web leva à aba de dados.
          path: "/app/configuracoes/clinica",
          completed: false,
          blocked: false,
        }],
      };
    }
    return [];
  });
});

test("o link antigo de primeiros passos abre a configuração da clínica", async () => {
  sessionStorage.setItem("clinicflow.session", JSON.stringify(session("Secretary", true)));
  window.history.replaceState({}, "", "/app/onboarding");

  render(<App />);

  expect(await screen.findByText("0 de 1 etapas concluídas")).toBeVisible();
  expect(window.location.pathname).toBe("/app/configuracoes/clinica");
  expect(
    screen.getByRole("link", { name: "Completar dados da clínica" }),
  ).toHaveAttribute("href", "/app/configuracoes/clinica/dados");
  expect(screen.getByRole("link", { name: "Primeiros passos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("quem não administra a clínica sai do link antigo para o próprio início", async () => {
  sessionStorage.setItem("clinicflow.session", JSON.stringify(session("Doctor", false)));
  window.history.replaceState({}, "", "/app/onboarding");

  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe("/app/inicio"));
  expect(
    apiRequest.mock.calls
      .map(([path]) => path)
      .filter((path) => String(path).includes("onboarding")),
  ).toEqual([]);
});
