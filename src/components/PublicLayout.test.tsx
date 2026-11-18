import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PublicLayout } from "./PublicLayout";

test("usa a marca oficial como link para o início e mostra a nota", () => {
  render(
    <PublicLayout note="Sua decisão fica protegida.">
      <h1>Confirme sua consulta</h1>
    </PublicLayout>,
  );

  const home = screen.getByRole("link", { name: "ClinicFlow — início" });
  expect(home).toHaveAttribute("href", "/");
  // Uma só marca nas telas de fora: o logotipo do BrandMark, não um monograma.
  expect(home.querySelector("img")).toHaveAttribute("src", "/clinicflow-logo.png");
  expect(screen.getByRole("main")).toContainElement(
    screen.getByRole("heading", { name: "Confirme sua consulta" }),
  );
  expect(screen.getByText("Sua decisão fica protegida.")).toBeVisible();
});
