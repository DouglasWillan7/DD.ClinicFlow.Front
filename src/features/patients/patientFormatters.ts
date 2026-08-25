import type { BloodType } from "../../api/types";
import { bloodTypeLabels } from "../appointments/appointmentLabels";

export { bloodTypeLabels } from "../appointments/appointmentLabels";

export const bloodTypeOptions = Object.entries(bloodTypeLabels) as Array<
  [BloodType, string]
>;

export function formatPatientDocument(
  countryCode: string,
  documentType: string,
  value: string,
) {
  if (countryCode !== "BR" || documentType !== "CPF") return value;
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatBloodType(value: BloodType) {
  return bloodTypeLabels[value];
}

export function formatMedicalRecord(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatBirthDate(value: string | null) {
  if (!value) return "Nascimento não informado";
  const parsed = parseDateOnly(value);
  if (!parsed) return "Nascimento não informado";
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year}`;
}

/** Datas sem hora (coleta, avaliação) no mesmo formato da lista de pacientes. */
export function formatDateOnly(value: string | null) {
  if (!value) return "—";
  const parsed = parseDateOnly(value);
  if (!parsed) return "—";
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year}`;
}

export function getAge(
  birthDate: string | null,
  referenceDate = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = parseDateOnly(birthDate);
  if (!parsed) return null;
  let age = referenceDate.getFullYear() - parsed.year;
  const birthdayHasPassed =
    referenceDate.getMonth() + 1 > parsed.month ||
    (referenceDate.getMonth() + 1 === parsed.month &&
      referenceDate.getDate() >= parsed.day);
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? age : null;
}
