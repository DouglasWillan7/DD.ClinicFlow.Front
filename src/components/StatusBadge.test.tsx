import { render, screen } from "@testing-library/react";
import { Clock3 } from "lucide-react";
import { expect, test } from "vitest";
import { StatusBadge } from "./StatusBadge";

test("combina rótulo, ícone e tom, sem se anunciar como região viva", () => {
  render(
    <StatusBadge tone="warning" icon={Clock3} data-state="pending">
      Aguardando
    </StatusBadge>,
  );

  const badge = screen.getByText("Aguardando");
  expect(badge.className).toMatch(/warning/);
  expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(badge).toHaveAttribute("data-state", "pending");
  // Um badge numa lista não pode disputar o `role="status"` da página.
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
