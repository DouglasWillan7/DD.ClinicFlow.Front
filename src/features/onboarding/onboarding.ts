import type { OnboardingStatus, OnboardingStep } from "../../api/types";
import {
  clinicDataPath,
  clinicWhatsAppPath,
} from "../clinic/clinicSettingsPaths";

export const onboardingKey = ["onboarding"] as const;

export function getOnboardingProgress(status: OnboardingStatus) {
  if (status.totalCount === 0) return 0;
  return Math.round((status.completedCount / status.totalCount) * 100);
}

export function getNextOnboardingStep(status: OnboardingStatus) {
  return status.steps.find((step) => !step.completed && !step.blocked);
}

// As abas da clínica são rotas da web: o destino dessas etapas é decidido aqui. Um caminho
// antigo vindo da API ("/app/configuracoes/clinica") abriria a própria lista de etapas.
const clinicStepPaths: Record<string, string> = {
  clinic: clinicDataPath,
  whatsapp: clinicWhatsAppPath,
};

export function getOnboardingStepPath(step: OnboardingStep) {
  return clinicStepPaths[step.code] ?? step.path;
}
