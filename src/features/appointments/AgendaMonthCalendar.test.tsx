import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AvailabilityDay } from "../../api/types";
import { AgendaMonthCalendar } from "./AgendaMonthCalendar";

const slot = {
  startUtc: "2026-08-10T12:00:00Z",
  endUtc: "2026-08-10T12:30:00Z",
  label: "09:00",
};
const days: AvailabilityDay[] = [
  { date: "2026-08-01", status: "Available", slots: [slot] },
  { date: "2026-08-10", status: "Available", slots: [slot] },
  { date: "2026-08-11", status: "Blocked", slots: [] },
  { date: "2026-08-12", status: "Full", slots: [] },
  { date: "2026-08-13", status: "NoSchedule", slots: [] },
  { date: "2026-08-14", status: "Available", slots: [] },
];

afterEach(() => {
  vi.useRealTimers();
});

test("aplica disponibilidade compartilhada sem perder contagem de consultas", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 6, 12));
  const onDateChange = vi.fn();
  render(
    <AgendaMonthCalendar
      month={new Date(2026, 7, 1)}
      selectedDate="2026-08-10"
      days={days}
      timeZoneId="America/Sao_Paulo"
      pastDatesSelectable
      countByDate={new Map([
        ["2026-08-05", 1],
        ["2026-08-10", 2],
        ["2026-08-12", 1],
      ])}
      onMonthChange={vi.fn()}
      onDateChange={onDateChange}
    />,
  );

  const available = screen.getByRole("button", {
    name: "10 de agosto de 2026, disponível, 2 consultas, selecionado",
    pressed: true,
  });
  expect(available).toBeEnabled();
  expect(available.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  fireEvent.click(available);
  expect(onDateChange).toHaveBeenCalledWith("2026-08-10");

  const emptyPastDay = screen.getByRole("button", {
    name: "1 de agosto de 2026, data passada, sem consultas",
  });
  expect(emptyPastDay).toBeDisabled();

  const pastDayWithAppointment = screen.getByRole("button", {
    name: "5 de agosto de 2026, data passada, 1 consulta",
  });
  expect(pastDayWithAppointment).toBeEnabled();
  fireEvent.click(pastDayWithAppointment);
  expect(onDateChange).toHaveBeenNthCalledWith(2, "2026-08-05");
  expect(
    screen.getByRole("button", {
      name: "11 de agosto de 2026, bloqueado, sem consultas",
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "12 de agosto de 2026, sem horários, 1 consulta",
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "13 de agosto de 2026, sem agenda, sem consultas",
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "14 de agosto de 2026, sem horários, sem consultas",
    }),
  ).toBeDisabled();
  expect(
    within(screen.getByLabelText("Legenda do calendário")).getByText(
      "dias com consultas",
    ),
  ).toBeVisible();
});

test("mantém disponibilidade autoritativa com fuso inválido", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-11T01:00:00Z"));

  expect(() =>
    render(
      <AgendaMonthCalendar
        month={new Date(2026, 7, 1)}
        selectedDate="2026-08-10"
        days={days}
        timeZoneId="Fuso/Inexistente"
        pastDatesSelectable
        countByDate={new Map()}
        onMonthChange={vi.fn()}
        onDateChange={vi.fn()}
      />,
    ),
  ).not.toThrow();
  expect(
    screen.getByRole("button", {
      name: "10 de agosto de 2026, disponível, sem consultas, selecionado",
    }),
  ).toBeEnabled();
});
