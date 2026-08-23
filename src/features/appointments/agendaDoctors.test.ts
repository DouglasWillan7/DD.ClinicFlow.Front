import type { Member } from "../../api/types";
import {
  formatFreeSlots,
  getShortDoctorName,
  listDoctors,
  resolveActiveDoctor,
} from "./agendaDoctors";

function member(overrides: Partial<Member> & Pick<Member, "userId">): Member {
  return {
    email: `${overrides.userId}@example.test`,
    roles: ["Doctor"],
    isCreator: false,
    name: "Médico",
    specialty: null,
    ...overrides,
  };
}

const helena = member({
  userId: "helena",
  name: "Dra. Helena Costa",
  specialty: "Cardiologia",
});
const ibrahim = member({
  userId: "ibrahim",
  name: "Dr. Ibrahim Kadri",
  specialty: "Gastroenterologia",
});
const paulo = member({
  userId: "paulo",
  name: "Dr. Paulo Nunes",
  specialty: "Clínica Geral",
});
const doctors = [helena, ibrahim, paulo];

describe("listDoctors", () => {
  test("mantém apenas quem atende, mesmo sem especialidade cadastrada", () => {
    const secretary = member({ userId: "camila", roles: ["Secretary"] });
    const rookie = member({ userId: "novo", name: "Dr. Novo" });

    expect(listDoctors([helena, secretary, rookie]).map((d) => d.userId)).toEqual(
      ["helena", "novo"],
    );
  });
});

describe("resolveActiveDoctor", () => {
  test("prefere o pedido na URL, depois o próprio médico logado", () => {
    expect(resolveActiveDoctor(doctors, "paulo", "ibrahim")?.userId).toBe(
      "paulo",
    );
    expect(resolveActiveDoctor(doctors, null, "ibrahim")?.userId).toBe("ibrahim");
    expect(resolveActiveDoctor(doctors, "sumiu", undefined)?.userId).toBe(
      "helena",
    );
    expect(resolveActiveDoctor([], null, undefined)).toBeNull();
  });
});

describe("getShortDoctorName", () => {
  test("usa as duas primeiras palavras do nome no CTA", () => {
    expect(getShortDoctorName(ibrahim)).toBe("Dr. Ibrahim");
    expect(getShortDoctorName(member({ userId: "x", name: null }))).toBe(
      "x@example.test",
    );
  });
});

describe("formatFreeSlots", () => {
  test("concorda o plural do rótulo do dia", () => {
    expect(formatFreeSlots(1)).toBe("1 horário livre");
    expect(formatFreeSlots(0)).toBe("0 horários livres");
  });
});
