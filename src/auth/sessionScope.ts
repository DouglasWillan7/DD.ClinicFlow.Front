import type { AuthResponse } from "../api/types";

export const SCOPED_SESSION_STORAGE_PREFIX = "clinicflow.scoped.";

type SessionIdentity = Pick<AuthResponse, "clinicId" | "userId" | "roles">;

export function getAuthScope(session: SessionIdentity) {
  return `${session.clinicId}:${session.userId}:${[...session.roles].sort().join(",")}`;
}

export function clearScopedSessionStorage() {
  try {
    const keys = Array.from(
      { length: sessionStorage.length },
      (_, index) => sessionStorage.key(index),
    ).filter(
      (key): key is string =>
        Boolean(key?.startsWith(SCOPED_SESSION_STORAGE_PREFIX)),
    );
    for (const key of keys) sessionStorage.removeItem(key);
    sessionStorage.removeItem("clinicflow.new-appointment-draft");
  } catch {
    // A troca de identidade continua mesmo sem acesso ao storage efêmero.
  }
}
