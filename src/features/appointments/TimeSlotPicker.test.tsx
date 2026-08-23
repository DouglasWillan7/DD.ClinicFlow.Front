import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AvailabilitySlot } from "../../api/types";
import { TimeSlotPicker } from "./TimeSlotPicker";

const slots: AvailabilitySlot[] = [
  {
    startUtc: "2026-08-10T12:00:00Z",
    endUtc: "2026-08-10T12:30:00Z",
    label: "09:00",
  },
  {
    startUtc: "2026-08-10T12:30:00Z",
    endUtc: "2026-08-10T13:00:00Z",
    label: "09:30",
  },
];

describe("TimeSlotPicker", () => {
  test("expõe horário selecionado por pressed e texto", () => {
    render(
      <TimeSlotPicker
        slots={slots}
        selectedStartUtc={slots[0].startUtc}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    const selected = screen.getByRole("button", {
      name: "09:00, selecionado",
      pressed: true,
    });
    expect(within(selected).getByText("Selecionado")).toBeVisible();
  });

  test("entrega o slot real escolhido e respeita indisponibilidade", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TimeSlotPicker
        slots={slots}
        selectedStartUtc={null}
        onChange={onChange}
        disabled={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "09:30" }));
    expect(onChange).toHaveBeenCalledWith(slots[1]);

    rerender(
      <TimeSlotPicker
        slots={slots}
        selectedStartUtc={null}
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: "09:00" })).toBeDisabled();
  });

  test("orienta sem inventar horários quando a lista real está vazia", () => {
    render(
      <TimeSlotPicker
        slots={[]}
        selectedStartUtc={null}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Nenhum horário disponível para esta data.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("orienta a seleção anterior quando ainda está desabilitado", () => {
    render(
      <TimeSlotPicker
        slots={[]}
        selectedStartUtc={null}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Selecione um médico e uma data disponível para ver os horários.",
    );
  });
});
