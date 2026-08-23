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
    userId: "d-1",
    email: "helena@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Hélena Costa",
    specialty: " Cardiologia ",
  },
  {
    userId: "d-2",
    email: "joao@example.test",
    roles: ["Admin", "Doctor"],
    isCreator: false,
    name: "Dr. João Ávila",
    specialty: "neurologia",
  },
  {
    userId: "d-3",
    email: "ana@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Ana Lima",
    specialty: "cardiologia",
  },
  {
    userId: "s-1",
    email: "secretaria@example.test",
    roles: ["Secretary"],
    isCreator: false,
    name: "Hélena da recepção",
    specialty: "Cardiologia",
  },
  {
    userId: "d-4",
    email: "sem-especialidade@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dr. Sem especialidade",
    specialty: "  ",
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
