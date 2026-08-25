import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../api/client";
import type { AuthV2Authenticated } from "../api/types";
import { LoginPage } from "./LoginPage";

const {
  getRecoveryOptionsMock,
  loginWithDocumentMock,
  navigateMock,
  requestRecoveryChallengeMock,
  selectClinicMock,
} = vi.hoisted(() => ({
  getRecoveryOptionsMock: vi.fn(),
  loginWithDocumentMock: vi.fn(),
  navigateMock: vi.fn(),
  requestRecoveryChallengeMock: vi.fn(),
  selectClinicMock: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    getRecoveryOptions: getRecoveryOptionsMock,
    loginWithDocument: loginWithDocumentMock,
    requestRecoveryChallenge: requestRecoveryChallengeMock,
    selectClinic: selectClinicMock,
  }),
}));

vi.mock("../app/navigation", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ state: null }),
  useNavigate: () => navigateMock,
}));

const authenticated: AuthV2Authenticated = {
  kind: "authenticated",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  user: { id: "user-1", name: "Ana" },
  clinicContext: {
    userClinicId: "user-clinic-1",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    role: "Doctor",
    isAdmin: true,
    email: "a***@exemplo.com",
    phone: "+55******1234",
  },
};

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Documento"), "123.456.789-01");
  await user.type(screen.getByLabelText("Senha"), "Senha123!");
}

describe("LoginPage", () => {
  beforeEach(() => {
    getRecoveryOptionsMock.mockReset();
    loginWithDocumentMock.mockReset();
    navigateMock.mockReset();
    requestRecoveryChallengeMock.mockReset();
    selectClinicMock.mockReset();
  });

  test("não usa e-mail como username e valida CPF antes da autenticação", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Documento"), "123");
    await user.type(screen.getByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Informe um CPF com 11 dígitos.");
    expect(loginWithDocumentMock).not.toHaveBeenCalled();
  });

  test("autentica com país, tipo e documento e segue para a agenda", async () => {
    const user = userEvent.setup();
    loginWithDocumentMock.mockResolvedValue(authenticated);
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(loginWithDocumentMock).toHaveBeenCalledWith({
      countryCode: "BR",
      documentType: "CPF",
      document: "123.456.789-01",
      password: "Senha123!",
      rememberConnection: true,
    });
    expect(navigateMock).toHaveBeenCalledWith("/app/agenda", { replace: true });
  });

  test("permite escolher a clínica por teclado sem persistir o token intermediário", async () => {
    const user = userEvent.setup();
    loginWithDocumentMock.mockResolvedValue({
      kind: "clinic_selection_required",
      selectionToken: "selection-secret",
      expiresAtUtc: "2099-01-01T00:05:00Z",
      clinics: [
        { userClinicId: "uc-1", clinicId: "clinic-1", clinicName: "Clínica Centro", role: "Doctor", isAdmin: true },
        { userClinicId: "uc-2", clinicId: "clinic-2", clinicName: "Clínica Norte", role: "Secretary", isAdmin: false },
      ],
    });
    selectClinicMock.mockResolvedValue(authenticated);
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Escolha onde entrar" })).toBeInTheDocument();
    const clinic = screen.getByRole("button", { name: /Clínica Norte/ });
    clinic.focus();
    await user.keyboard("{Enter}");

    expect(selectClinicMock).toHaveBeenCalledWith("selection-secret", "uc-2", true);
    expect(navigateMock).toHaveBeenCalledWith("/app/agenda", { replace: true });
  });

  test("exibe erro seguro sem revelar se o documento existe", async () => {
    const user = userEvent.setup();
    loginWithDocumentMock.mockRejectedValue(new ApiError("Documento encontrado, senha inválida", 401));
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Documento ou senha incorretos.");
    expect(screen.queryByText(/documento encontrado/i)).not.toBeInTheDocument();
  });

  test("recupera acesso somente por destinos mascarados e seleção opaca", async () => {
    const user = userEvent.setup();
    getRecoveryOptionsMock.mockResolvedValue({
      destinations: [
        { kind: "sms", masked: "+55 ******1234", selection: "opaque-sms" },
        { kind: "email", masked: "a***@exemplo.com", selection: "opaque-mail" },
      ],
      supportRequired: false,
    });
    requestRecoveryChallengeMock.mockResolvedValue(undefined);
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    expect(screen.getByRole("heading", { name: "Recuperar acesso" })).toBeInTheDocument();
    expect(screen.getByLabelText("Documento")).toHaveFocus();

    await user.type(screen.getByLabelText("Documento"), "123.456.789-01");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(getRecoveryOptionsMock).toHaveBeenCalledWith({
      countryCode: "BR", documentType: "CPF", document: "123.456.789-01",
    });
    expect(await screen.findByText("+55 ******1234")).toBeInTheDocument();
    expect(screen.queryByText("opaque-sms")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /\+55 \*\*\*\*\*\*1234/ }));

    expect(requestRecoveryChallengeMock).toHaveBeenCalledWith("opaque-sms");
    expect(await screen.findByText("Se os dados estiverem corretos, você receberá as próximas instruções.")).toBeInTheDocument();
  });

  test("orienta suporte sem enumerar uma conta sem destino recuperável", async () => {
    const user = userEvent.setup();
    getRecoveryOptionsMock.mockResolvedValue({ destinations: [], supportRequired: true });
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    await user.type(screen.getByLabelText("Documento"), "123.456.789-01");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "Procure o administrador da sua clínica ou o suporte do ClinicFlow.",
    ));
  });
});
