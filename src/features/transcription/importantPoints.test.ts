import { ApiError } from "../../api/client";
import { describe, expect, test, vi } from "vitest";
import {
  ConsultationPointConflictError,
  consultationImportantPointsQueryKey,
  getConsultationImportantPoints,
  getConsultationPointCategoryLabel,
  getConsultationPointStatusLabel,
  reviewConsultationImportantPoint,
  saveConsultationImportantPoints,
} from "./importantPoints";

const appointmentId = "55555555-5555-4555-8555-555555555555";
const pointId = "66666666-6666-4666-8666-666666666666";
const sessionId = "44444444-4444-4444-8444-444444444444";
const segmentId = "77777777-7777-4777-8777-777777777777";

const rawPoint = {
  id: pointId,
  category: "Symptom",
  generatedText: "Paciente relata dor epigástrica após as refeições.",
  reviewedText: null,
  displayText: "Paciente relata dor epigástrica após as refeições.",
  status: "Draft",
  version: 1,
  firstEvidenceStartTimeMs: 12_000,
  evidence: [{
    segmentId,
    quote: "dor epigástrica",
    quoteStart: 16,
    quoteLength: 16,
    startTimeMs: 12_000,
  }],
};

describe("rótulos de pontos importantes", () => {
  test.each([
    ["Symptom", "Sintoma"],
    ["Alert", "Alerta"],
    ["Medication", "Medicação"],
    ["Habit", "Hábito"],
    ["Conduct", "Conduta"],
    ["Exam", "Exame"],
    ["Guidance", "Orientação"],
  ] as const)("mapeia a categoria %s para %s", (category, label) => {
    expect(getConsultationPointCategoryLabel(category)).toBe(label);
  });

  test.each([
    ["Draft", "Revisão pendente"],
    ["Accepted", "Aceito"],
    ["Rejected", "Rejeitado"],
    ["Saved", "Salvo"],
  ] as const)("mapeia o estado %s para %s", (status, label) => {
    expect(getConsultationPointStatusLabel(status)).toBe(label);
  });

  test("não expõe categoria desconhecida como enum bruto", () => {
    expect(getConsultationPointCategoryLabel("Diagnosis")).toBe("Categoria não reconhecida");
  });

  test("não expõe estado desconhecido como enum bruto", () => {
    expect(getConsultationPointStatusLabel("Approved")).toBe("Estado não reconhecido");
  });
});

describe("adaptadores de pontos importantes", () => {
  test("mantém uma chave de consulta estável por consulta", () => {
    expect(consultationImportantPointsQueryKey(appointmentId)).toEqual([
      "consultation-important-points",
      appointmentId,
    ]);
  });

  test("carrega e valida o snapshot persistido", async () => {
    const request = vi.fn().mockResolvedValue({
      sessionId,
      processingStatus: "Available",
      waitingForSpeakerCount: 0,
      updatedAtUtc: "2026-08-13T12:00:00Z",
      points: [rawPoint],
    });

    await expect(getConsultationImportantPoints(request, appointmentId)).resolves.toEqual({
      sessionId,
      processingStatus: "Available",
      waitingForSpeakerCount: 0,
      updatedAtUtc: "2026-08-13T12:00:00Z",
      points: [rawPoint],
    });
    expect(request).toHaveBeenCalledWith(`/consultations/${appointmentId}/important-points`);
  });

  test("falha com mensagem segura quando a API devolve enum inválido", async () => {
    const request = vi.fn().mockResolvedValue({
      sessionId,
      processingStatus: "Available",
      waitingForSpeakerCount: 0,
      updatedAtUtc: null,
      points: [{ ...rawPoint, category: "Diagnosis" }],
    });

    await expect(getConsultationImportantPoints(request, appointmentId)).rejects.toThrow(
      "A resposta dos pontos importantes é inválida.",
    );
  });

  test("envia revisão com ação, texto e versão esperada", async () => {
    const request = vi.fn().mockResolvedValue({
      ...rawPoint,
      reviewedText: "Dor epigástrica após refeições.",
      displayText: "Dor epigástrica após refeições.",
      version: 2,
    });

    const result = await reviewConsultationImportantPoint(request, pointId, {
      action: "Edit",
      text: "Dor epigástrica após refeições.",
      expectedVersion: 1,
    });

    expect(result.version).toBe(2);
    expect(result.displayText).toBe("Dor epigástrica após refeições.");
    expect(request).toHaveBeenCalledWith(`/consultation-important-points/${pointId}/review`, {
      method: "PUT",
      body: JSON.stringify({
        action: "Edit",
        text: "Dor epigástrica após refeições.",
        expectedVersion: 1,
      }),
    });
  });

  test("converte conflito de revisão em erro com o ponto atual validado", async () => {
    const currentPoint = { ...rawPoint, status: "Accepted", version: 2 };
    const request = vi.fn().mockRejectedValue(new ApiError(
      "O ponto foi alterado.",
      409,
      { currentPoint } as never,
    ));

    const error = await reviewConsultationImportantPoint(request, pointId, {
      action: "Accept",
      text: null,
      expectedVersion: 1,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ConsultationPointConflictError);
    expect((error as ConsultationPointConflictError).currentPoint.status).toBe("Accepted");
    expect((error as ConsultationPointConflictError).currentPoint.version).toBe(2);
  });

  test("não converte conflito sem currentPoint válido em estado clínico", async () => {
    const apiError = new ApiError("O ponto foi alterado.", 409, {
      currentPoint: { ...rawPoint, status: "Approved" },
    } as never);
    const request = vi.fn().mockRejectedValue(apiError);

    await expect(reviewConsultationImportantPoint(request, pointId, {
      action: "Accept",
      text: null,
      expectedVersion: 1,
    })).rejects.toBe(apiError);
  });

  test("salva com o identificador idempotente da tentativa", async () => {
    const saveRequestId = "88888888-8888-4888-8888-888888888888";
    const savedPoint = { ...rawPoint, status: "Saved", version: 2 };
    const request = vi.fn().mockResolvedValue([savedPoint]);

    await expect(saveConsultationImportantPoints(
      request,
      appointmentId,
      saveRequestId,
    )).resolves.toEqual([savedPoint]);
    expect(request).toHaveBeenCalledWith(`/consultations/${appointmentId}/important-points/save`, {
      method: "POST",
      body: JSON.stringify({ saveRequestId }),
    });
  });
});
