import { describe, expect, test } from "vitest";
import type { AuthResponse, ClinicRole } from "../api/types";
import {
  can,
  canAccessAppPath,
  getAppStart,
  requiredCapabilityForAppPath,
  type ClinicCapability,
} from "./permissions";

function session(role: ClinicRole, isAdmin = false): AuthResponse {
  return {
    userId: `user-${role}`,
    name: role,
    email: `${role.toLowerCase()}@clinic.test`,
    phone: "+5511999999999",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    userClinicId: `membership-${role}`,
    clinicRole: role,
    isAdmin,
    roles: isAdmin ? [role, "Admin"] : [role],
    availableClinics: [{
      userClinicId: `membership-${role}`,
      clinicId: "clinic-1",
      clinicName: "Clínica Centro",
      role,
      isAdmin,
    }],
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    },
  };
}

const matrix: Array<{
  capability: ClinicCapability;
  secretary: boolean;
  nurse: boolean;
  doctor: boolean;
  admin: boolean;
}> = [
  { capability: "ViewSchedule", secretary: true, nurse: true, doctor: true, admin: false },
  { capability: "ManageSchedule", secretary: true, nurse: true, doctor: true, admin: false },
  { capability: "ManageAppointmentConfirmation", secretary: true, nurse: true, doctor: true, admin: false },
  { capability: "ManagePatientDemographics", secretary: true, nurse: true, doctor: true, admin: false },
  { capability: "PerformPatientCheckIn", secretary: false, nurse: true, doctor: true, admin: false },
  { capability: "PreparePatient", secretary: false, nurse: true, doctor: true, admin: false },
  { capability: "ReadClinicalRecord", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "WriteClinicalRecord", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "ReadExams", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "WriteExams", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "ReadAssessments", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "WriteAssessments", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "ReadTranscription", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "WriteTranscription", secretary: false, nurse: false, doctor: true, admin: false },
  { capability: "ManageClinicMemberships", secretary: false, nurse: false, doctor: false, admin: true },
  { capability: "ManageHealthcarePlans", secretary: false, nurse: false, doctor: false, admin: true },
  { capability: "ManageClinicSettings", secretary: false, nurse: false, doctor: false, admin: true },
  { capability: "ReadAdministrativeAudit", secretary: false, nurse: false, doctor: false, admin: true },
];

describe("matriz de capacidades do contexto ativo", () => {
  test.each(matrix)("resolve $capability sem inferir administração ou clínica", (row) => {
    expect(can(session("Secretary"), row.capability)).toBe(row.secretary);
    expect(can(session("Nurse"), row.capability)).toBe(row.nurse);
    expect(can(session("Doctor"), row.capability)).toBe(row.doctor);
    expect(can(session("Secretary", true), row.capability)).toBe(
      row.admin || row.secretary,
    );
  });

  test("admin de secretaria não recebe prontuário e médico não recebe administração", () => {
    expect(can(session("Secretary", true), "ReadClinicalRecord")).toBe(false);
    expect(can(session("Secretary", true), "ReadExams")).toBe(false);
    expect(can(session("Doctor"), "ManageClinicMemberships")).toBe(false);
  });

  test("contexto v2 incompleto nega por padrão sem confiar no array legado", () => {
    const invalid = {
      ...session("Doctor", true),
      clinicRole: undefined,
      roles: ["Doctor", "Admin"] as AuthResponse["roles"],
    };
    expect(can(invalid, "ReadClinicalRecord")).toBe(false);
    expect(can(invalid, "ManageClinicSettings")).toBe(false);
    expect(can(undefined, "ViewSchedule")).toBe(false);
  });
});

test("protege rotas profundas com a capacidade equivalente da API", () => {
  expect(requiredCapabilityForAppPath("/app/agenda")).toBe("ViewSchedule");
  expect(requiredCapabilityForAppPath("/app/agenda/nova")).toBe("ManageSchedule");
  expect(requiredCapabilityForAppPath("/app/pacientes")).toBe("ManagePatientDemographics");
  expect(requiredCapabilityForAppPath("/app/pacientes/novo")).toBe("ManagePatientDemographics");
  expect(requiredCapabilityForAppPath("/app/pacientes/abc/editar")).toBe("ManagePatientDemographics");
  expect(requiredCapabilityForAppPath("/app/pacientes/abc")).toBe("ReadClinicalRecord");
  expect(requiredCapabilityForAppPath("/app/pacientes/abc/avaliacoes")).toBe("ReadAssessments");
  expect(requiredCapabilityForAppPath("/app/pacientes/abc/exames")).toBe("ReadExams");
  expect(requiredCapabilityForAppPath("/app/consultas/abc")).toBe("ReadTranscription");
  expect(requiredCapabilityForAppPath("/app/equipe")).toBe("ManageClinicMemberships");

  const secretaryAdmin = session("Secretary", true);
  expect(canAccessAppPath(secretaryAdmin, "/app/equipe")).toBe(true);
  expect(canAccessAppPath(secretaryAdmin, "/app/pacientes/novo")).toBe(true);
  expect(canAccessAppPath(secretaryAdmin, "/app/pacientes/abc")).toBe(false);
  expect(canAccessAppPath(secretaryAdmin, "/app/pacientes/abc/exames")).toBe(false);
  expect(canAccessAppPath(secretaryAdmin, "/app/pacientes/abc/editar")).toBe(true);
  expect(getAppStart(secretaryAdmin)).toBe("/app/agenda");
  expect(getAppStart(session("Doctor"))).toBe("/app/inicio");
});
