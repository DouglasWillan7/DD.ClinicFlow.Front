import { describe, expect, test } from "vitest";
import type { PatientExamPage, PatientExamSummary } from "../../../api/types";
import { examGroupLabel, flattenExamPages, groupExams } from "./examList";

function exam(id: string, status: PatientExamSummary["status"]): PatientExamSummary {
  return {
    id,
    patientId: "patient-1",
    name: `Exame ${id}`,
    category: "Laboratório",
    scheduledOn: null,
    status,
    version: 1,
    hasDocument: status !== "Solicitado",
    averageConfidence: null,
    createdAtUtc: "2026-08-01T10:00:00Z",
    updatedAtUtc: "2026-08-01T10:00:00Z",
  };
}

const page = (items: PatientExamSummary[]): PatientExamPage => ({
  items,
  nextCursor: null,
  capabilities: { canRequest: true, canAttachDocument: true },
});

describe("groupExams", () => {
  test("agrupa na ordem operacional e omite grupos vazios", () => {
    const groups = groupExams([
      exam("validated", "Validado"),
      exam("pending", "Pendente"),
      exam("review", "Em revisão"),
      exam("failed", "Falhou"),
    ]);

    expect(groups.map((group) => [group.label, group.items.map((item) => item.id)]))
      .toEqual([
        ["Revisar", ["review"]],
        ["Falhas", ["failed"]],
        ["Em andamento", ["pending"]],
        ["Histórico validado", ["validated"]],
      ]);
  });

  test("mantém solicitados, pendentes e processando no mesmo grupo", () => {
    expect(groupExams([
      exam("requested", "Solicitado"),
      exam("pending", "Pendente"),
      exam("processing", "Processando"),
    ])[0].items.map((item) => item.id)).toEqual(["requested", "pending", "processing"]);
  });

  test("coloca cancelados por último quando recebidos da consulta opt-in", () => {
    expect(groupExams([exam("cancelled", "Cancelado")])[0].label).toBe("Cancelados");
  });

  test("mapeia todo estado para um grupo nomeado", () => {
    expect([
      "Solicitado", "Pendente", "Processando", "Em revisão", "Validado", "Falhou", "Cancelado",
    ].map((status) => examGroupLabel(status as PatientExamSummary["status"]))).toEqual([
      "Em andamento", "Em andamento", "Em andamento", "Revisar", "Histórico validado", "Falhas", "Cancelados",
    ]);
  });
});

describe("flattenExamPages", () => {
  test("anexa páginas sem duplicar o item de fronteira", () => {
    expect(flattenExamPages([
      page([exam("one", "Pendente"), exam("shared", "Falhou")]),
      page([exam("shared", "Falhou"), exam("three", "Validado")]),
    ]).map((item) => item.id)).toEqual(["one", "shared", "three"]);
  });

  test("preserva a primeira ocorrência para manter a ordem do cursor", () => {
    const first = exam("shared", "Pendente");
    const repeated = { ...first, status: "Validado" as const };
    expect(flattenExamPages([page([first]), page([repeated])])[0].status).toBe("Pendente");
  });
});
