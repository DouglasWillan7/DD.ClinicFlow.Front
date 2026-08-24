import { z } from "zod";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import type { BloodType, SexForClinicalUse } from "../../api/types";
import { normalizeCpf as normalizeCpfDigits } from "./patientFormatters";

function isValidCpf(value: string) {
  const cpf = normalizeCpfDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo.").max(120),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => /^\+\d{10,15}$/.test(value) && isPossiblePhoneNumber(value),
      "Informe um WhatsApp válido para o país selecionado.",
    ),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido."),
  bloodType: z
    .enum([
      "APositive",
      "ANegative",
      "BPositive",
      "BNegative",
      "ABPositive",
      "ABNegative",
      "OPositive",
      "ONegative",
    ])
    .nullable(),
  sexForClinicalUse: z.enum(["Feminino", "Masculino"]).nullable(),
  doctorUserId: z.string().min(1, "Selecione o médico responsável."),
  birthDate: z.string(),
  notes: z.string().max(2000),
});

export type PatientFormValue = {
  name: string;
  phone: string;
  cpf: string;
  bloodType: BloodType | null;
  sexForClinicalUse: SexForClinicalUse | null;
  doctorUserId: string;
  birthDate: string;
  notes: string;
};

export const emptyPatientForm: PatientFormValue = {
  name: "",
  phone: "",
  cpf: "",
  bloodType: null,
  sexForClinicalUse: null,
  doctorUserId: "",
  birthDate: "",
  notes: "",
};

export const normalizeCpf = normalizeCpfDigits;

export function toPatientPayload(value: PatientFormValue) {
  return {
    name: value.name.trim(),
    phone: value.phone.trim(),
    cpf: normalizeCpf(value.cpf),
    bloodType: value.bloodType,
    sexForClinicalUse: value.sexForClinicalUse,
    doctorUserId: value.doctorUserId,
    birthDate: value.birthDate || null,
    notes: value.notes.trim() || null,
  };
}

export function getSafeReturnTo(returnTo: string | null) {
  if (!returnTo?.startsWith("/")) return "/app/pacientes";
  try {
    const base = new URL("https://clinicflow.local");
    const candidate = new URL(returnTo, base);
    if (
      candidate.origin !== base.origin ||
      candidate.pathname !== "/app/agenda/nova"
    ) {
      return "/app/pacientes";
    }
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return "/app/pacientes";
  }
}
