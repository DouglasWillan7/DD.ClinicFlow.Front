import { differenceInCalendarDays, format } from "date-fns";
import type { SearchKind } from "./searchIndex";

const RECENT_KEY_PREFIX = "clinicflow.busca-recentes:";
const MAX_RECENTS = 5;

export const kindLabels: Record<SearchKind, string> = {
  patient: "Paciente",
  doctor: "Médico",
};

export interface RecentSearch {
  kind: SearchKind;
  id: string;
  /** Rótulo do momento em que foi aberto: o índice pode não ter mais o item. */
  label: string;
  openedAtIso: string;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RecentSearch>;
  return (
    (candidate.kind === "patient" || candidate.kind === "doctor") &&
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.openedAtIso === "string"
  );
}

/**
 * Últimos itens abertos pelo usuário, na ordem em que foram abertos. A chave
 * carrega o escopo da sessão (clínica + usuário + papéis), como a preferência
 * do menu, para que trocar de conta nunca mostre o histórico de outra pessoa.
 */
export function readRecents(scope: string): RecentSearch[] {
  if (!scope) return [];
  try {
    const stored = localStorage.getItem(`${RECENT_KEY_PREFIX}${scope}`);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function rememberRecent(
  scope: string,
  item: Omit<RecentSearch, "openedAtIso">,
  now = new Date(),
): RecentSearch[] {
  const next = [
    { ...item, openedAtIso: now.toISOString() },
    ...readRecents(scope).filter(
      (recent) => !(recent.kind === item.kind && recent.id === item.id),
    ),
  ].slice(0, MAX_RECENTS);

  if (scope) {
    try {
      localStorage.setItem(
        `${RECENT_KEY_PREFIX}${scope}`,
        JSON.stringify(next),
      );
    } catch {
      // A navegação continua mesmo sem acesso ao storage persistente.
    }
  }

  return next;
}

export function formatOpenedAt(openedAtIso: string, now = new Date()) {
  const openedAt = new Date(openedAtIso);
  if (Number.isNaN(openedAt.getTime())) return "aberto recentemente";

  const days = differenceInCalendarDays(now, openedAt);
  if (days <= 0) return "aberto hoje";
  if (days === 1) return "aberto ontem";
  if (days < 30) return `aberto há ${days} dias`;
  return `aberto em ${format(openedAt, "dd/MM/yyyy")}`;
}
