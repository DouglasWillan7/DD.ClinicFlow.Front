import { render, screen } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { expect, test } from "vitest";
import { Button } from "./Button";
import { EmptyState } from "./Feedback";

test("o vazio diz o que não há e oferece a próxima ação", () => {
  render(
    <EmptyState
      icon={CalendarDays}
      title="Nenhuma consulta neste dia"
      description="Escolha outra data ou agende uma consulta."
      action={<Button variant="secondary">Agendar consulta</Button>}
    />,
  );

  expect(screen.getByText("Nenhuma consulta neste dia")).toBeVisible();
  expect(screen.getByText("Escolha outra data ou agende uma consulta.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Agendar consulta" })).toBeVisible();
});
