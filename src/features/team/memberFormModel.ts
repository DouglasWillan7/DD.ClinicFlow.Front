import { z } from "zod";
import type {
  ClinicMember,
  ClinicRole,
  DoctorMembershipProfile,
} from "../../api/types";

const phonePattern = /^\+[1-9]\d{7,14}$/;

export interface ClinicMemberFormValue {
  countryCode: string;
  documentType: string;
  document: string;
  name: string;
  email: string;
  phone: string;
  role: ClinicRole;
  isAdmin: boolean;
  professionalAuthority: string;
  professionalRegistrationNumber: string;
  professionalRegistrationRegion: string;
  professionalRegistrationCountryCode: string;
  specialty: string;
  practiceAreas: string;
  bio: string;
  defaultAppointmentDurationMinutes: string;
}

export interface CreateClinicMemberPayload {
  documentCountryCode: string;
  documentType: string;
  document: string;
  name: string;
  email: string;
  phone: string;
  role: ClinicRole;
  isAdmin: boolean;
  doctorProfile: DoctorMembershipProfile | null;
}

export interface UpdateClinicMemberPayload {
  email: string;
  phone: string;
  role: ClinicRole;
  isAdmin: boolean;
  doctorProfile: DoctorMembershipProfile | null;
  reason: string;
}

export type ClinicMemberPayload =
  | CreateClinicMemberPayload
  | UpdateClinicMemberPayload;

export const emptyClinicMemberForm: ClinicMemberFormValue = {
  countryCode: "BR",
  documentType: "CPF",
  document: "",
  name: "",
  email: "",
  phone: "",
  role: "Secretary",
  isAdmin: false,
  professionalAuthority: "",
  professionalRegistrationNumber: "",
  professionalRegistrationRegion: "",
  professionalRegistrationCountryCode: "BR",
  specialty: "",
  practiceAreas: "",
  bio: "",
  defaultAppointmentDurationMinutes: "",
};

const nullableText = (value: string) => value.trim() || null;

export function hasDoctorData(value: ClinicMemberFormValue) {
  return [
    value.professionalAuthority,
    value.professionalRegistrationNumber,
    value.professionalRegistrationRegion,
    value.specialty,
    value.practiceAreas,
    value.bio,
    value.defaultAppointmentDurationMinutes,
  ].some((field) => field.trim().length > 0);
}

export function clearDoctorData(
  value: ClinicMemberFormValue,
  role: Exclude<ClinicRole, "Doctor">,
): ClinicMemberFormValue {
  return {
    ...value,
    role,
    professionalAuthority: "",
    professionalRegistrationNumber: "",
    professionalRegistrationRegion: "",
    professionalRegistrationCountryCode: "BR",
    specialty: "",
    practiceAreas: "",
    bio: "",
    defaultAppointmentDurationMinutes: "",
  };
}

export function toClinicMemberFormValue(
  member?: ClinicMember,
): ClinicMemberFormValue {
  if (!member) return { ...emptyClinicMemberForm };
  const profile = member.doctorProfile;
  return {
    ...emptyClinicMemberForm,
    name: member.displayName ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    role: member.role,
    isAdmin: member.isAdmin,
    professionalAuthority: profile?.professionalAuthority ?? "",
    professionalRegistrationNumber:
      profile?.professionalRegistrationNumber ?? "",
    professionalRegistrationRegion:
      profile?.professionalRegistrationRegion ?? "",
    professionalRegistrationCountryCode:
      profile?.professionalRegistrationCountryCode ?? "BR",
    specialty: profile?.specialty ?? "",
    practiceAreas: profile?.practiceAreas ?? "",
    bio: profile?.bio ?? "",
    defaultAppointmentDurationMinutes:
      profile?.defaultAppointmentDurationMinutes?.toString() ?? "",
  };
}

export function createClinicMemberSchema(mode: "create" | "edit") {
  return z
    .object({
      countryCode: z.string(),
      documentType: z.string(),
      document: z.string(),
      name: z.string(),
      email: z.email("Informe um e-mail válido."),
      phone: z.string().regex(phonePattern, "Informe o telefone com DDI e número."),
      role: z.enum(["Secretary", "Nurse", "Doctor"]),
      isAdmin: z.boolean(),
      professionalAuthority: z.string(),
      professionalRegistrationNumber: z.string(),
      professionalRegistrationRegion: z.string(),
      professionalRegistrationCountryCode: z.string(),
      specialty: z.string(),
      practiceAreas: z.string(),
      bio: z.string(),
      defaultAppointmentDurationMinutes: z.string(),
    })
    .superRefine((value, context) => {
      if (mode === "create") {
        if (!value.name.trim()) {
          context.addIssue({ code: "custom", path: ["name"], message: "Informe o nome completo." });
        }
        if (
          value.countryCode === "BR" &&
          value.documentType === "CPF" &&
          value.document.replace(/\D/g, "").length !== 11
        ) {
          context.addIssue({ code: "custom", path: ["document"], message: "Informe um CPF com 11 dígitos." });
        } else if (!value.document.trim()) {
          context.addIssue({ code: "custom", path: ["document"], message: "Informe o número do documento." });
        }
      }
      if (value.role === "Doctor") {
        const duration = Number(value.defaultAppointmentDurationMinutes);
        if (!value.defaultAppointmentDurationMinutes) {
          context.addIssue({
            code: "custom",
            path: ["defaultAppointmentDurationMinutes"],
            message: "Informe a duração padrão da consulta.",
          });
        } else if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
          context.addIssue({
            code: "custom",
            path: ["defaultAppointmentDurationMinutes"],
            message: "A duração deve ficar entre 5 e 480 minutos.",
          });
        }
      }
    });
}

function doctorProfile(value: ClinicMemberFormValue): DoctorMembershipProfile | null {
  if (value.role !== "Doctor") return null;
  return {
    professionalAuthority: nullableText(value.professionalAuthority),
    professionalRegistrationNumber: nullableText(
      value.professionalRegistrationNumber,
    ),
    professionalRegistrationRegion: nullableText(
      value.professionalRegistrationRegion,
    ),
    professionalRegistrationCountryCode: nullableText(
      value.professionalRegistrationCountryCode,
    ),
    specialty: nullableText(value.specialty),
    practiceAreas: nullableText(value.practiceAreas),
    bio: nullableText(value.bio),
    defaultAppointmentDurationMinutes: Number(
      value.defaultAppointmentDurationMinutes,
    ),
  };
}

export function toClinicMemberPayload(
  value: ClinicMemberFormValue,
  mode: "create" | "edit",
): ClinicMemberPayload {
  const shared = {
    email: value.email.trim().toLowerCase(),
    phone: value.phone,
    role: value.role,
    isAdmin: value.isAdmin,
    doctorProfile: doctorProfile(value),
  };
  if (mode === "edit") {
    return {
      ...shared,
      reason: "Atualização pela gestão de equipe",
    };
  }
  return {
    documentCountryCode: value.countryCode,
    documentType: value.documentType,
    document: value.document.trim(),
    name: value.name.trim(),
    ...shared,
  };
}
