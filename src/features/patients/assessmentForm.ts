import type { BodyMeasurementType } from "../../api/types";
import {
  measurementInputOrder,
  measurementLabels,
  measurementRanges,
  measurementUnits,
} from "./bodyAssessments";

export type AssessmentDraft = Record<BodyMeasurementType, string>;

export const emptyDraft: AssessmentDraft = Object.fromEntries(
  measurementInputOrder.map((type) => [type, ""]),
) as AssessmentDraft;

export interface MeasurementPayload {
  type: BodyMeasurementType;
  value: number;
}

export interface DraftErrors {
  assessedOn?: string;
  fields: Partial<Record<BodyMeasurementType, string>>;
  summary?: string;
}

export type DraftResult =
  | { ok: true; measurements: MeasurementPayload[] }
  | { ok: false; errors: DraftErrors };

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Aceita "84,5" e "84.5"; devolve null quando o campo ficou em branco. */
function parseDecimal(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Campo em branco significa "não medido nesta data" — nunca repete o valor da avaliação
 * anterior. Herdar em silêncio gravaria uma medição que ninguém fez; a tabela já sabe
 * mostrar lacuna, e o valor anterior aparece como referência abaixo do campo.
 */
export function parseAssessmentDraft(
  assessedOn: string,
  draft: AssessmentDraft,
  today = todayIso(),
): DraftResult {
  const errors: DraftErrors = { fields: {} };
  const measurements: MeasurementPayload[] = [];

  if (!assessedOn) {
    errors.assessedOn = "Informe a data da avaliação.";
  } else if (assessedOn > today) {
    errors.assessedOn = "A data da avaliação não pode estar no futuro.";
  }

  for (const type of measurementInputOrder) {
    const value = parseDecimal(draft[type]);
    if (value === null) continue;

    if (Number.isNaN(value)) {
      errors.fields[type] = "Informe um número.";
      continue;
    }

    const { min, max } = measurementRanges[type];
    if (value < min || value > max) {
      errors.fields[type] = `Informe entre ${min} e ${max} ${measurementUnits[type]}.`;
      continue;
    }

    measurements.push({ type, value: Number(value.toFixed(1)) });
  }

  if (measurements.length === 0 && Object.keys(errors.fields).length === 0) {
    errors.summary = "Preencha ao menos uma medida.";
  }

  if (errors.assessedOn || errors.summary || Object.keys(errors.fields).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, measurements };
}

export function fieldLabel(type: BodyMeasurementType) {
  return `${measurementLabels[type]} (${measurementUnits[type]})`;
}
