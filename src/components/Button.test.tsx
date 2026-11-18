import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";
import { Button } from "./Button";

test("mantém o rótulo durante o carregamento e avisa que está ocupado", () => {
  render(<Button loading>Ativar meu acesso</Button>);

  const button = screen.getByRole("button", { name: "Ativar meu acesso" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByText("Salvando…")).not.toBeInTheDocument();
});

test("troca o rótulo só quando a tela informa o texto de espera", () => {
  render(
    <Button loading loadingLabel="Abrindo laudo…">
      Abrir laudo
    </Button>,
  );

  expect(screen.getByRole("button", { name: "Abrindo laudo…" })).toBeDisabled();
});

test("a pílula é uma forma: combina com qualquer variante", () => {
  render(
    <Button shape="pill" variant="secondary">
      Novo paciente
    </Button>,
  );

  const button = screen.getByRole("button", { name: "Novo paciente" });
  expect(button.className).toMatch(/pill/);
  expect(button.className).toMatch(/secondary/);
});

test("repassa a ref para o gatilho de menus", () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref}>Nova consulta</Button>);

  expect(ref.current).toBe(screen.getByRole("button", { name: "Nova consulta" }));
});
