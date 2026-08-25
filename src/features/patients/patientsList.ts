import type { PatientListItem, PatientSituation } from "../../api/types";

export const situationLabels: Record<PatientSituation, string> = {
  EmAcompanhamento: "Em acompanhamento",
  NovoPaciente: "Novo paciente",
  ExamePendente: "Exame pendente",
  Inativo: "Inativo",
};

export type SituationFilter = "todos" | PatientSituation;

export const situationFilters: Array<{
  value: SituationFilter;
  label: string;
}> = [
  { value: "todos", label: "Todos" },
  { value: "EmAcompanhamento", label: "Em acompanhamento" },
  { value: "NovoPaciente", label: "Novos" },
  { value: "ExamePendente", label: "Exame pendente" },
];

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Busca do handoff: nome, documento/telefone com 3+ caracteres e prontuário. */
export function matchesSearch(patient: PatientListItem, search: string) {
  const term = search.trim();
  if (!term) return true;

  const normalized = normalizeText(term);
  const digits = term.replace(/\D/g, "");
  if (normalizeText(patient.name).includes(normalized)) return true;
  if (normalized.length >= 3 && normalizeText(patient.document).includes(normalized)) {
    return true;
  }
  if (String(patient.medicalRecordNumber).includes(normalized)) return true;
  if (digits.length >= 3) {
    if (patient.document.replace(/\D/g, "").includes(digits)) return true;
    if (patient.phone.replace(/\D/g, "").includes(digits)) return true;
  }
  return false;
}

export function filterPatients(
  patients: PatientListItem[],
  filter: SituationFilter,
  search: string,
) {
  return patients
    .filter((patient) => filter === "todos" || patient.situation === filter)
    .filter((patient) => matchesSearch(patient, search))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function countBySituation(patients: PatientListItem[]) {
  const counts: Record<PatientSituation, number> = {
    EmAcompanhamento: 0,
    NovoPaciente: 0,
    ExamePendente: 0,
    Inativo: 0,
  };
  for (const patient of patients) counts[patient.situation] += 1;
  return counts;
}
