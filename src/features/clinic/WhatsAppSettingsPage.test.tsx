import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { WhatsAppConfig } from "../../api/types";
import { WhatsAppSettingsPage } from "./WhatsAppSettingsPage";

let requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));

const config: WhatsAppConfig = {
  phoneNumberId: "123456789",
  templateName: "appointment_confirmation",
  enabled: true,
  hasToken: true,
  updatedAtUtc: "2026-08-01T12:00:00Z",
};

let savedBody: Record<string, unknown> | undefined;

function QueryHarness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  savedBody = undefined;
  window.history.replaceState({}, "", "/app/configuracoes/clinica/whatsapp");
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/whatsapp-config" && init?.method === "PUT") {
      savedBody = JSON.parse(String(init.body));
      return { ...config, ...savedBody, hasToken: true };
    }
    if (path === "/clinics/whatsapp-config") return config;
    throw new Error(`Rota inesperada: ${path}`);
  });
});

test("é uma aba da configuração da clínica, com o mesmo cabeçalho das outras", async () => {
  render(
    <QueryHarness>
      <WhatsAppSettingsPage />
    </QueryHarness>,
  );

  expect(await screen.findByRole("heading", { level: 1, name: "Clínica" })).toBeVisible();
  const tabs = screen.getByRole("navigation", { name: "Configuração da clínica" });
  expect(within(tabs).getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(tabs).getByRole("link", { name: "Dados da clínica" })).toHaveAttribute(
    "href",
    "/app/configuracoes/clinica",
  );
  expect(
    await screen.findByRole("heading", { level: 2, name: "Confirmações por WhatsApp" }),
  ).toBeVisible();
});

test("carrega a conexão salva e mantém o token quando o campo fica vazio", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <WhatsAppSettingsPage />
    </QueryHarness>,
  );

  const phoneNumberId = await screen.findByLabelText("ID do número de telefone");
  await waitFor(() => expect(phoneNumberId).toHaveValue("123456789"));
  // Com token salvo, o campo oferece a troca e nunca mostra o valor atual.
  expect(screen.getByLabelText("Substituir token")).toHaveValue("");

  await user.clear(phoneNumberId);
  await user.type(phoneNumberId, "987654321");
  await user.click(screen.getByRole("button", { name: "Salvar conexão" }));

  await waitFor(() =>
    expect(savedBody).toMatchObject({
      phoneNumberId: "987654321",
      templateName: "appointment_confirmation",
      enabled: true,
      accessToken: null,
    }),
  );
  expect(await screen.findByText("Configuração atualizada.")).toBeVisible();
});

test("sem configuração ainda (404), abre o formulário vazio para a primeira conexão", async () => {
  const { ApiError } = await import("../../api/client");
  requestMock = vi.fn(async () => {
    throw new ApiError("Não encontrado", 404);
  });
  render(
    <QueryHarness>
      <WhatsAppSettingsPage />
    </QueryHarness>,
  );

  expect(await screen.findByLabelText("Token de acesso")).toHaveValue("");
  expect(screen.getByLabelText("ID do número de telefone")).toHaveValue("");
});
