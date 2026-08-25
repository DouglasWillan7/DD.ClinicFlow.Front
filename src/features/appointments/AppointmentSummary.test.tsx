import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Member, Patient } from "../../api/types";
import type { NewAppointmentSelection } from "./newAppointmentState";
import { AppointmentSummary } from "./AppointmentSummary";

const doctor: Member = {
  userClinicId: "uc-d-1",
  userId: "d-1",
  displayName: "Dra. Helena Costa",
  role: "Doctor",
  isAdmin: false,
  specialty: "Cardiologia",
  defaultAppointmentDurationMinutes: 30,
};

const patient: Patient = {
  id: "p-1",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  name: "Marina Oliveira",
  phone: "+5511999990000",
  email: "marina@example.test",
  medicalRecordNumber: 48213,
  bloodType: "APositive",
  sexForClinicalUse: null,
  birthDate: "1980-03-10",
  notes: null,
  isActive: true,
  createdAtUtc: "2026-08-01T12:00:00Z",
};

const emptySelection: NewAppointmentSelection = {
  patient: null,
  doctor: null,
  type: null,
  date: null,
  slot: null,
};

const completeSelection: NewAppointmentSelection = {
  patient,
  doctor,
  type: "InPerson",
  date: "2026-08-10",
  slot: {
    startUtc: "2026-08-10T12:00:00Z",
    endUtc: "2026-08-10T12:30:00Z",
    label: "09:00",
  },
};

describe("AppointmentSummary", () => {
  test("usa travessão para ausentes e só habilita seleção completa", () => {
    const { rerender } = render(
      <AppointmentSummary
        selection={emptySelection}
        pending={false}
        error={null}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    ).toBeDisabled();

    rerender(
      <AppointmentSummary
        selection={{ ...completeSelection, slot: null }}
        pending={false}
        error={null}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    ).toBeDisabled();

    rerender(
      <AppointmentSummary
        selection={completeSelection}
        pending={false}
        error={null}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    ).toBeEnabled();
  });

  test("resume escolhas com labels e formato DateOnly centralizados", () => {
    render(
      <AppointmentSummary
        selection={completeSelection}
        pending={false}
        error={null}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Marina Oliveira")).toBeVisible();
    expect(screen.getByText("Dra. Helena Costa")).toBeVisible();
    expect(screen.getByText("Presencial")).toBeVisible();
    expect(screen.getByText("10 de agosto de 2026")).toBeVisible();
    expect(screen.getByText("09:00")).toBeVisible();
    // Especialidade saiu do fluxo: o resumo não a repete.
    expect(screen.queryByText("Especialidade")).not.toBeInTheDocument();
  });

  test("mantém label durante envio, anuncia estado e erro", () => {
    const { rerender } = render(
      <AppointmentSummary
        selection={completeSelection}
        pending
        error={null}
        onConfirm={vi.fn()}
      />,
    );
    const confirm = screen.getByRole("button", {
      name: "Confirmar agendamento",
    });
    expect(confirm).toHaveTextContent("Confirmar agendamento");
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Criando consulta…");

    rerender(
      <AppointmentSummary
        selection={completeSelection}
        pending={false}
        error="Este horário acabou de ser ocupado. Escolha outro."
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este horário acabou de ser ocupado. Escolha outro.",
    );
  });

  test("bloqueia duplo envio mesmo antes da prop pending atualizar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AppointmentSummary
        selection={completeSelection}
        pending={false}
        error={null}
        onConfirm={onConfirm}
      />,
    );

    await user.dblClick(
      screen.getByRole("button", { name: "Confirmar agendamento" }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
