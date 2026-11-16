import type { HealthcarePlanMode } from "../../api/types";

export const healthcarePlanModeLabels: Record<HealthcarePlanMode, string> = {
  ClinicDefault: "Padrão da clínica",
  Custom: "Personalizado",
};

export function planCountLabel(count: number) {
  if (count === 0) return "nenhum convênio";
  return count === 1 ? "1 convênio" : `${count} convênios`;
}

export function sameSelection(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}
