import { describe, expect, it } from "vitest";
import type { ExamGrid, ExamUpload } from "../../api/types";
import {
  examOverview,
  failedUploads,
  latestCollection,
  pendingUploads,
} from "./examSummary";

const grid: ExamGrid = {
  dates: ["2025-11-12", "2026-01-21"],
  rows: [
    {
      catalogCode: "glicose",
      name: "Glicose em jejum",
      unit: "mg/dL",
      cells: [
        { value: 92, valueText: "92", outOfRange: false },
        { value: 97, valueText: "97", outOfRange: false },
      ],
    },
    {
      catalogCode: "colesterol",
      name: "Colesterol total",
      unit: "mg/dL",
      cells: [
        { value: 180, valueText: "180", outOfRange: false },
        { value: 195, valueText: "195", outOfRange: true },
      ],
    },
    {
      catalogCode: "hb",
      name: "Hemoglobina",
      unit: "g/dL",
      // só na primeira coleta, e fora da faixa lá
      cells: [{ value: 9.6, valueText: "9,6", outOfRange: true }, null],
    },
  ],
};

describe("latestCollection", () => {
  it("usa a coleta mais recente com resultado", () => {
    const collection = latestCollection(grid)!;

    expect(collection.date).toBe("2026-01-21");
    expect(collection.items.map((i) => i.name)).toEqual([
      "Glicose em jejum",
      "Colesterol total",
    ]);
    expect(collection.outOfRangeCount).toBe(1);
  });

  it("cai para a coleta anterior quando a última coluna está vazia", () => {
    const withEmptyTail: ExamGrid = {
      dates: [...grid.dates, "2026-03-02"],
      rows: grid.rows.map((row) => ({ ...row, cells: [...row.cells, null] })),
    };

    expect(latestCollection(withEmptyTail)?.date).toBe("2026-01-21");
  });

  it("devolve null sem exames", () => {
    expect(latestCollection({ dates: [], rows: [] })).toBeNull();
    expect(latestCollection(undefined)).toBeNull();
  });
});

describe("examOverview", () => {
  it("conta coletas, analitos e alterados pelo resultado mais recente de cada um", () => {
    const overview = examOverview(grid);

    expect(overview.collectionCount).toBe(2);
    expect(overview.analyteCount).toBe(3);
    // colesterol (última coleta) e hemoglobina (último resultado disponível é o de novembro)
    expect(overview.outOfRangeCount).toBe(2);
    expect(overview.firstDate).toBe("2025-11-12");
    expect(overview.lastDate).toBe("2026-01-21");
  });

  it("zera tudo sem exames", () => {
    expect(examOverview({ dates: [], rows: [] })).toEqual({
      collectionCount: 0,
      analyteCount: 0,
      outOfRangeCount: 0,
      firstDate: null,
      lastDate: null,
    });
  });
});

describe("uploads", () => {
  const upload = (
    id: string,
    status: ExamUpload["status"],
  ): ExamUpload => ({
    id,
    patientId: "p1",
    patientName: "Rita",
    fileName: `${id}.pdf`,
    source: "Clinica",
    status,
    error: null,
    createdAtUtc: "2026-01-21T12:00:00Z",
  });

  it("separa o que ainda pede ação do que já terminou", () => {
    const list = [
      upload("a", "Pendente"),
      upload("b", "EmRevisao"),
      upload("c", "Confirmado"),
      upload("d", "Falhou"),
    ];

    expect(pendingUploads(list).map((u) => u.id)).toEqual(["a", "b"]);
    expect(failedUploads(list).map((u) => u.id)).toEqual(["d"]);
    expect(pendingUploads(undefined)).toEqual([]);
  });
});
