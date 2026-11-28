import type { ClinicMember } from "../../api/types";

// Rotas do perfil de um integrante em Equipe. Cada aba é uma rota, como as seções do
// paciente: o link é compartilhável e o Voltar do navegador volta à aba anterior.
export const teamPath = "/app/equipe";

export type MemberProfileSection = "membership" | "availability" | "plans";

/**
 * Disponibilidade e Convênios pertencem ao vínculo de médico; os demais papéis só têm
 * a aba Vínculo e ficam sem barra de abas.
 */
export function hasDoctorSections(member: ClinicMember) {
  return member.role === "Doctor";
}

const sectionSegments: Record<MemberProfileSection, string> = {
  membership: "",
  availability: "/disponibilidade",
  plans: "/convenios",
};

export const memberProfileSectionLabels: Record<MemberProfileSection, string> = {
  membership: "Vínculo",
  availability: "Disponibilidade",
  plans: "Convênios",
};

export function memberProfilePath(
  userClinicId: string,
  section: MemberProfileSection = "membership",
) {
  return `${teamPath}/${encodeURIComponent(userClinicId)}${sectionSegments[section]}`;
}

// /app/equipe/novo é o cadastro, não o perfil de um vínculo chamado "novo".
const memberProfilePattern =
  /^\/app\/equipe\/(?!novo(?:\/|$))([^/]+)(?:\/(disponibilidade|convenios))?$/i;

export function parseMemberProfilePath(
  pathname: string,
): { userClinicId: string; section: MemberProfileSection } | undefined {
  const match = pathname.match(memberProfilePattern);
  if (!match) return undefined;
  let userClinicId: string;
  try {
    userClinicId = decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
  const segment = match[2]?.toLowerCase();
  return {
    userClinicId,
    section:
      segment === "disponibilidade"
        ? "availability"
        : segment === "convenios"
          ? "plans"
          : "membership",
  };
}
