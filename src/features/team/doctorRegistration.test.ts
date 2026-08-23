import { describe, expect, test } from "vitest";
import type { Doctor } from "../../api/types";
import {
  collapseSchedule,
  discardedDoctorForm,
  doctorSchema,
  emptyDoctorForm,
  formatMedicalLicense,
  formatPhone,
  getChecklist,
  getCompletionPercent,
  getDoctorInitials,
  getScheduleIntervals,
  getSummaryName,
  getSummarySubtitle,
  toDoctorFormValue,
  toDoctorPayload,
  type DoctorFormValue,
} from "./doctorRegistration";

const baseDoctor: Doctor = {
  userId: "doctor-1",
  email: "helena@clinica.com.br",
  name: "Helena Martins Sarmento",
  roles: ["Doctor"],
  isCreator: false,
  hasAccess: false,
  hasPendingInvitation: false,
  medicalLicense: "128455",
  medicalLicenseState: "SP",
  specialty: "Gastroenterologia",
  cpf: "41288732090",
  birthDate: "1985-03-22",
  phone: "11987124455",
  gender: "Feminino",
  rqe: "12345",
  practiceAreas: "Doença do refluxo",
  bio: "Formação em gastroenterologia.",
  slotDurationMinutes: 30,
  healthInsurancePlanIds: ["plano-1"],
  scheduleIntervals: [],
};

const preenchido: DoctorFormValue = {
  name: "Helena Martins Sarmento",
  cpf: "412.887.320-90",
  birthDate: "1985-03-22",
  gender: "Feminino",
  phone: "(11) 98712-4455",
  email: "helena@clinica.com.br",
  medicalLicense: "128455",
  medicalLicenseState: "SP",
  rqe: "12345",
  specialty: "Gastroenterologia",
  practiceAreas: "Doença do refluxo",
  bio: "Formação em gastroenterologia.",
  scheduleMode: "uniform",
  days: ["Monday", "Tuesday"],
  startTime: "08:00",
  endTime: "18:00",
  intervals: [],
  slotDurationMinutes: "30",
  healthInsurancePlanIds: ["plano-1"],
};

describe("resumo do cadastro", () => {
  test("iniciais usam o primeiro e o último nome", () => {
    expect(getDoctorInitials("Helena Martins Sarmento")).toBe("HS");
    expect(getDoctorInitials("Helena")).toBe("H");
    expect(getDoctorInitials("   ")).toBe("?");
  });

  test("nome cai para o rótulo do estado vazio", () => {
    expect(getSummaryName("Helena")).toBe("Dr(a). Helena");
    expect(getSummaryName("  ")).toBe("Novo médico");
  });

  test("CRM só ganha a UF depois do número", () => {
    expect(formatMedicalLicense("", "SP")).toBe("");
    expect(formatMedicalLicense("128455", "")).toBe("CRM 128455");
    expect(formatMedicalLicense("128455", "SP")).toBe("CRM 128455-SP");
  });

  test("sub-linha junta especialidade e CRM", () => {
    expect(getSummarySubtitle(preenchido)).toBe(
      "Gastroenterologia · CRM 128455-SP",
    );
    expect(getSummarySubtitle(emptyDoctorForm)).toBe("Preencha os dados ao lado");
  });

  test("progresso conta 12 campos e começa nos dias pré-marcados", () => {
    expect(getCompletionPercent(emptyDoctorForm)).toBe(8);
    expect(getCompletionPercent(discardedDoctorForm)).toBe(0);
    expect(getCompletionPercent(preenchido)).toBe(100);
  });

  test("horários entram no checklist mas não no progresso", () => {
    const semHorario = { ...preenchido, startTime: "", endTime: "" };
    expect(getCompletionPercent(semHorario)).toBe(100);
    expect(getChecklist(semHorario)[2].done).toBe(false);
  });

  test("o modo por dia alimenta progresso e checklist do mesmo jeito", () => {
    const porDia: DoctorFormValue = {
      ...preenchido,
      scheduleMode: "perDay",
      days: [],
      startTime: "",
      endTime: "",
      intervals: [
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
        { dayOfWeek: "Monday", startLocal: "14:00", endLocal: "18:00" },
      ],
    };
    expect(getCompletionPercent(porDia)).toBe(100);
    expect(getChecklist(porDia)[2].done).toBe(true);
  });

  test("checklist marca cada seção pelas suas obrigatórias", () => {
    expect(getChecklist(emptyDoctorForm).map((item) => item.done)).toEqual([
      false,
      false,
      false,
    ]);
    expect(getChecklist(preenchido).map((item) => item.done)).toEqual([
      true,
      true,
      true,
    ]);
  });
});

describe("máscara de celular", () => {
  test("formata fixo e celular", () => {
    expect(formatPhone("11987124455")).toBe("(11) 98712-4455");
    expect(formatPhone("1132224455")).toBe("(11) 3222-4455");
    expect(formatPhone("11")).toBe("11");
    expect(formatPhone("119871244559999")).toBe("(11) 98712-4455");
  });
});

describe("payload", () => {
  test("expande os dias em um intervalo por dia e limpa a máscara", () => {
    const payload = toDoctorPayload(preenchido);
    expect(payload.cpf).toBe("41288732090");
    expect(payload.phone).toBe("11987124455");
    expect(payload.slotDurationMinutes).toBe(30);
    expect(payload.scheduleIntervals).toEqual([
      { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "18:00" },
      { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "18:00" },
    ]);
  });

  test("campos opcionais em branco viram null", () => {
    const payload = toDoctorPayload({
      ...preenchido,
      rqe: "",
      practiceAreas: "",
      bio: "",
      birthDate: "",
    });
    expect(payload.rqe).toBeNull();
    expect(payload.practiceAreas).toBeNull();
    expect(payload.bio).toBeNull();
    expect(payload.birthDate).toBeNull();
  });

  test("reidrata o formulário a partir do cadastro salvo", () => {
    const doctor: Doctor = {
      ...baseDoctor,
      userId: "doctor-1",
      email: "helena@clinica.com.br",
      name: "Helena Martins Sarmento",
      roles: ["Doctor"],
      isCreator: false,
      hasAccess: false,
      hasPendingInvitation: false,
      medicalLicense: "128455",
      medicalLicenseState: "SP",
      specialty: "Gastroenterologia",
      cpf: "41288732090",
      birthDate: "1985-03-22",
      phone: "11987124455",
      gender: "Feminino",
      rqe: "12345",
      practiceAreas: "Doença do refluxo",
      bio: "Formação em gastroenterologia.",
      slotDurationMinutes: 30,
      healthInsurancePlanIds: ["plano-1"],
      scheduleIntervals: [
        {
          id: "i1",
          dayOfWeek: "Monday",
          startLocal: "08:00:00",
          endLocal: "18:00:00",
        },
        {
          id: "i2",
          dayOfWeek: "Tuesday",
          startLocal: "08:00:00",
          endLocal: "18:00:00",
        },
      ],
    };

    expect(toDoctorFormValue(doctor)).toEqual(preenchido);
  });
});

describe("validação", () => {
  test("aceita o cadastro completo", () => {
    expect(doctorSchema.safeParse(preenchido).success).toBe(true);
  });

  test("recusa CPF inválido", () => {
    const result = doctorSchema.safeParse({ ...preenchido, cpf: "111.111.111-11" });
    expect(result.success).toBe(false);
  });

  test("recusa CRM com letras", () => {
    const result = doctorSchema.safeParse({ ...preenchido, medicalLicense: "12A455" });
    expect(result.success).toBe(false);
  });

  test("recusa UF fora da lista", () => {
    const result = doctorSchema.safeParse({
      ...preenchido,
      medicalLicenseState: "ZZ",
    });
    expect(result.success).toBe(false);
  });

  test("recusa fim anterior ao início", () => {
    const result = doctorSchema.safeParse({
      ...preenchido,
      startTime: "18:00",
      endTime: "08:00",
    });
    expect(result.success).toBe(false);
  });

  test("recusa período menor que uma consulta", () => {
    const result = doctorSchema.safeParse({
      ...preenchido,
      startTime: "08:00",
      endTime: "08:20",
      slotDurationMinutes: "60",
    });
    expect(result.success).toBe(false);
  });

  test("recusa cadastro sem dia de atendimento", () => {
    const result = doctorSchema.safeParse({ ...preenchido, days: [] });
    expect(result.success).toBe(false);
  });

  test("no modo por dia recusa intervalos sobrepostos", () => {
    const result = doctorSchema.safeParse({
      ...preenchido,
      scheduleMode: "perDay",
      intervals: [
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "13:00" },
        { dayOfWeek: "Monday", startLocal: "12:00", endLocal: "18:00" },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("no modo por dia ignora dias e horário do modo simples", () => {
    const result = doctorSchema.safeParse({
      ...preenchido,
      scheduleMode: "perDay",
      days: [],
      startTime: "",
      endTime: "",
      intervals: [
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("modos da agenda", () => {
  test("o payload segue o modo ativo", () => {
    const porDia: DoctorFormValue = {
      ...preenchido,
      scheduleMode: "perDay",
      intervals: [
        { dayOfWeek: "Monday", startLocal: "14:00", endLocal: "18:00" },
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      ],
    };
    // Ordenado por dia e horário, mesmo com a entrada fora de ordem.
    expect(getScheduleIntervals(porDia)).toEqual([
      { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      { dayOfWeek: "Monday", startLocal: "14:00", endLocal: "18:00" },
    ]);
  });

  test("domingo entra na semana, para clínica de plantão", () => {
    const plantao: DoctorFormValue = {
      ...preenchido,
      days: ["Sunday", "Saturday"],
    };
    // Ordenado a partir de domingo, como o calendário da agenda.
    expect(getScheduleIntervals(plantao)).toEqual([
      { dayOfWeek: "Sunday", startLocal: "08:00", endLocal: "18:00" },
      { dayOfWeek: "Saturday", startLocal: "08:00", endLocal: "18:00" },
    ]);
    expect(doctorSchema.safeParse(plantao).success).toBe(true);
  });

  test("colapsa quando todos os dias têm o mesmo horário", () => {
    expect(
      collapseSchedule([
        { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "18:00" },
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "18:00" },
      ]),
    ).toEqual({
      days: ["Monday", "Tuesday"],
      startTime: "08:00",
      endTime: "18:00",
    });
  });

  test("não colapsa com horários divergentes nem com dois intervalos no dia", () => {
    expect(
      collapseSchedule([
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "18:00" },
        { dayOfWeek: "Saturday", startLocal: "08:00", endLocal: "12:00" },
      ]),
    ).toBeNull();
    expect(
      collapseSchedule([
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
        { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      ]),
    ).toBeNull();
  });

  test("almoço no cadastro salvo abre direto no detalhe por dia", () => {
    const value = toDoctorFormValue({
      ...baseDoctor,
      scheduleIntervals: [
        { id: "i1", dayOfWeek: "Monday", startLocal: "08:00:00", endLocal: "12:00:00" },
        { id: "i2", dayOfWeek: "Monday", startLocal: "14:00:00", endLocal: "18:00:00" },
      ],
    });
    expect(value.scheduleMode).toBe("perDay");
    expect(value.intervals).toHaveLength(2);
  });
});
