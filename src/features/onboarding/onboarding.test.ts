import type { OnboardingStatus } from "../../api/types";
import {
  getNextOnboardingStep,
  getOnboardingProgress,
} from "./onboarding";

const status: OnboardingStatus = {
  completed: false,
  completedCount: 2,
  totalCount: 5,
  steps: [
    {
      code: "clinic",
      label: "Clínica",
      path: "/clinic",
      completed: true,
      blocked: false,
    },
    {
      code: "doctor",
      label: "Médico",
      path: "/team",
      completed: false,
      blocked: false,
    },
    {
      code: "patient",
      label: "Paciente",
      path: "/patient",
      completed: false,
      blocked: true,
    },
  ],
};

describe("onboarding helpers", () => {
  it("calcula o progresso a partir do backend", () => {
    expect(getOnboardingProgress(status)).toBe(40);
  });

  it("encontra a primeira etapa pendente", () => {
    expect(getNextOnboardingStep(status)?.code).toBe("doctor");
  });

  it("não oferece uma etapa cuja dependência ainda está bloqueada", () => {
    const blockedFirst = {
      ...status,
      steps: status.steps.map((step) => ({
        ...step,
        blocked: step.code !== "clinic",
      })),
    };

    expect(getNextOnboardingStep(blockedFirst)).toBeUndefined();
  });
});
