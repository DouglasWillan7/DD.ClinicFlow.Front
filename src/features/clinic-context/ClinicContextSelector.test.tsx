import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { AuthV2ClinicOption } from "../../api/types";
import { ClinicContextSelector } from "./ClinicContextSelector";

const clinics: AuthV2ClinicOption[] = [
  {
    userClinicId: "uc-doctor",
    clinicId: "clinic-centro",
    clinicName: "Clínica Centro",
    role: "Doctor",
    isAdmin: true,
  },
  {
    userClinicId: "uc-secretary",
    clinicId: "clinic-norte",
    clinicName: "Clínica Norte",
    role: "Secretary",
    isAdmin: false,
  },
];

describe("ClinicContextSelector", () => {
  test("comunica clínica, papel e administração sem múltiplas roles", () => {
    render(
      <ClinicContextSelector
        clinics={clinics}
        activeUserClinicId="uc-doctor"
        onSelect={vi.fn()}
      />,
    );

    const active = screen.getByRole("button", {
      name: "Clínica Centro, Médico, Administração, contexto atual",
    });
    expect(active).toBeDisabled();
    expect(active).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Secretaria")).toBeVisible();
    expect(screen.queryByText(/Doctor|Secretary/)).not.toBeInTheDocument();
  });

  test("seleciona outro vínculo por teclado", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ClinicContextSelector
        clinics={clinics}
        activeUserClinicId="uc-doctor"
        onSelect={onSelect}
      />,
    );

    const option = screen.getByRole("button", {
      name: "Clínica Norte, Secretaria",
    });
    option.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("uc-secretary");
  });

  test("bloqueia novas escolhas enquanto a troca está em andamento", () => {
    render(
      <ClinicContextSelector
        clinics={clinics}
        activeUserClinicId="uc-doctor"
        busyUserClinicId="uc-secretary"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Clínica Norte/ })).toBeDisabled();
    expect(screen.getByText("Entrando…")).toBeVisible();
  });
});
