import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Clinic } from "../../api/types";
import { ClinicSettingsPage } from "./ClinicSettingsPage";

let requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));

const clinic: Clinic = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Clínica Horizonte",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Rua das Flores, 100, São Paulo",
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: 10,
  createdAtUtc: "2026-08-01T12:00:00Z",
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
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/current" && init?.method === "PUT") {
      savedBody = JSON.parse(String(init.body));
      return { ...clinic, ...savedBody };
    }
    if (path === "/clinics/current") return clinic;
    throw new Error(`Rota inesperada: ${path}`);
  });
});

describe("ClinicSettingsPage", () => {
  test("carrega, mascara e salva o telefone internacional em E.164", async () => {
    const user = userEvent.setup();
    render(
      <QueryHarness>
        <ClinicSettingsPage />
      </QueryHarness>,
    );

    const phone = await screen.findByLabelText("Telefone");
    const country = screen.getByLabelText("País ou região do telefone");

    expect(country).toHaveValue("BR");
    await waitFor(() => expect(phone).toHaveValue("(11) 3000-0000"));
    expect(screen.getByText("🇧🇷")).toBeVisible();
    expect(screen.getByText("+55")).toBeVisible();

    await user.clear(phone);
    await user.selectOptions(country, "PT");
    await user.type(phone, "912345678");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    await waitFor(() =>
      expect(savedBody).toMatchObject({ phone: "+351912345678" }),
    );
    expect(await screen.findByText("Dados atualizados.")).toBeVisible();
  });

  test("não envia um número impossível para o país selecionado", async () => {
    const user = userEvent.setup();
    render(
      <QueryHarness>
        <ClinicSettingsPage />
      </QueryHarness>,
    );

    const phone = await screen.findByLabelText("Telefone");
    await user.clear(phone);
    await user.type(phone, "123");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(
      await screen.findByText(
        "Informe um telefone válido para o país selecionado.",
      ),
    ).toBeVisible();
    expect(savedBody).toBeUndefined();
  });
});
