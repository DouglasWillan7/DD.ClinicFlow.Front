import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Member } from "../../api/types";
import { DoctorPicker } from "./DoctorPicker";

const members: Member[] = [
  {
    userClinicId: "uc-d-1",
    userId: "d-1",
    displayName: "Dra. Helena Costa",
    role: "Doctor",
    isAdmin: false,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-d-2",
    userId: "d-2",
    displayName: "Dr. João Ávila",
    role: "Doctor",
    isAdmin: true,
    specialty: "Neurologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-s-1",
    userId: "s-1",
    displayName: "Secretaria",
    role: "Secretary",
    isAdmin: false,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: null,
  },
];

function renderPicker(overrides: Partial<React.ComponentProps<typeof DoctorPicker>> = {}) {
  const props: React.ComponentProps<typeof DoctorPicker> = {
    members,
    doctorId: "d-1",
    search: "",
    onDoctorChange: vi.fn(),
    onSearchChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<DoctorPicker {...props} />), props };
}

describe("DoctorPicker", () => {
  test("expõe o médico selecionado por pressed e texto, sem passo de especialidade", () => {
    renderPicker();

    expect(screen.getByRole("group", { name: "Médico" })).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Especialidade" }),
    ).not.toBeInTheDocument();

    const doctor = screen.getByRole("button", {
      name: /Dra\. Helena Costa.*selecionada/i,
      pressed: true,
    });

    expect(within(doctor).getByText("Selecionada")).toBeVisible();
    // A especialidade continua visível como informação da linha.
    expect(within(doctor).getByText("Cardiologia")).toBeVisible();
    expect(screen.queryByText("Secretaria")).not.toBeInTheDocument();
  });

  test("comunica busca e escolhas pelos callbacks do fluxo", async () => {
    const user = userEvent.setup();
    const { props } = renderPicker();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar médico" }),
      { target: { value: "joao" } },
    );
    expect(props.onSearchChange).toHaveBeenCalledWith("joao");

    const second = renderPicker({ doctorId: null, search: "joao avila" });
    await user.click(
      within(second.container).getByRole("button", { name: /Dr\. João Ávila/ }),
    );
    expect(second.props.onDoctorChange).toHaveBeenCalledWith(members[1]);
  });

  test("orienta quando a busca não encontra médico", () => {
    renderPicker({ search: "pediatria" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Nenhum médico encontrado para estes filtros.",
    );
  });
});
