import type { DoctorSchedule } from "../../api/types";
import {
  buildScheduleRequest,
  emptyScheduleDraft,
  scheduleToDraft,
  suggestedInterval,
} from "./scheduleForm";

describe("schedule form", () => {
  test("normaliza o horário da API e ordena períodos antes de salvar", () => {
    const schedule: DoctorSchedule = {
      doctorUserId: "doctor-1",
      slotDurationMinutes: 45,
      blocks: [],
      intervals: [
        {
          id: "afternoon",
          dayOfWeek: "Monday",
          startLocal: "13:00:00",
          endLocal: "18:00:00",
        },
        {
          id: "morning",
          dayOfWeek: "Monday",
          startLocal: "08:00:00",
          endLocal: "12:00:00",
        },
      ],
    };

    const result = buildScheduleRequest(scheduleToDraft(schedule), 45);

    expect(result.error).toBeUndefined();
    expect(result.request).toEqual({
      defaultAppointmentDurationMinutes: 45,
      intervals: [
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
        { dayOfWeek: "Monday", startLocal: "13:00", endLocal: "18:00" },
      ],
    });
  });

  test("rejeita sobreposição no mesmo dia", () => {
    const draft = emptyScheduleDraft();
    draft.Tuesday = [
      { id: "first", startLocal: "08:00", endLocal: "12:00" },
      { id: "second", startLocal: "11:30", endLocal: "14:00" },
    ];

    expect(buildScheduleRequest(draft, 30)).toEqual({
      error: "Os períodos de Terça-feira não podem se sobrepor.",
    });
  });

  test("rejeita período menor que a duração da consulta", () => {
    const draft = emptyScheduleDraft();
    draft.Wednesday = [
      { id: "short", startLocal: "09:00", endLocal: "09:30" },
    ];

    expect(buildScheduleRequest(draft, 45)).toEqual({
      error: "Em Quarta-feira, cada período deve ter ao menos 45 minutos.",
    });
  });

  test("permite agenda vazia e sugere o primeiro período sem persistir", () => {
    expect(buildScheduleRequest(emptyScheduleDraft(), 30).request?.intervals).toEqual([]);
    expect(suggestedInterval([], 30)).toMatchObject({
      startLocal: "08:00",
      endLocal: "12:00",
    });
  });
});
