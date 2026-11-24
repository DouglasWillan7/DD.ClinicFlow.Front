import { useQuery } from "@tanstack/react-query";
import type { OnboardingStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { onboardingKey } from "./onboarding";

/** Progresso da configuração da clínica. A API só responde a quem administra a clínica. */
export function useOnboardingStatus({ enabled = true }: { enabled?: boolean } = {}) {
  const { request } = useAuth();
  return useQuery({
    queryKey: onboardingKey,
    enabled,
    queryFn: () => request<OnboardingStatus>("/onboarding/status"),
  });
}
