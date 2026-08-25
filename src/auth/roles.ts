import type { UserRole } from "../api/types";

interface WithRoles {
  roles: readonly UserRole[];
}

export const roleLabels: Record<UserRole, string> = {
  Admin: "Administração",
  Doctor: "Médico",
  Nurse: "Enfermagem",
  Secretary: "Secretaria",
};

function isUserRole(value: unknown): value is UserRole {
  return value === "Admin" || value === "Doctor" || value === "Nurse" || value === "Secretary";
}

export function getRoles(subject: WithRoles | null | undefined): UserRole[] {
  const roles = subject?.roles?.filter(isUserRole) ?? [];
  return [...new Set(roles)];
}

export function hasRole(subject: WithRoles | null | undefined, role: UserRole) {
  return getRoles(subject).includes(role);
}

export function formatRoles(subject: WithRoles | null | undefined) {
  const roles = getRoles(subject);
  return roles.length > 0
    ? roles.map((role) => roleLabels[role]).join(" · ")
    : "Função não informada";
}
