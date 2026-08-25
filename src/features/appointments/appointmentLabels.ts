import type {
  AppointmentType,
  AvailabilityDayStatus,
  BloodType,
  Member,
} from "../../api/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  InPerson: "Presencial",
  Teleconsultation: "Teleconsulta",
};

export const availabilityStatusLabels: Record<
  AvailabilityDayStatus,
  string
> = {
  Available: "Disponível",
  NoSchedule: "Sem agenda",
  Blocked: "Bloqueado",
  Full: "Sem horários",
};

export const bloodTypeLabels: Record<BloodType, string> = {
  APositive: "A+",
  ANegative: "A-",
  BPositive: "B+",
  BNegative: "B-",
  ABPositive: "AB+",
  ABNegative: "AB-",
  OPositive: "O+",
  ONegative: "O-",
};

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function formatDateOnlyLong(value: string | null) {
  if (!value) return "—";
  const parsed = parseDateOnly(value);
  return parsed
    ? format(parsed, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "—";
}

const honorifics = new Set(["dr", "dra", "sr", "sra", "srta", "prof", "profa"]);

export function getInitials(value: string | null | undefined) {
  const words = (value ?? "")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !honorifics.has(word.replace(/\.$/, "").toLowerCase()))
    .filter((word) => word.length > 2 || /^\p{Lu}/u.test(word));

  if (words.length === 0) return "—";
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : "";
  return `${first[0]}${last[0] ?? ""}`.toLocaleUpperCase("pt-BR");
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/** Especialidade é opcional no cadastro e não decide quem pode ser agendado. */
function isEligibleDoctor(member: Member) {
  return member.role === "Doctor";
}

/** Busca do agendamento: casa nome OU especialidade, sem acento e sem caixa. */
export function filterDoctors(members: Member[], search: string) {
  const normalizedSearch = normalizeSearch(search);

  return members.filter((member) => {
    if (!isEligibleDoctor(member)) return false;
    if (!normalizedSearch) return true;

    return normalizeSearch(
      `${member.displayName} ${member.specialty ?? ""}`,
    ).includes(normalizedSearch);
  });
}
