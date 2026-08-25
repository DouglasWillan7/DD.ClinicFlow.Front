import { z } from "zod";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import type { BloodType, SexForClinicalUse } from "../../api/types";

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo.").max(120),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => /^\+\d{10,15}$/.test(value) && isPossiblePhoneNumber(value),
      "Informe um WhatsApp válido para o país selecionado.",
    ),
  documentCountryCode: z.string().length(2, "Selecione o país do documento."),
  documentType: z.string().trim().min(2, "Selecione o tipo de documento."),
  document: z.string().trim().min(3, "Informe o documento.").max(80),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido.")]),
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
  birthDate: z.string(),
  notes: z.string().max(2000),
}).superRefine((value, context) => {
  if (
    value.documentCountryCode === "BR" &&
    value.documentType === "CPF" &&
    value.document.replace(/\D/g, "").length !== 11
  ) {
    context.addIssue({
      code: "custom",
      path: ["document"],
      message: "Informe um CPF com 11 dígitos.",
    });
  }
});

export type PatientFormValue = {
  name: string;
  phone: string;
  documentCountryCode: string;
  documentType: string;
  document: string;
  email: string;
  bloodType: BloodType | null;
  sexForClinicalUse: SexForClinicalUse | null;
  birthDate: string;
  notes: string;
};

export const emptyPatientForm: PatientFormValue = {
  name: "",
  phone: "",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "",
  email: "",
  bloodType: null,
  sexForClinicalUse: null,
  birthDate: "",
  notes: "",
};

export function toPatientPayload(value: PatientFormValue) {
  return {
    name: value.name.trim(),
    phone: value.phone.trim(),
    documentCountryCode: value.documentCountryCode,
    documentType: value.documentType,
    document: value.document.trim(),
    email: value.email.trim() || null,
    bloodType: value.bloodType,
    sexForClinicalUse: value.sexForClinicalUse,
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
