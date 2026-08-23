const clinicalTitlePrefixes = [
  "conclusao",
  "impressao",
  "interpretacao clinica",
  "comentario interpretativo",
  "observacao clinica",
  "limitacao tecnica",
  "limitacoes tecnicas",
] as const;

function normalizeTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isClinicalNarrativeTitle(title: string) {
  const normalized = normalizeTitle(title);
  return clinicalTitlePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix} `));
}
