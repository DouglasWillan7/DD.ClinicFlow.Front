import { render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenScreen(): never {
  throw new Error("Falha simulada");
}

describe("AppErrorBoundary", () => {
  it("substitui uma falha de renderização por ações de recuperação", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenScreen />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível abrir esta tela.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Voltar para entrar" }),
    ).toBeVisible();

    consoleError.mockRestore();
  });
});
