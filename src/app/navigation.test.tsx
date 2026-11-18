import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { NavLink } from "./navigation";
import { UnsavedChangesProvider } from "./unsavedChanges";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <UnsavedChangesProvider>
        <NavLink
          to="/app/pacientes"
          matchChildren
          className={({ isActive }) => (isActive ? "ativo" : "inativo")}
        >
          Pacientes
        </NavLink>
        <NavLink
          to="/app/configuracoes/clinica"
          className={({ isActive }) => (isActive ? "ativo" : "inativo")}
        >
          Dados da clínica
        </NavLink>
      </UnsavedChangesProvider>
    </Router>,
  );
}

test("destino com matchChildren fica ativo nas páginas filhas, sem se dizer a página atual", () => {
  renderAt("/app/pacientes/patient-1/exames");

  const patients = screen.getByRole("link", { name: "Pacientes" });
  expect(patients).toHaveClass("ativo");
  expect(patients).toHaveAttribute("aria-current", "true");
});

test("no caminho exato o destino é a página atual", () => {
  renderAt("/app/pacientes");

  expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("sem matchChildren o link só ativa no caminho idêntico e prefixo parecido não conta", () => {
  renderAt("/app/configuracoes/clinica/convenios");
  expect(screen.getByRole("link", { name: "Dados da clínica" })).toHaveClass("inativo");

  // "/app/pacientes-arquivados" não é filho de "/app/pacientes".
  renderAt("/app/pacientes-arquivados");
  expect(screen.getAllByRole("link", { name: "Pacientes" }).at(-1)).toHaveClass("inativo");
});
