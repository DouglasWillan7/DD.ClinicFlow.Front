import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../api/client";
import { RegisterPage } from "./RegisterPage";

const { navigateMock, registerClinicOwnerMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  registerClinicOwnerMock: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ registerClinicOwner: registerClinicOwnerMock }),
}));

vi.mock("../app/navigation", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

async function reachProfessionalStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Marina Lopes");
  await user.type(screen.getByLabelText("Documento"), "52998224725");
  await user.type(screen.getByLabelText("E-mail nesta clínica"), "marina@clinica.com.br");
  await user.type(screen.getByLabelText("Telefone nesta clínica"), "11999999999");
  await user.type(screen.getByLabelText("Senha"), "Senha123!");
  await user.type(screen.getByLabelText("Repita sua senha"), "Senha123!");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function reachClinicStep(user: ReturnType<typeof userEvent.setup>) {
  await reachProfessionalStep(user);
  await user.type(screen.getByLabelText("Número do registro"), "123456");
  await user.type(screen.getByLabelText("Região / UF"), "SP");
  await user.selectOptions(screen.getByLabelText("Especialidade"), "Gastroenterologia");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("RegisterPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    registerClinicOwnerMock.mockReset();
  });

  test("usa documento como login e exige os contatos do vínculo", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    expect(screen.getByText(/O documento será seu login/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Informe seu nome para continuar.");
    expect(registerClinicOwnerMock).not.toHaveBeenCalled();
  });

  test("preserva os valores ao avançar e voltar", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await reachProfessionalStep(user);

    expect(screen.getByRole("heading", { name: "Seu perfil profissional" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Lopes");
    expect(screen.getByLabelText("Documento")).toHaveValue("52998224725");
    expect(screen.getByLabelText("E-mail nesta clínica")).toHaveValue("marina@clinica.com.br");
  });

  test("cria a identidade, o perfil médico e a clínica pelo contrato v2", async () => {
    const user = userEvent.setup();
    registerClinicOwnerMock.mockResolvedValue({});
    render(<RegisterPage />);
    await reachClinicStep(user);

    await user.type(screen.getByLabelText("Nome da clínica"), "Clínica Horizonte");
    await user.type(screen.getByLabelText("Registro da clínica"), "11.444.777/0001-61");
    await user.type(screen.getByLabelText("Endereço"), "Av. Paulista, 1000, São Paulo - SP");
    await user.click(screen.getByText(/Li e aceito/));
    await user.click(screen.getByRole("button", { name: "Concluir cadastro" }));

    expect(registerClinicOwnerMock).toHaveBeenCalledWith({
      countryCode: "BR",
      documentType: "CPF",
      document: "52998224725",
      name: "Marina Lopes",
      email: "marina@clinica.com.br",
      phone: "+5511999999999",
      password: "Senha123!",
      plan: "Clinic",
      clinicName: "Clínica Horizonte",
      clinicRegistrationCountryCode: "BR",
      clinicRegistrationType: "CNPJ",
      clinicRegistrationNumber: "11.444.777/0001-61",
      clinicAddress: "Av. Paulista, 1000, São Paulo - SP",
      professionalAuthority: "CRM",
      professionalRegistrationNumber: "123456",
      professionalRegistrationRegion: "SP",
      professionalRegistrationCountryCode: "BR",
      specialty: "Gastroenterologia",
      defaultAppointmentDurationMinutes: 30,
      termsAccepted: true,
      termsVersion: "clinicflow-terms-v1",
    });
    expect(navigateMock).toHaveBeenCalledWith("/app/onboarding", { replace: true });
  });

  test("preserva o formulário e mostra conflito retornado pela API", async () => {
    const user = userEvent.setup();
    registerClinicOwnerMock.mockRejectedValue(
      new ApiError("Já existe uma conta com esse documento.", 409),
    );
    render(<RegisterPage />);
    await reachClinicStep(user);
    await user.type(screen.getByLabelText("Nome da clínica"), "Clínica Horizonte");
    await user.type(screen.getByLabelText("Registro da clínica"), "11.444.777/0001-61");
    await user.click(screen.getByText(/Li e aceito/));
    await user.click(screen.getByRole("button", { name: "Concluir cadastro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma conta com esse documento.",
    );
    expect(screen.getByLabelText("Nome da clínica")).toHaveValue("Clínica Horizonte");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
