import type { Appointment, AvailabilitySlot } from "../../api/types";
import {
  appointmentTimelineTone,
  buildDayTimeline,
  countFreeSlots,
  getDayStats,
} from "./agendaTimeline";

const timeZone = "America/Sao_Paulo";

function appointment(
  overrides: Partial<Appointment> & Pick<Appointment, "id" | "startUtc" | "endUtc">,
): Appointment {
  return {
    patientId: `patient-${overrides.id}`,
    patientName: "Marina Oliveira",
    doctorUserId: "doctor",
    type: "InPerson",
    status: "Confirmed",
    notes: null,
    createdAtUtc: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

function slot(label: string, startUtc: string, endUtc: string): AvailabilitySlot {
  return { label, startUtc, endUtc };
}

describe("appointmentTimelineTone", () => {
  test("traduz o status do backend para o tom visual da agenda", () => {
    expect(appointmentTimelineTone("Confirmed")).toBe("confirmed");
    expect(appointmentTimelineTone("AwaitingPatientAction")).toBe("pending");
    expect(appointmentTimelineTone("AwaitingPatientAction")).toBe("pending");
    expect(appointmentTimelineTone("Completed")).toBe("done");
    expect(appointmentTimelineTone("Cancelled")).toBe("canceled");
    expect(appointmentTimelineTone("NoShow")).toBe("canceled");
  });
});

describe("buildDayTimeline", () => {
  test("ordena consultas e horários livres e cria o intervalo das lacunas", () => {
    const rows = buildDayTimeline({
      appointments: [
        appointment({
          id: "a2",
          startUtc: "2026-08-10T16:00:00Z",
          endUtc: "2026-08-10T17:00:00Z",
        }),
        appointment({
          id: "a1",
          startUtc: "2026-08-10T11:00:00Z",
          endUtc: "2026-08-10T11:30:00Z",
        }),
      ],
      slots: [
        slot("08:30", "2026-08-10T11:30:00Z", "2026-08-10T12:00:00Z"),
        slot("14:00", "2026-08-10T17:00:00Z", "2026-08-10T17:30:00Z"),
      ],
      timeZone,
    });

    expect(
      rows.map((row) => [row.kind, row.start, row.end]),
    ).toEqual([
      ["appointment", "08:00", "08:30"],
      ["free", "08:30", "09:00"],
      ["break", "09:00", "13:00"],
      ["appointment", "13:00", "14:00"],
      ["free", "14:00", "14:30"],
    ]);
    expect(rows[3].durationMinutes).toBe(60);
  });

  test("descarta horário livre que colide com uma consulta do dia", () => {
    const rows = buildDayTimeline({
      appointments: [
        appointment({
          id: "a1",
          startUtc: "2026-08-10T11:00:00Z",
          endUtc: "2026-08-10T12:00:00Z",
        }),
      ],
      slots: [slot("08:30", "2026-08-10T11:30:00Z", "2026-08-10T12:00:00Z")],
      timeZone,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("appointment");
  });

  test("filtro de tipo esconde a consulta sem liberar o horário", () => {
    const rows = buildDayTimeline({
      appointments: [
        appointment({
          id: "a1",
          startUtc: "2026-08-10T11:00:00Z",
          endUtc: "2026-08-10T11:30:00Z",
        }),
        appointment({
          id: "a2",
          startUtc: "2026-08-10T12:00:00Z",
          endUtc: "2026-08-10T12:30:00Z",
          type: "Teleconsultation",
        }),
      ],
      slots: [slot("10:00", "2026-08-10T13:00:00Z", "2026-08-10T13:30:00Z")],
      timeZone,
      typeFilter: "Teleconsultation",
    });

    expect(rows.map((row) => [row.kind, row.start])).toEqual([
      ["hidden", "08:00"],
      ["break", "08:30"],
      ["appointment", "09:00"],
      ["break", "09:30"],
      ["free", "10:00"],
    ]);
    expect(countFreeSlots(rows)).toBe(1);
  });
});

describe("getDayStats", () => {
  test("conta o dia sem incluir canceladas no total", () => {
    const stats = getDayStats([
      appointment({
        id: "a1",
        startUtc: "2026-08-10T11:00:00Z",
        endUtc: "2026-08-10T11:30:00Z",
        status: "Completed",
      }),
      appointment({
        id: "a2",
        startUtc: "2026-08-10T12:00:00Z",
        endUtc: "2026-08-10T12:30:00Z",
        status: "AwaitingPatientAction",
        type: "Teleconsultation",
      }),
      appointment({
        id: "a3",
        startUtc: "2026-08-10T13:00:00Z",
        endUtc: "2026-08-10T13:30:00Z",
        status: "Cancelled",
        type: "Teleconsultation",
      }),
      appointment({
        id: "a4",
        startUtc: "2026-08-10T14:00:00Z",
        endUtc: "2026-08-10T14:30:00Z",
        status: "NoShow",
      }),
    ]);

    expect(stats).toEqual({
      total: 2,
      teleconsultations: 1,
      pending: 1,
      completed: 1,
    });
  });
});
