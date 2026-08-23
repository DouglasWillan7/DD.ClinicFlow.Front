import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AvailabilityDay } from "../../api/types";
import { AppointmentCalendar } from "./AppointmentCalendar";

const days: AvailabilityDay[] = [
  {
    date: "2026-08-01",
    status: "Available",
    slots: [
      {
        startUtc: "2026-08-01T12:00:00Z",
        endUtc: "2026-08-01T12:30:00Z",
        label: "09:00",
      },
    ],
  },
  {
    date: "2026-08-10",
    status: "Available",
    slots: [
      {
        startUtc: "2026-08-10T12:00:00Z",
        endUtc: "2026-08-10T12:30:00Z",
        label: "09:00",
      },
    ],
  },
  { date: "2026-08-11", status: "Blocked", slots: [] },
  { date: "2026-08-12", status: "Full", slots: [] },
  { date: "2026-08-13", status: "NoSchedule", slots: [] },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("AppointmentCalendar", () => {
  test("usa grade semântica e DateOnly local sem recuar o dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 12));
    render(
      <AppointmentCalendar
        month={new Date(2026, 7, 1)}
        days={days}
        timeZoneId="America/Sao_Paulo"
        selectedDate={null}
        onMonthChange={vi.fn()}
        onDateChange={vi.fn()}
      />,
    );

    const calendar = screen.getByRole("table", {
      name: "Calendário de agosto de 2026",
    });
    expect(calendar).toHaveStyle({ minWidth: "336px" });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(within(calendar).getAllByRole("columnheader")).toHaveLength(7);
    for (const row of within(calendar).getAllByRole("row").slice(1)) {
      expect(within(row).getAllByRole("cell")).toHaveLength(7);
    }
    expect(
      within(calendar).getByRole("button", {
        name: "1 de agosto de 2026, disponível",
      }),
    ).toBeEnabled();
    expect(
      within(calendar).queryByRole("button", { name: /31 de julho/ }),
    ).not.toBeInTheDocument();
  });

  test("desabilita passado, bloqueado, lotado e sem agenda com estado textual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12));
    render(
      <AppointmentCalendar
        month={new Date(2026, 7, 1)}
        days={days}
        timeZoneId="America/Sao_Paulo"
        selectedDate={null}
        onMonthChange={vi.fn()}
        onDateChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "1 de agosto de 2026, data passada",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "11 de agosto de 2026, bloqueado",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "12 de agosto de 2026, sem horários",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "13 de agosto de 2026, sem agenda",
      }),
    ).toBeDisabled();
  });

  test("seleciona somente dia disponível e não depende apenas de cor", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12));
    const onDateChange = vi.fn();
    render(
      <AppointmentCalendar
        month={new Date(2026, 7, 1)}
        days={days}
        timeZoneId="America/Sao_Paulo"
        selectedDate="2026-08-10"
        onMonthChange={vi.fn()}
        onDateChange={onDateChange}
      />,
    );

    const selected = screen.getByRole("button", {
      name: "10 de agosto de 2026, disponível, selecionado",
      pressed: true,
    });
    expect(within(selected).getByText("Selecionado")).toBeVisible();
    fireEvent.click(selected);
    expect(onDateChange).toHaveBeenCalledWith("2026-08-10");
  });

  test("navega por meses a partir do primeiro dia de forma previsível", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12));
    const onMonthChange = vi.fn();
    render(
      <AppointmentCalendar
        month={new Date(2026, 7, 18)}
        days={days}
        timeZoneId="America/Sao_Paulo"
        selectedDate={null}
        onMonthChange={onMonthChange}
        onDateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onMonthChange).toHaveBeenNthCalledWith(1, new Date(2026, 8, 1));
    expect(onMonthChange).toHaveBeenNthCalledWith(2, new Date(2026, 6, 1));
  });

  test("define data passada pelo fuso da clínica, não pelo navegador", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T01:00:00Z"));
    const boundaryDay: AvailabilityDay[] = [
      {
        date: "2026-08-10",
        status: "Available",
        slots: [
          {
            startUtc: "2026-08-11T01:30:00Z",
            endUtc: "2026-08-11T02:00:00Z",
            label: "22:30",
          },
        ],
      },
    ];
    const { rerender } = render(
      <AppointmentCalendar
        month={new Date(2026, 7, 1)}
        days={boundaryDay}
        timeZoneId="America/Sao_Paulo"
        selectedDate={null}
        onMonthChange={vi.fn()}
        onDateChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "10 de agosto de 2026, disponível",
      }),
    ).toBeEnabled();

    rerender(
      <AppointmentCalendar
        month={new Date(2026, 7, 1)}
        days={boundaryDay}
        timeZoneId="Europe/Berlin"
        selectedDate={null}
        onMonthChange={vi.fn()}
        onDateChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "10 de agosto de 2026, data passada",
      }),
    ).toBeDisabled();
  });

  test("mantém disponibilidade autoritativa sem quebrar para fuso inválido", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T01:00:00Z"));
    expect(() =>
      render(
        <AppointmentCalendar
          month={new Date(2026, 7, 1)}
          days={days}
          timeZoneId="Fuso/Inexistente"
          selectedDate={null}
          onMonthChange={vi.fn()}
          onDateChange={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(
      screen.getByRole("button", {
        name: "10 de agosto de 2026, disponível",
      }),
    ).toBeEnabled();
  });
});
