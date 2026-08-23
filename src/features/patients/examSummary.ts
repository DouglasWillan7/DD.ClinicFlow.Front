import type { ExamGrid, ExamUpload, ExamUploadStatus } from "../../api/types";

export const examUploadStatusLabels: Record<ExamUploadStatus, string> = {
  Pendente: "Na fila",
  Processando: "Em leitura",
  EmRevisao: "Aguardando revisão",
  Confirmado: "Confirmado",
  Falhou: "Falhou",
};

export interface CollectionItem {
  name: string;
  unit: string | null;
  valueText: string;
  outOfRange: boolean;
}

export interface Collection {
  date: string;
  items: CollectionItem[];
  outOfRangeCount: number;
}

/**
 * Última coluna do grid com resultado: todos os analitos coletados naquela data,
 * na ordem em que o backend já agrupou (catálogo primeiro, depois nome cru).
 */
export function latestCollection(grid: ExamGrid | undefined): Collection | null {
  if (!grid || grid.dates.length === 0) return null;

  for (let column = grid.dates.length - 1; column >= 0; column -= 1) {
    const items = grid.rows
      .map((row) => {
        const cell = row.cells[column];
        return cell
          ? {
              name: row.name,
              unit: row.unit,
              valueText: cell.valueText,
              outOfRange: cell.outOfRange,
            }
          : null;
      })
      .filter((item): item is CollectionItem => item !== null);

    if (items.length > 0) {
      return {
        date: grid.dates[column],
        items,
        outOfRangeCount: items.filter((item) => item.outOfRange).length,
      };
    }
  }

  return null;
}

export interface ExamOverview {
  collectionCount: number;
  analyteCount: number;
  /** Analitos com o valor mais recente fora da faixa de referência. */
  outOfRangeCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function examOverview(grid: ExamGrid | undefined): ExamOverview {
  if (!grid || grid.dates.length === 0) {
    return {
      collectionCount: 0,
      analyteCount: 0,
      outOfRangeCount: 0,
      firstDate: null,
      lastDate: null,
    };
  }

  const outOfRangeCount = grid.rows.filter((row) => {
    // Conta pelo resultado mais recente de cada analito, não por ocorrência histórica.
    const latest = [...row.cells].reverse().find((cell) => cell !== null);
    return latest?.outOfRange ?? false;
  }).length;

  return {
    collectionCount: grid.dates.length,
    analyteCount: grid.rows.length,
    outOfRangeCount,
    firstDate: grid.dates[0],
    lastDate: grid.dates[grid.dates.length - 1],
  };
}

/** Envios que ainda pedem ação do médico ou estão a caminho da tabela. */
export function pendingUploads(uploads: ExamUpload[] | undefined) {
  return (uploads ?? []).filter(
    (upload) => upload.status !== "Confirmado" && upload.status !== "Falhou",
  );
}

export function failedUploads(uploads: ExamUpload[] | undefined) {
  return (uploads ?? []).filter((upload) => upload.status === "Falhou");
}
