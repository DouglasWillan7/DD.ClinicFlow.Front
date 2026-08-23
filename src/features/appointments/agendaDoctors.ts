import type { Member } from "../../api/types";
import { hasRole } from "../../auth/roles";

export function getDoctorName(doctor: Member) {
  return doctor.name?.trim() || doctor.email;
}

/** Rótulo curto do CTA: as duas primeiras palavras ("Dra. Helena Costa"). */
export function getShortDoctorName(doctor: Member) {
  return getDoctorName(doctor).split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
}

export function listDoctors(members: Member[]) {
  return members.filter((member) => hasRole(member, "Doctor"));
}

/**
 * Escolhe qual agenda abrir: a pedida na URL, senão a do próprio médico
 * logado e, por último, o primeiro vínculo da clínica.
 */
export function resolveActiveDoctor(
  doctors: Member[],
  requestedId: string | null,
  sessionUserId: string | undefined,
) {
  return (
    doctors.find((doctor) => doctor.userId === requestedId) ??
    doctors.find((doctor) => doctor.userId === sessionUserId) ??
    doctors[0] ??
    null
  );
}

export function formatFreeSlots(count: number) {
  return count === 1 ? "1 horário livre" : `${count} horários livres`;
}
