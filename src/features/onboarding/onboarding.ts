import type { OnboardingStatus } from "../../api/types";

export const onboardingKey = ["onboarding"] as const;

export function getOnboardingProgress(status: OnboardingStatus) {
  if (status.totalCount === 0) return 0;
  return Math.round((status.completedCount / status.totalCount) * 100);
}

export function getNextOnboardingStep(status: OnboardingStatus) {
  return status.steps.find((step) => !step.completed && !step.blocked);
}
