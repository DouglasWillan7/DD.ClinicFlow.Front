import type { Doctor } from "../../api/types";

export const doctorsKey = ["clinic", "doctors"] as const;
export const healthInsurancePlansKey = ["health-insurance-plans"] as const;

export function doctorKey(userId: string) {
  return ["clinic", "doctors", userId] as const;
}

export function getDoctorName(doctor: Doctor) {
  return doctor.name?.trim() || doctor.email;
}

/** Situação do acesso em texto — estado nunca depende só de cor (DESIGN.md). */
export function getAccessLabel(doctor: Doctor) {
  if (doctor.hasAccess) return "Acesso ativo";
  return doctor.hasPendingInvitation ? "Convite enviado" : "Sem acesso";
}

/** Link que o médico abre para definir a senha; o token só existe nesta resposta. */
export function buildActivationLink(email: string, token: string) {
  const params = new URLSearchParams({ email, token });
  return `${window.location.origin}/ativar?${params.toString()}`;
}
