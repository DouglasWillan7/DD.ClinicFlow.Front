import type { HealthcarePlanMode } from "../../api/types";

export const healthcarePlanModeLabels: Record<HealthcarePlanMode, string> = {
  ClinicDefault: "Padrão da clínica",
  Custom: "Personalizado",
};

export function planCountLabel(count: number) {
  if (count === 0) return "nenhum convênio";
  return count === 1 ? "1 convênio" : `${count} convênios`;
}

export function doctorCountLabel(count: number) {
  return count === 1 ? "1 médico" : `${count} médicos`;
}

/** "5 aceitos · 3 padrão", como aparece no item Clínica da lista. */
export function clinicSummaryLabel(accepted: number, defaults: number) {
  const acceptedLabel = accepted === 1 ? "1 aceito" : `${accepted} aceitos`;
  return `${acceptedLabel} · ${defaults} padrão`;
}

/** "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
