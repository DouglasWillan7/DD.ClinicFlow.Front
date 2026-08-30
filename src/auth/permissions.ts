import type { ClinicRole, UserRole } from "../api/types";

export type ClinicCapability =
  | "ViewSchedule"
  | "ManageSchedule"
  | "ConfigureDoctorSchedule"
  | "ManageAppointmentConfirmation"
  | "ManagePatientDemographics"
  | "PerformPatientCheckIn"
  | "PreparePatient"
  | "ReadClinicalRecord"
  | "WriteClinicalRecord"
  | "ReadExams"
  | "WriteExams"
  | "ReadAssessments"
  | "WriteAssessments"
  | "ReadTranscription"
  | "WriteTranscription"
  | "ManageClinicMemberships"
  | "ManageHealthcarePlans"
  | "ManageClinicSettings"
  | "ReadAdministrativeAudit";

interface PermissionSubject {
  clinicRole?: ClinicRole;
  isAdmin?: boolean;
  userClinicId?: string;
  roles?: readonly UserRole[];
}

const roleLevel: Record<ClinicRole, number> = {
  Secretary: 1,
  Nurse: 2,
  Doctor: 3,
};

const minimumRole: Partial<Record<ClinicCapability, ClinicRole>> = {
  ViewSchedule: "Secretary",
  ManageSchedule: "Secretary",
  ManageAppointmentConfirmation: "Secretary",
  ManagePatientDemographics: "Secretary",
  PerformPatientCheckIn: "Nurse",
  PreparePatient: "Nurse",
  ReadClinicalRecord: "Doctor",
  WriteClinicalRecord: "Doctor",
  ReadExams: "Doctor",
  WriteExams: "Doctor",
  ReadAssessments: "Doctor",
  WriteAssessments: "Doctor",
  ReadTranscription: "Doctor",
  WriteTranscription: "Doctor",
};

const administrativeCapabilities = new Set<ClinicCapability>([
  "ManageClinicMemberships",
  "ManageHealthcarePlans",
  "ManageClinicSettings",
  "ReadAdministrativeAudit",
]);

/** Resolve uma capacidade somente a partir do vínculo contextual validado. */
export function can(
  subject: PermissionSubject | null | undefined,
  capability: ClinicCapability,
) {
  if (!subject) return false;

  if (!subject.userClinicId || !subject.clinicRole) return false;
  const role = subject.clinicRole;
  const isAdmin = subject.isAdmin ?? false;

  if (capability === "ConfigureDoctorSchedule") {
    return isAdmin || role === "Doctor";
  }
  if (administrativeCapabilities.has(capability)) return isAdmin;
  const requiredRole = minimumRole[capability];
  return Boolean(role && requiredRole && roleLevel[role] >= roleLevel[requiredRole]);
}

export function getAppStart(subject: PermissionSubject | null | undefined) {
  return can(subject, "ReadClinicalRecord") ? "/app/inicio" : "/app/agenda";
}

export function requiredCapabilityForAppPath(
  path: string,
): ClinicCapability | undefined {
  const pathname = path.split("?")[0];

  if (pathname === "/app/pacientes" || pathname === "/app/pacientes/novo") {
    return "ManagePatientDemographics";
  }
  if (/^\/app\/pacientes\/[^/]+\/editar$/i.test(pathname)) {
    return "ManagePatientDemographics";
  }
  if (/^\/app\/pacientes\/[^/]+\/avaliacoes$/i.test(pathname)) {
    return "ReadAssessments";
  }
  if (/^\/app\/pacientes\/[^/]+\/exames$/i.test(pathname)) {
    return "ReadExams";
  }
  if (/^\/app\/pacientes\/[^/]+$/i.test(pathname)) {
    return "ReadClinicalRecord";
  }
  if (/^\/app\/consultas\/[^/]+$/i.test(pathname)) {
    return "ReadTranscription";
  }
  if (/^\/app\/equipe(?:\/.*)?$/i.test(pathname)) {
    return "ManageClinicMemberships";
  }
  if (
    pathname === "/app/configuracoes/clinica" ||
    pathname === "/app/configuracoes/whatsapp"
  ) {
    return "ManageClinicSettings";
  }
  if (pathname === "/app/configuracoes/agenda") {
    return "ConfigureDoctorSchedule";
  }
  if (pathname === "/app/inicio") return "ReadClinicalRecord";
  if (pathname === "/app/agenda/nova") return "ManageSchedule";
  if (pathname === "/app/agenda") return "ViewSchedule";
  return undefined;
}

export function canAccessAppPath(
  subject: PermissionSubject | null | undefined,
  path: string,
) {
  const capability = requiredCapabilityForAppPath(path);
  return capability ? can(subject, capability) : true;
}
