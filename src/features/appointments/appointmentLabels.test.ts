import type { Member } from "../../api/types";
import {
  appointmentTypeLabels,
  availabilityStatusLabels,
  bloodTypeLabels,
  filterDoctors,
  formatDateOnlyLong,
  getInitials,
} from "./appointmentLabels";

const members: Member[] = [
  {
    userClinicId: "uc-d-1",
    userId: "d-1",
    displayName: "Dra. Hélena Costa",
    role: "Doctor",
    isAdmin: false,
    specialty: " Cardiologia ",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-d-2",
    userId: "d-2",
    displayName: "Dr. João Ávila",
    role: "Doctor",
    isAdmin: true,
    specialty: "neurologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-d-3",
    userId: "d-3",
    displayName: "Dra. Ana Lima",
    role: "Doctor",
    isAdmin: false,
    specialty: "cardiologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-s-1",
    userId: "s-1",
    displayName: "Hélena da recepção",
    role: "Secretary",
    isAdmin: false,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: null,
  },
  {
    userClinicId: "uc-d-4",
    userId: "d-4",
    displayName: "Dr. Sem especialidade",
    role: "Doctor",
    isAdmin: false,
    specialty: "  ",
    defaultAppointmentDurationMinutes: 30,
  },
];

describe("appointmentLabels", () => {
  test("traduz todos os enums clínicos sem expor nomes do backend", () => {
    expect(appointmentTypeLabels).toEqual({
      InPerson: "Presencial",
      Teleconsultation: "Teleconsulta",
    });
    expect(availabilityStatusLabels).toEqual({
      Available: "Disponível",
      NoSchedule: "Sem agenda",
      Blocked: "Bloqueado",
      Full: "Sem horários",
    });
    expect(bloodTypeLabels).toEqual({
      APositive: "A+",
      ANegative: "A-",
      BPositive: "B+",
      BNegative: "B-",
      ABPositive: "AB+",
      ABNegative: "AB-",
      OPositive: "O+",
      ONegative: "O-",
    });
  });

  test("busca do agendamento casa nome ou especialidade sem caixa nem acento", () => {
    expect(filterDoctors(members, "helena").map((member) => member.userId)).toEqual(
      ["d-1"],
    );
    expect(filterDoctors(members, "joao avila").map((member) => member.userId)).toEqual(
      ["d-2"],
    );
    expect(
      filterDoctors(members, "cardiologia").map((member) => member.userId),
    ).toEqual(["d-1", "d-3"]);
  });

  test("lista todo médico da clínica, com ou sem especialidade, e ignora quem não atende", () => {
    expect(filterDoctors(members, "").map((member) => member.userId)).toEqual([
      "d-1",
      "d-2",
      "d-3",
      "d-4",
    ]);
    expect(filterDoctors(members, "sem especialidade")).toEqual([members[4]]);
    expect(filterDoctors(members, "").map((member) => member.userId)).not.toContain(
      "s-1",
    );
  });

  test("formata DateOnly em português sem recuar o dia pelo fuso UTC", () => {
    expect(formatDateOnlyLong("2026-08-10")).toBe("10 de agosto de 2026");
    expect(formatDateOnlyLong("data-inválida")).toBe("—");
  });

  test("monta iniciais do avatar ignorando títulos e conectivos", () => {
    expect(getInitials("Mohammad Jaber Abdullah")).toBe("MA");
    expect(getInitials("Dra. Helena Costa")).toBe("HC");
    expect(getInitials("Marina de Oliveira")).toBe("MO");
    expect(getInitials("Marina")).toBe("M");
    expect(getInitials("bianca@clinica.com")).toBe("BC");
    expect(getInitials(null)).toBe("—");
    expect(getInitials("   ")).toBe("—");
  });
});
