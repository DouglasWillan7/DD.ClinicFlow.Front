import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test, vi } from "vitest";
import { Button } from "./Button";
import { ContextBar } from "./ContextBar";
import { FilterChips } from "./FilterChips";

function renderBar(ui: React.ReactNode) {
  const { hook } = memoryLocation({ path: "/app/pacientes/patient-1" });
  return render(<Router hook={hook}>{ui}</Router>);
}

test("trilha com links reais, item atual e ação da página", () => {
  renderBar(
    <ContextBar
      crumbs={[
        { label: "Pacientes", to: "/app/pacientes" },
        { label: "Marina Oliveira" },
      ]}
      back={{ label: "Voltar para a lista de pacientes", to: "/app/pacientes" }}
      counter="12 de 40"
      action={<Button shape="pill">Novo paciente</Button>}
    />,
  );

  const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
  expect(within(trail).getByRole("link", { name: "Pacientes" })).toHaveAttribute(
    "href",
    "/app/pacientes",
  );
  expect(within(trail).getByText("Marina Oliveira")).toHaveAttribute("aria-current", "page");
  expect(
    screen.getByRole("link", { name: "Voltar para a lista de pacientes" }),
  ).toHaveAttribute("href", "/app/pacientes");
  expect(screen.getByText("12 de 40")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("button", { name: "Novo paciente" })).toBeVisible();
  // O h1 da tela está no conteúdo (nome do paciente), então a trilha não cria outro.
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

test("vira o título da tela quando o conteúdo não tem h1 próprio", () => {
  renderBar(
    <ContextBar
      currentAs="h1"
      crumbs={[{ label: "Pacientes" }, { label: "Todos os pacientes" }]}
    />,
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "Todos os pacientes" }),
  ).toBeVisible();
  // Sem `to`, o item pai é texto de contexto, não um link morto.
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("o item atual pode não ser o último, e voltar pode ser um botão", async () => {
  const user = userEvent.setup();
  const goBack = vi.fn();
  renderBar(
    <ContextBar
      crumbs={[
        { label: "Agendas" },
        { label: "Por médico", current: true },
        { label: "Dra. Helena Costa", truncate: true },
      ]}
      back={{ label: "Voltar para a agenda", onClick: goBack }}
    />,
  );

  expect(screen.getByText("Por médico")).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Dra. Helena Costa")).not.toHaveAttribute("aria-current");

  await user.click(screen.getByRole("button", { name: "Voltar para a agenda" }));
  expect(goBack).toHaveBeenCalledTimes(1);
});

test("chips de filtro marcam a escolha com aria-pressed", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <FilterChips
      label="Filtrar por situação"
      value="todos"
      onChange={onChange}
      options={[
        { value: "todos", label: "Todos" },
        { value: "novo", label: "Novo · 3" },
      ]}
    />,
  );

  const group = screen.getByRole("group", { name: "Filtrar por situação" });
  expect(within(group).getByRole("button", { name: "Todos" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(within(group).getByRole("button", { name: "Novo · 3" }));
  expect(onChange).toHaveBeenCalledWith("novo");
});
