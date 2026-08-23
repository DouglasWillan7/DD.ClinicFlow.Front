import { z } from "zod";
import type {
  Doctor,
  DoctorGender,
  ScheduleDay,
} from "../../api/types";
import { formatCpf, normalizeCpf } from "../patients/patientFormatters";

/**
 * Cadastro de médico — handoff "design_handoff_cadastro_medico".
 * A regra do resumo (12 campos do progresso e as 3 seções do checklist) é literal do protótipo.
 */

export const genderOptions: ReadonlyArray<DoctorGender> = [
  "Feminino",
  "Masculino",
  "Outro",
];

/**
 * A semana inteira, começando no domingo como o calendário da agenda. O handoff mostra só Seg–Sáb,
 * mas clínica de plantão atende todo dia — domingo não pode faltar.
 */
export const attendanceDays: ReadonlyArray<{
  value: ScheduleDay;
  label: string;
  accessibleLabel: string;
}> = [
  { value: "Sunday", label: "Dom", accessibleLabel: "domingo" },
  { value: "Monday", label: "Seg", accessibleLabel: "segunda-feira" },
  { value: "Tuesday", label: "Ter", accessibleLabel: "terça-feira" },
  { value: "Wednesday", label: "Qua", accessibleLabel: "quarta-feira" },
  { value: "Thursday", label: "Qui", accessibleLabel: "quinta-feira" },
  { value: "Friday", label: "Sex", accessibleLabel: "sexta-feira" },
  { value: "Saturday", label: "Sáb", accessibleLabel: "sábado" },
];

export const durationOptions: ReadonlyArray<number> = [20, 30, 40, 60];

export const brazilianStates: ReadonlyArray<string> = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/**
 * O handoff lista só especialidades de gastro (dado de exemplo). O ClinicFlow atende clínicas de
 * qualquer área, então a lista é a das especialidades reconhecidas pelo CFM — as seis do protótipo
 * estão todas aqui.
 */
export const specialtyOptions: ReadonlyArray<string> = [
  "Acupuntura",
  "Alergia e imunologia",
  "Anestesiologia",
  "Angiologia",
  "Cardiologia",
  "Cirurgia cardiovascular",
  "Cirurgia da mão",
  "Cirurgia de cabeça e pescoço",
  "Cirurgia digestiva",
  "Cirurgia geral",
  "Cirurgia pediátrica",
  "Cirurgia plástica",
  "Cirurgia torácica",
  "Cirurgia vascular",
  "Clínica médica",
  "Coloproctologia",
  "Dermatologia",
  "Endocrinologia e metabologia",
  "Endoscopia digestiva",
  "Gastroenterologia",
  "Genética médica",
  "Geriatria",
  "Ginecologia e obstetrícia",
  "Hematologia e hemoterapia",
  "Hepatologia",
  "Homeopatia",
  "Infectologia",
  "Mastologia",
  "Medicina de família e comunidade",
  "Medicina do trabalho",
  "Medicina esportiva",
  "Medicina intensiva",
  "Medicina nuclear",
  "Medicina preventiva e social",
  "Nefrologia",
  "Neurocirurgia",
  "Neurologia",
  "Nutrologia",
  "Oftalmologia",
  "Oncologia clínica",
  "Ortopedia e traumatologia",
  "Otorrinolaringologia",
  "Patologia",
  "Pediatria",
  "Pneumologia",
  "Psiquiatria",
  "Radiologia e diagnóstico por imagem",
  "Radioterapia",
  "Reumatologia",
  "Urologia",
];

export interface DoctorFormValue {
  name: string;
  cpf: string;
  birthDate: string;
  gender: DoctorGender | "";
  phone: string;
  email: string;
  medicalLicense: string;
  medicalLicenseState: string;
  rqe: string;
  specialty: string;
  practiceAreas: string;
  bio: string;
  /** "uniform" usa dias + início/fim; "perDay" usa `intervals`. Um só é gravado. */
  scheduleMode: ScheduleMode;
  days: ScheduleDay[];
  startTime: string;
  endTime: string;
  intervals: DoctorScheduleDraftInterval[];
  slotDurationMinutes: string;
  healthInsurancePlanIds: string[];
}

export type ScheduleMode = "uniform" | "perDay";

export interface DoctorScheduleDraftInterval {
  dayOfWeek: ScheduleDay;
  startLocal: string;
  endLocal: string;
}

/** Seg–Sex vêm marcados, como o estado inicial do protótipo. */
export const emptyDoctorForm: DoctorFormValue = {
  name: "",
  cpf: "",
  birthDate: "",
  gender: "",
  phone: "",
  email: "",
  medicalLicense: "",
  medicalLicenseState: "",
  rqe: "",
  specialty: "",
  practiceAreas: "",
  bio: "",
  scheduleMode: "uniform",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  startTime: "",
  endTime: "",
  intervals: [],
  slotDurationMinutes: "",
  healthInsurancePlanIds: [],
};

/** "Descartar" limpa tudo, inclusive os dias pré-marcados — literal do protótipo. */
export const discardedDoctorForm: DoctorFormValue = {
  ...emptyDoctorForm,
  days: [],
};

function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
  );
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

/** Máscara "(11) 98712-4455" do handoff; o payload envia só os dígitos. */
export function formatPhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const middle = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, middle)}-${digits.slice(middle)}`;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleDayEnum = z.enum([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const dayOrder = new Map(attendanceDays.map((day, index) => [day.value, index]));

function sortIntervals(intervals: DoctorScheduleDraftInterval[]) {
  return [...intervals].sort((left, right) => {
    const byDay =
      (dayOrder.get(left.dayOfWeek) ?? attendanceDays.length) -
      (dayOrder.get(right.dayOfWeek) ?? attendanceDays.length);
    return byDay !== 0 ? byDay : left.startLocal.localeCompare(right.startLocal);
  });
}

/** Um intervalo por dia marcado, todos com o mesmo horário. */
export function expandUniformSchedule(
  days: ScheduleDay[],
  startTime: string,
  endTime: string,
): DoctorScheduleDraftInterval[] {
  return attendanceDays
    .filter((day) => days.includes(day.value))
    .map((day) => ({
      dayOfWeek: day.value,
      startLocal: startTime,
      endLocal: endTime,
    }));
}

/**
 * Volta ao modo simples quando todos os dias atendidos têm exatamente um intervalo e o mesmo
 * horário. Fora disso devolve null — colapsar apagaria horários que a clínica configurou.
 */
export function collapseSchedule(intervals: DoctorScheduleDraftInterval[]) {
  if (intervals.length === 0) return null;
  const [first] = intervals;
  const days = new Set<ScheduleDay>();
  for (const interval of intervals) {
    if (
      interval.startLocal !== first.startLocal ||
      interval.endLocal !== first.endLocal ||
      days.has(interval.dayOfWeek)
    ) {
      return null;
    }
    days.add(interval.dayOfWeek);
  }
  return {
    days: attendanceDays
      .filter((day) => days.has(day.value))
      .map((day) => day.value),
    startTime: first.startLocal,
    endTime: first.endLocal,
  };
}

/** A recorrência efetiva, qualquer que seja o modo — é o que vai para a API. */
export function getScheduleIntervals(value: DoctorFormValue) {
  return value.scheduleMode === "uniform"
    ? expandUniformSchedule(value.days, value.startTime, value.endTime)
    : sortIntervals(value.intervals);
}

export const doctorSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    cpf: z.string().refine(isValidCpf, "Informe um CPF válido."),
    birthDate: z.string(),
    gender: z.union([z.enum(["Feminino", "Masculino", "Outro"]), z.literal("")]),
    phone: z
      .string()
      .refine(
        (value) => [10, 11].includes(normalizePhone(value).length),
        "Informe o celular com DDD.",
      ),
    email: z.email("Informe um e-mail válido."),
    medicalLicense: z
      .string()
      .trim()
      .min(1, "Informe o CRM.")
      .max(30)
      .regex(/^\d+$/, "O CRM deve conter apenas números."),
    medicalLicenseState: z
      .string()
      .refine((value) => brazilianStates.includes(value), "Informe a UF do CRM."),
    rqe: z.string().trim().max(20),
    specialty: z.string().trim().min(1, "Informe a especialidade."),
    practiceAreas: z.string().trim().max(200),
    bio: z.string().trim().max(600),
    scheduleMode: z.enum(["uniform", "perDay"]),
    days: z.array(scheduleDayEnum),
    startTime: z.string(),
    endTime: z.string(),
    intervals: z.array(
      z.object({
        dayOfWeek: scheduleDayEnum,
        startLocal: z.string(),
        endLocal: z.string(),
      }),
    ),
    slotDurationMinutes: z.string().min(1, "Selecione a duração da consulta."),
    healthInsurancePlanIds: z.array(z.string()),
  })
  .superRefine((value, context) => {
    const duration = Number(value.slotDurationMinutes);

    if (value.scheduleMode === "uniform") {
      validateUniformSchedule(value, duration, context);
    } else {
      validatePerDaySchedule(value.intervals, duration, context);
    }

    if (value.birthDate && value.birthDate >= new Date().toISOString().slice(0, 10)) {
      context.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: "A data de nascimento deve ser no passado.",
      });
    }
  });

function validateUniformSchedule(
  value: { days: ScheduleDay[]; startTime: string; endTime: string },
  duration: number,
  context: z.RefinementCtx,
) {
  if (value.days.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["days"],
      message: "Selecione ao menos um dia de atendimento.",
    });
  }
  if (!timePattern.test(value.startTime)) {
    context.addIssue({
      code: "custom",
      path: ["startTime"],
      message: "Informe o início no formato hh:mm.",
    });
  }
  if (!timePattern.test(value.endTime)) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Informe o fim no formato hh:mm.",
    });
    return;
  }
  if (!timePattern.test(value.startTime)) return;

  if (value.endTime <= value.startTime) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "O fim deve ser posterior ao início.",
    });
    return;
  }
  if (duration > 0 && minutesBetween(value.startTime, value.endTime) < duration) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: `O período de atendimento precisa comportar ao menos uma consulta de ${duration} minutos.`,
    });
  }
}

function validatePerDaySchedule(
  intervals: DoctorScheduleDraftInterval[],
  duration: number,
  context: z.RefinementCtx,
) {
  const fail = (message: string) =>
    context.addIssue({ code: "custom", path: ["intervals"], message });

  if (intervals.length === 0) {
    fail("Defina o horário de ao menos um dia de atendimento.");
    return;
  }

  for (const interval of intervals) {
    if (
      !timePattern.test(interval.startLocal) ||
      !timePattern.test(interval.endLocal)
    ) {
      fail("Informe o início e o fim de cada intervalo.");
      return;
    }
    if (interval.endLocal <= interval.startLocal) {
      fail("O fim de cada intervalo deve ser posterior ao início.");
      return;
    }
    if (
      duration > 0 &&
      minutesBetween(interval.startLocal, interval.endLocal) < duration
    ) {
      fail(`Cada intervalo deve ter ao menos ${duration} minutos.`);
      return;
    }
  }

  const ordered = sortIntervals(intervals);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (
      current.dayOfWeek === previous.dayOfWeek &&
      current.startLocal < previous.endLocal
    ) {
      fail("Os intervalos de um mesmo dia não podem se sobrepor.");
      return;
    }
  }
}

function minutesBetween(start: string, end: string) {
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

/** Primeira letra do primeiro e do último nome; "?" enquanto não há nome. */
export function getDoctorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${parts[0][0]}${last}`.toUpperCase();
}

/** "CRM 128455-SP"; a UF só entra depois que o número foi digitado. */
export function formatMedicalLicense(
  medicalLicense: string,
  medicalLicenseState: string,
) {
  const license = medicalLicense.trim();
  if (!license) return "";
  return `CRM ${license}${medicalLicenseState ? `-${medicalLicenseState}` : ""}`;
}

export function getSummaryName(name: string) {
  const trimmed = name.trim();
  return trimmed ? `Dr(a). ${trimmed}` : "Novo médico";
}

export function getSummarySubtitle(value: DoctorFormValue) {
  const parts = [
    value.specialty,
    formatMedicalLicense(value.medicalLicense, value.medicalLicenseState),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Preencha os dados ao lado";
}

/**
 * Progresso: 12 campos do handoff. RQE, áreas, miniapresentação e horários não contam —
 * por isso uma seção pode estar concluída sem o progresso chegar a 100%.
 */
export function getCompletionPercent(value: DoctorFormValue) {
  const filled = [
    value.name.trim(),
    value.cpf.trim(),
    value.birthDate,
    value.gender,
    value.phone.trim(),
    value.email.trim(),
    value.medicalLicense.trim(),
    value.medicalLicenseState,
    value.specialty,
    getScheduleIntervals(value).length > 0 ? "x" : "",
    value.slotDurationMinutes,
    value.healthInsurancePlanIds.length > 0 ? "x" : "",
  ];
  return Math.round((filled.filter(Boolean).length / filled.length) * 100);
}

export interface DoctorChecklistItem {
  label: string;
  done: boolean;
}

export function getChecklist(value: DoctorFormValue): DoctorChecklistItem[] {
  return [
    {
      label: "Dados pessoais",
      done: Boolean(
        value.name.trim() &&
          value.cpf.trim() &&
          value.phone.trim() &&
          value.email.trim(),
      ),
    },
    {
      label: "Registro profissional",
      done: Boolean(
        value.medicalLicense.trim() &&
          value.medicalLicenseState &&
          value.specialty,
      ),
    },
    {
      label: "Atendimento",
      done:
        Boolean(value.slotDurationMinutes) &&
        getScheduleIntervals(value).every(
          (interval) =>
            timePattern.test(interval.startLocal) &&
            timePattern.test(interval.endLocal),
        ) &&
        getScheduleIntervals(value).length > 0,
    },
  ];
}

/** O backend guarda sempre um intervalo por dia, seja qual for o modo usado na tela. */
export function toDoctorPayload(value: DoctorFormValue) {
  return {
    name: value.name.trim(),
    email: value.email.trim().toLowerCase(),
    medicalLicense: value.medicalLicense.trim(),
    medicalLicenseState: value.medicalLicenseState,
    specialty: value.specialty,
    cpf: normalizeCpf(value.cpf) || null,
    birthDate: value.birthDate || null,
    phone: normalizePhone(value.phone) || null,
    gender: value.gender || null,
    rqe: value.rqe.trim() || null,
    practiceAreas: value.practiceAreas.trim() || null,
    bio: value.bio.trim() || null,
    slotDurationMinutes: Number(value.slotDurationMinutes) || null,
    scheduleIntervals: getScheduleIntervals(value),
    healthInsurancePlanIds: value.healthInsurancePlanIds,
  };
}

/**
 * Reconstrói o formulário a partir do cadastro salvo. O modo é deduzido: horário igual em todos os
 * dias cai no simples; almoço ou sábado mais curto abre direto o detalhe por dia.
 */
export function toDoctorFormValue(doctor: Doctor): DoctorFormValue {
  const intervals: DoctorScheduleDraftInterval[] = sortIntervals(
    doctor.scheduleIntervals.map((interval) => ({
      dayOfWeek: interval.dayOfWeek,
      startLocal: interval.startLocal.slice(0, 5),
      endLocal: interval.endLocal.slice(0, 5),
    })),
  );
  const uniform = collapseSchedule(intervals);
  return {
    name: doctor.name ?? "",
    cpf: formatCpf(doctor.cpf ?? ""),
    birthDate: doctor.birthDate ?? "",
    gender: doctor.gender ?? "",
    phone: formatPhone(doctor.phone ?? ""),
    email: doctor.email,
    medicalLicense: doctor.medicalLicense ?? "",
    medicalLicenseState: doctor.medicalLicenseState ?? "",
    rqe: doctor.rqe ?? "",
    specialty: doctor.specialty ?? "",
    practiceAreas: doctor.practiceAreas ?? "",
    bio: doctor.bio ?? "",
    scheduleMode: uniform ? "uniform" : "perDay",
    days: uniform?.days ?? [],
    startTime: uniform?.startTime ?? "",
    endTime: uniform?.endTime ?? "",
    // Só o modo ativo carrega dados; o outro é reconstruído na troca.
    intervals: uniform ? [] : intervals,
    slotDurationMinutes: doctor.slotDurationMinutes
      ? String(doctor.slotDurationMinutes)
      : "",
    healthInsurancePlanIds: doctor.healthInsurancePlanIds,
  };
}
