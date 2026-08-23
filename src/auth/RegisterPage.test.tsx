import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";

const { createAccountMock, navigateMock } = vi.hoisted(() => ({
  createAccountMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ register: createAccountMock }),
}));

vi.mock("../app/navigation", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigateMock,
}));

async function reachProfessionalStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Marina Lopes");
  await user.type(screen.getByLabelText("E-mail"), "marina@clinica.com.br");
  await user.type(screen.getByLabelText("Senha"), "Senha123!");
  await user.type(screen.getByLabelText("Repita sua senha"), "Senha123!");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("RegisterPage", () => {
  beforeEach(() => {
    createAccountMock.mockReset();
    navigateMock.mockReset();
  });

  test("valida a conta e mantém o usuário na primeira etapa", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe seu nome e e-mail para continuar.",
    );
    expect(screen.getByRole("heading", { name: "Comece pela sua conta" })).toBeVisible();
  });

  test("preserva valores ao avançar e voltar", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await reachProfessionalStep(user);

    expect(screen.getByRole("heading", { name: "Seu perfil profissional" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Lopes");
    expect(screen.getByLabelText("E-mail")).toHaveValue("marina@clinica.com.br");
  });

  test("conclui o wizard com clínica e perfil médico", async () => {
    const user = userEvent.setup();
    createAccountMock.mockResolvedValue({});
    render(<RegisterPage />);
    await reachProfessionalStep(user);

    await user.type(screen.getByLabelText("CRM"), "123456");
    await user.selectOptions(screen.getByLabelText("UF"), "PE");
    await user.selectOptions(screen.getByLabelText("Especialidade"), "Gastroenterologia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.type(screen.getByLabelText("Nome da clínica"), "Clínica Horizonte");
    await user.type(screen.getByLabelText("Cidade"), "Recife");
    await user.selectOptions(screen.getByLabelText("UF"), "PE");
    await user.click(screen.getByText(/Li e aceito/));
    await user.click(screen.getByRole("button", { name: "Concluir cadastro" }));

    expect(createAccountMock).toHaveBeenCalledWith(
      "Marina Lopes",
      "marina@clinica.com.br",
      "Senha123!",
      "Clinic",
      true,
      expect.objectContaining({
        clinicName: "Clínica Horizonte",
        clinicCity: "Recife",
        clinicState: "PE",
        medicalLicense: "123456",
        medicalLicenseState: "PE",
        specialty: "Gastroenterologia",
        termsAccepted: true,
        termsVersion: "clinicflow-terms-v1",
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/app/pacientes", { replace: true });
  });
});
