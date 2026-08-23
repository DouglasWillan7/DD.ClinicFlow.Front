import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const { loginMock, navigateMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock("../app/navigation", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ state: null }),
  useNavigate: () => navigateMock,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  test("valida campos vazios sem chamar a autenticação", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Informe e-mail e senha para continuar.");
    expect(loginMock).not.toHaveBeenCalled();
  });

  test("alterna a visibilidade da senha e limpa o erro ao digitar", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));
    const password = screen.getByLabelText("Senha");
    await user.type(password, "Senha123!");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(password).toHaveAttribute("type", "text");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("entra com persistência e segue para a agenda", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({});
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "pessoa@clinica.com.br");
    await user.type(screen.getByLabelText("Senha"), "Senha123!");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(loginMock).toHaveBeenCalledWith(
      "pessoa@clinica.com.br",
      "Senha123!",
      true,
    );
    expect(navigateMock).toHaveBeenCalledWith("/app/agenda", { replace: true });
  });
});
