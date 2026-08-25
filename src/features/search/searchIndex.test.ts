import type { Member, PatientListItem } from "../../api/types";
import {
  buildDoctorEntries,
  buildPatientEntries,
  searchEntries,
  splitHighlight,
} from "./searchIndex";

const today = new Date("2026-08-09T12:00:00Z");

function patient(
  overrides: Partial<PatientListItem> & Pick<PatientListItem, "id" | "name">,
): PatientListItem {
  return {
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "12345678901",
    medicalRecordNumber: 1024,
    bloodType: null,
    sexForClinicalUse: null,
    phone: "+5511988887777",
    email: null,
    birthDate: "1990-03-10",
    notes: null,
    isActive: true,
    createdAtUtc: "2026-01-01T12:00:00Z",
    lastAppointmentUtc: null,
    nextAppointmentUtc: null,
    nextAppointmentType: null,
    situation: "EmAcompanhamento",
    ...overrides,
  };
}

function member(overrides: Partial<Member> & Pick<Member, "userId">): Member {
  return {
    userClinicId: `uc-${overrides.userId}`,
    displayName: "Médico",
    role: "Doctor",
    isAdmin: false,
    specialty: null,
    defaultAppointmentDurationMinutes: 30,
    ...overrides,
  };
}

const mariana = patient({ id: "p1", name: "Mariana Souza Almeida" });
const marcos = patient({
  id: "p2",
  name: "Marcos Vinícius Teles",
  medicalRecordNumber: 88,
  document: "98765432100",
  phone: "+5511977776666",
});
const amaral = patient({ id: "p3", name: "Bruno Amarante" });
const patients = buildPatientEntries([mariana, marcos, amaral], today);

const doctors = buildDoctorEntries([
  member({ userId: "d1", displayName: "Dra. Helena Costa", specialty: "Cardiologia" }),
  member({ userId: "d2", displayName: "Dr. Paulo Nunes", specialty: "Neurologia" }),
  member({ userId: "camila", displayName: "Camila Duarte", role: "Secretary" }),
]);

describe("buildPatientEntries", () => {
  test("descreve o paciente com idade, prontuário e final do CPF", () => {
    expect(patients[0].subtitle).toBe("36 anos · Pront. 1.024 · CPF final 8901");
    expect(patients[0].initials).toBe("MA");
  });

  test("marca o inativo, porque ele não deveria ser agendado sem revisão", () => {
    const [inactive] = buildPatientEntries(
      [patient({ id: "p4", name: "Ana Teixeira", isActive: false })],
      today,
    );
    expect(inactive.subtitle.startsWith("Inativo · ")).toBe(true);
  });

  test("sem data de nascimento a idade some em vez de virar zero", () => {
    const [semData] = buildPatientEntries(
      [patient({ id: "p5", name: "Ana Teixeira", birthDate: null })],
      today,
    );
    expect(semData.subtitle).toBe("Pront. 1.024 · CPF final 8901");
  });
});

describe("buildDoctorEntries", () => {
  test("mantém só quem atende e nomeia a especialidade ausente", () => {
    expect(doctors.map((entry) => entry.id)).toEqual(["d1", "d2"]);
    const [semEspecialidade] = buildDoctorEntries([
      member({ userId: "d3", displayName: "Dr. Novo" }),
    ]);
    expect(semEspecialidade.subtitle).toBe("Sem especialidade");
  });
});

describe("searchEntries", () => {
  test("ignora acento e caixa", () => {
    expect(
      searchEntries(patients, "VINICIUS", 3).map((hit) => hit.entry.id),
    ).toEqual(["p2"]);
    expect(
      searchEntries(doctors, "cardiologia", 3).map((hit) => hit.entry.id),
    ).toEqual(["d1"]);
  });

  // "Marcos"/"Mariana" começam com o termo; "Amarante" só o contém no meio.
  test("ordena por relevância e desempata em ordem alfabética", () => {
    expect(searchEntries(patients, "mar", 3).map((hit) => hit.entry.id)).toEqual(
      ["p2", "p1", "p3"],
    );
  });

  test("casa CPF e telefone a partir de 3 dígitos, e prontuário direto", () => {
    expect(searchEntries(patients, "9876", 3).map((hit) => hit.entry.id)).toEqual(
      ["p2"],
    );
    expect(
      searchEntries(patients, "97777", 3).map((hit) => hit.entry.id),
    ).toEqual(["p2"]);
    expect(searchEntries(patients, "88", 3).map((hit) => hit.entry.id)).toEqual([
      "p2",
    ]);
  });

  test("respeita o limite por grupo e não abre com termo em branco", () => {
    expect(searchEntries(patients, "a", 2)).toHaveLength(2);
    expect(searchEntries(patients, "   ", 3)).toEqual([]);
  });

  test("aponta o trecho correspondente sobre o texto original acentuado", () => {
    const [hit] = searchEntries(patients, "vinicius", 3);
    const marked = splitHighlight(hit.entry.title, hit.highlight);
    expect(marked.map((part) => part.text)).toEqual([
      "Marcos ",
      "Vinícius",
      " Teles",
    ]);
    expect(marked[1].match).toBe(true);
  });

  test("resultado achado só pelo apelido não destaca nada no nome", () => {
    const [hit] = searchEntries(patients, "9876", 3);
    expect(hit.highlight).toBeNull();
    expect(splitHighlight(hit.entry.title, hit.highlight)).toEqual([
      { text: "Marcos Vinícius Teles", match: false },
    ]);
  });
});
