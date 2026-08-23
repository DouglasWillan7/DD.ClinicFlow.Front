import type { PatientExamPage, PatientExamSummary } from "../../../api/types";

const groupOrder = [
  "Revisar",
  "Falhas",
  "Em andamento",
  "Histórico validado",
  "Cancelados",
] as const;

type ExamGroupLabel = (typeof groupOrder)[number];

export function examGroupLabel(status: PatientExamSummary["status"]): ExamGroupLabel {
  if (status === "Em revisão") return "Revisar";
  if (status === "Falhou") return "Falhas";
  if (status === "Validado") return "Histórico validado";
  if (status === "Cancelado") return "Cancelados";
  return "Em andamento";
}

export function flattenExamPages(pages: PatientExamPage[]) {
  const found = new Set<string>();
  return pages.flatMap((page) => page.items).filter((item) => {
    if (found.has(item.id)) return false;
    found.add(item.id);
    return true;
  });
}

export function groupExams(items: PatientExamSummary[]) {
  return groupOrder.flatMap((label) => {
    const groupItems = items.filter((item) => examGroupLabel(item.status) === label);
    return groupItems.length ? [{ label, items: groupItems }] : [];
  });
}
