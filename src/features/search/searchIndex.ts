import type { Member, PatientListItem } from "../../api/types";
import { getDoctorName, listDoctors } from "../appointments/agendaDoctors";
import { getInitials, normalizeSearch } from "../appointments/appointmentLabels";
import { formatMedicalRecord, getAge } from "../patients/patientFormatters";

export type SearchKind = "patient" | "doctor";

/**
 * Item já preparado para a busca: o texto dobrado (sem acento e sem caixa) e os
 * apelidos são calculados uma vez, quando o índice é montado, para que cada
 * tecla digitada só percorra comparações de string.
 */
export interface SearchEntry {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  initials: string;
  folded: string;
  /** Para cada caractere de `folded`, o índice equivalente em `title`. */
  foldedMap: number[];
  /** Campos secundários em texto: especialidade, e-mail, prontuário. */
  textAliases: string[];
  /** CPF e telefone; só casam a partir de 3 dígitos, como na lista. */
  digitAliases: string[];
}

export interface SearchHit {
  entry: SearchEntry;
  /** Trecho do título que casou com o termo, para o negrito do handoff. */
  highlight: { start: number; end: number } | null;
}

/** Prefixo do título vale mais que meio da palavra, que vale mais que apelido. */
const SCORE_TITLE_PREFIX = 3;
const SCORE_WORD_PREFIX = 2;
const SCORE_TITLE_PART = 1;
const SCORE_ALIAS = 0;

const WORD_BOUNDARY = /[\s.'’-]/;
const MIN_DIGITS = 3;

/**
 * Dobra o texto preservando um mapa de volta para os índices do original — é o
 * que permite destacar o trecho digitado mesmo em nomes acentuados, onde
 * `normalize("NFD")` muda o comprimento da string.
 */
function fold(value: string) {
  let folded = "";
  const map: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    for (let offset = 0; offset < char.length; offset += 1) {
      folded += char[offset];
      map.push(index);
    }
  }

  return { folded, map };
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** A busca mostra só o final do documento para evitar repetir o identificador completo. */
function formatDocumentSuffix(documentType: string, document: string) {
  const normalized = document.replace(/\s/g, "");
  if (normalized.length < 4) return null;
  return `${documentType} final ${normalized.slice(-4)}`;
}

export function buildPatientEntries(
  patients: PatientListItem[],
  today = new Date(),
): SearchEntry[] {
  return patients.map((patient) => {
    const age = getAge(patient.birthDate, today);
    const { folded, map } = fold(patient.name);

    return {
      kind: "patient",
      id: patient.id,
      title: patient.name,
      subtitle: [
        patient.isActive ? null : "Inativo",
        age === null ? null : `${age} anos`,
        `Pront. ${formatMedicalRecord(patient.medicalRecordNumber)}`,
        formatDocumentSuffix(patient.documentType, patient.document),
      ]
        .filter(Boolean)
        .join(" · "),
      initials: getInitials(patient.name),
      folded,
      foldedMap: map,
      textAliases: [String(patient.medicalRecordNumber)],
      digitAliases: [onlyDigits(patient.document), onlyDigits(patient.phone)].filter(
        Boolean,
      ),
    };
  });
}

export function buildDoctorEntries(members: Member[]): SearchEntry[] {
  return listDoctors(members).map((doctor) => {
    const name = getDoctorName(doctor);
    const { folded, map } = fold(name);

    return {
      kind: "doctor",
      id: doctor.userId,
      title: name,
      subtitle: doctor.specialty?.trim() || "Sem especialidade",
      initials: getInitials(name),
      folded,
      foldedMap: map,
      textAliases: [
        normalizeSearch(doctor.specialty ?? ""),
      ].filter(Boolean),
      digitAliases: [],
    };
  });
}

function toHighlight(entry: SearchEntry, index: number, length: number) {
  const start = entry.foldedMap[index];
  const last = entry.foldedMap[index + length - 1];
  if (start === undefined || last === undefined) return null;
  return { start, end: last + 1 };
}

function matchesAlias(entry: SearchEntry, term: string, digits: string) {
  if (entry.textAliases.some((alias) => alias.includes(term))) return true;
  return (
    digits.length >= MIN_DIGITS &&
    entry.digitAliases.some((alias) => alias.includes(digits))
  );
}

/**
 * Filtro em memória: roda a cada tecla, sem rede e sem debounce. A ordem é por
 * relevância (prefixo do nome primeiro) e, em empate, alfabética em PT-BR.
 */
export function searchEntries(
  entries: SearchEntry[],
  query: string,
  limit: number,
): SearchHit[] {
  const term = normalizeSearch(query);
  if (!term) return [];

  const digits = onlyDigits(query);
  const scored: Array<{ score: number; hit: SearchHit }> = [];

  for (const entry of entries) {
    const index = entry.folded.indexOf(term);

    if (index >= 0) {
      const score =
        index === 0
          ? SCORE_TITLE_PREFIX
          : WORD_BOUNDARY.test(entry.folded[index - 1])
            ? SCORE_WORD_PREFIX
            : SCORE_TITLE_PART;
      scored.push({
        score,
        hit: { entry, highlight: toHighlight(entry, index, term.length) },
      });
      continue;
    }

    if (matchesAlias(entry, term, digits)) {
      scored.push({ score: SCORE_ALIAS, hit: { entry, highlight: null } });
    }
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.hit.entry.title.localeCompare(b.hit.entry.title, "pt-BR"),
    )
    .slice(0, limit)
    .map((item) => item.hit);
}

export interface TitlePart {
  text: string;
  match: boolean;
}

/** Quebra o título em pedaços para o negrito do trecho correspondente. */
export function splitHighlight(
  title: string,
  highlight: SearchHit["highlight"],
): TitlePart[] {
  if (!highlight) return [{ text: title, match: false }];

  return [
    { text: title.slice(0, highlight.start), match: false },
    { text: title.slice(highlight.start, highlight.end), match: true },
    { text: title.slice(highlight.end), match: false },
  ].filter((part) => part.text.length > 0);
}
