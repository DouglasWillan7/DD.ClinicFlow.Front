import type { AvailabilityDay } from "../../api/types";
import {
  getCalendarAvailabilityState,
  getDateOnlyInTimeZone,
} from "./calendarAvailability";

const slot = {
  startUtc: "2026-08-10T12:00:00Z",
  endUtc: "2026-08-10T12:30:00Z",
  label: "09:00",
};
const unavailableCases: Array<
  [AvailabilityDay["status"], AvailabilityDay["slots"], string, boolean]
> = [
  ["Available", [], "sem horários", true],
  ["Full", [], "sem horários", true],
  ["Blocked", [], "bloqueado", false],
  ["NoSchedule", [], "sem agenda", false],
];

function state(
  availability: AvailabilityDay | undefined,
  clinicToday = "2026-08-10",
) {
  return getCalendarAvailabilityState({
    date: availability?.date ?? "2026-08-10",
    availability,
    clinicToday,
    selectedDate: "2026-08-10",
  });
}

test("habilita e seleciona somente data disponível com slot real", () => {
  expect(
    state({ date: "2026-08-10", status: "Available", slots: [slot] }),
  ).toEqual({
    available: true,
    selected: true,
    withoutSlots: false,
    status: "disponível",
  });
});

test.each(unavailableCases)(
  "desabilita status %s com o rótulo compartilhado",
  (status, slots, label, withoutSlots) => {
    expect(state({ date: "2026-08-10", status, slots })).toEqual({
      available: false,
      selected: false,
      withoutSlots,
      status: label,
    });
  },
);

test("desabilita data ausente da disponibilidade", () => {
  expect(state(undefined)).toEqual({
    available: false,
    selected: false,
    withoutSlots: false,
    status: "indisponível",
  });
});

test("data passada no fuso da clínica prevalece sobre o status da API", () => {
  expect(
    state(
      { date: "2026-08-09", status: "Available", slots: [slot] },
      "2026-08-10",
    ),
  ).toEqual({
    available: false,
    selected: false,
    withoutSlots: false,
    status: "data passada",
  });
});

test("permite data passada sem disponibilidade somente para navegação histórica", () => {
  expect(
    getCalendarAvailabilityState({
      date: "2026-08-09",
      availability: undefined,
      clinicToday: "2026-08-10",
      selectedDate: "2026-08-09",
      pastDatesSelectable: true,
    }),
  ).toEqual({
    available: true,
    selected: true,
    withoutSlots: false,
    status: "data passada",
  });
});

test("calcula hoje no fuso da clínica e tolera identificador inválido", () => {
  const instant = new Date("2026-08-11T01:00:00Z");
  expect(getDateOnlyInTimeZone("America/Sao_Paulo", instant)).toBe(
    "2026-08-10",
  );
  expect(getDateOnlyInTimeZone("Europe/Berlin", instant)).toBe("2026-08-11");
  expect(getDateOnlyInTimeZone("Fuso/Inexistente", instant)).toBeNull();
});
