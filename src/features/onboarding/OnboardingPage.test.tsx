import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { OnboardingStatus } from "../../api/types";
import { OnboardingPage } from "./OnboardingPage";

let requestMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));

vi.mock("../../app/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/navigation")>()),
  Redirect: (props: { to: string; replace?: boolean }) => {
    redirectMock(props);
    return null;
  },
}));

const pending: OnboardingStatus = {
  completed: false,
  completedCount: 2,
  totalCount: 4,
  steps: [
    // A API antiga ainda manda o índice como destino desta etapa.
    { code: "clinic", label: "Completar dados da clínica", path: "/app/configuracoes/clinica", completed: true, blocked: false },
    { code: "doctor", label: "Completar seu perfil médico", path: "/app/configuracoes/perfil", completed: true, blocked: false },
    { code: "schedule", label: "Configurar horários de atendimento", path: "/app/configuracoes/agenda", completed: false, blocked: false },
    { code: "whatsapp", label: "Conectar as confirmações por WhatsApp", path: "/app/configuracoes/whatsapp", completed: false, blocked: false },
  ],
};

let status: OnboardingStatus;

function QueryHarness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPage() {
  return render(
    <QueryHarness>
      <OnboardingPage />
    </QueryHarness>,
  );
}

beforeEach(() => {
  status = pending;
  redirectMock.mockClear();
  window.history.replaceState({}, "", "/app/configuracoes/clinica");
  requestMock = vi.fn(async (path: string) => {
    if (path === "/onboarding/status") return status;
    throw new Error(`Rota inesperada: ${path}`);
  });
});

test("é a primeira aba da configuração da clínica enquanto houver etapa pendente", async () => {
  renderPage();

  expect(screen.getByRole("heading", { level: 1, name: "Clínica" })).toBeVisible();
  const tabs = screen.getByRole("navigation", { name: "Configuração da clínica" });
  // A aba já aparece durante o carregamento, para a barra não pular.
  const firstSteps = within(tabs).getByRole("link", { name: "Primeiros passos" });
  expect(within(tabs).getAllByRole("link")[0]).toBe(firstSteps);
  expect(firstSteps).toHaveAttribute("aria-current", "page");

  expect(await screen.findByText("2 de 4 etapas concluídas")).toBeVisible();
  expect(redirectMock).not.toHaveBeenCalled();
});

test("cada etapa leva à tela correspondente, e as da clínica às abas atuais", async () => {
  renderPage();

  expect(
    await screen.findByRole("link", { name: "Completar dados da clínica" }),
  ).toHaveAttribute("href", "/app/configuracoes/clinica/dados");
  expect(
    screen.getByRole("link", { name: "Configurar horários de atendimento" }),
  ).toHaveAttribute("href", "/app/configuracoes/agenda");
  expect(
    screen.getByRole("link", { name: "Conectar as confirmações por WhatsApp" }),
  ).toHaveAttribute("href", "/app/configuracoes/clinica/whatsapp");
});

test("com tudo configurado, sai de cena e abre os dados da clínica", async () => {
  status = { ...pending, completed: true, completedCount: 4 };
  renderPage();

  await waitFor(() =>
    expect(redirectMock).toHaveBeenCalledWith({
      to: "/app/configuracoes/clinica/dados",
      replace: true,
    }),
  );
  expect(screen.queryByText("Primeiros passos")).not.toBeInTheDocument();
});

test("sem conseguir consultar o progresso, não segura a configuração da clínica", async () => {
  requestMock = vi.fn(async () => {
    throw new Error("offline");
  });
  renderPage();

  await waitFor(() =>
    expect(redirectMock).toHaveBeenCalledWith({
      to: "/app/configuracoes/clinica/dados",
      replace: true,
    }),
  );
});
