/** Abaixo deste corte a leitura da IA pede conferência item a item contra o PDF. */
export const LOW_CONFIDENCE_THRESHOLD = 0.93;

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function confidencePresentation(confidence: number | null) {
  if (confidence === null) {
    return { label: "Confiança não informada", isLow: false };
  }

  return {
    label: new Intl.NumberFormat("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(confidence),
    isLow: confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

export function formatExamResultValue(result: {
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
}) {
  if (result.numericValue !== null) {
    const value = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(result.numericValue);
    return result.unit ? `${value} ${result.unit}` : value;
  }
  return result.textValue?.trim() || "Não informado";
}

export function formatExamDate(value: string | null) {
  if (!value) return "Não informada";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function formatExamDateTime(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function processingAttemptsLabel(attemptsRemaining: number) {
  if (attemptsRemaining <= 0) {
    return "Nenhuma tentativa restante. Envie outro PDF para continuar.";
  }
  return `${attemptsRemaining} ${attemptsRemaining === 1 ? "tentativa restante" : "tentativas restantes"}`;
}
