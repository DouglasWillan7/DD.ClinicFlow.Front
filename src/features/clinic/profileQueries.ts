import { useQuery } from "@tanstack/react-query";
import type { CurrentUser } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";

export const currentUserKey = ["user", "me"] as const;

/** Perfil da pessoa na clínica do contexto; as abas de Meu perfil dividem o mesmo cache. */
export function useCurrentUser() {
  const { request } = useAuth();
  return useQuery({
    queryKey: currentUserKey,
    queryFn: () => request<CurrentUser>("/users/me"),
  });
}
