import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Button } from "./Button";
import { PageHeader } from "./PageHeader";

test("mostra título, apoio e ações; o estilo do eyebrow não alcança os botões", () => {
  render(
    <PageHeader
      eyebrow="Configuração"
      title="Clínica"
      description="Dados da unidade."
      actions={<Button shape="pill">Nova consulta</Button>}
    />,
  );

  expect(screen.getByRole("heading", { level: 1, name: "Clínica" })).toBeVisible();
  expect(screen.getByText("Configuração").className).toMatch(/eyebrow/);
  const label = screen.getByText("Nova consulta");
  expect(label.className).not.toMatch(/eyebrow/);
});
