import type {
  ClinicHealthcarePlans,
  HealthcarePlanMode,
  UserClinicHealthcarePlans,
} from "../../api/types";

/** Identificador do item "Clínica" na lista; os médicos usam o próprio `userClinicId`. */
export const CLINIC_ITEM = "clinica";

export interface ClinicDraft {
  accepted: string[];
  defaults: string[];
}

export interface DoctorDraft {
  mode: HealthcarePlanMode;
  planIds: string[];
}

export function sameSelection(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function toggleId(ids: readonly string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function clinicDraftFromSaved(saved: ClinicHealthcarePlans): ClinicDraft {
  return {
    accepted: saved.healthcarePlanIds,
    // Web e API são implantadas separadas: uma API anterior ao padrão não manda esta lista.
    defaults: saved.defaultHealthcarePlanIds ?? [],
  };
}

/** Só um convênio aceito pode ser padrão: o padrão nunca passa dos aceitos. */
export function normalizeClinicDraft(draft: ClinicDraft): ClinicDraft {
  return {
    accepted: draft.accepted,
    defaults: draft.defaults.filter((id) => draft.accepted.includes(id)),
  };
}

export function isClinicDirty(draft: ClinicDraft, saved: ClinicDraft) {
  const current = normalizeClinicDraft(draft);
  return (
    !sameSelection(current.accepted, saved.accepted)
    || !sameSelection(current.defaults, saved.defaults)
  );
}

/** Devolve um convênio ao estado salvo (aceito e padrão), mantendo o resto do rascunho. */
export function restoreClinicPlan(
  draft: ClinicDraft,
  saved: ClinicDraft,
  planId: string,
): ClinicDraft {
  const restore = (current: string[], original: string[]) =>
    original.includes(planId)
      ? current.includes(planId) ? current : [...current, planId]
      : current.filter((id) => id !== planId);
  return {
    accepted: restore(draft.accepted, saved.accepted),
    defaults: restore(draft.defaults, saved.defaults),
  };
}

export function doctorDraftFromSaved(
  saved: Pick<UserClinicHealthcarePlans, "mode" | "healthcarePlanIds">,
): DoctorDraft {
  return { mode: saved.mode, planIds: saved.healthcarePlanIds };
}

/**
 * Convênios que o rascunho deixa marcados: no padrão, os da clínica; em personalizado, a
 * lista própria sem o que a clínica deixou de aceitar (para nunca ser reenviado).
 */
export function doctorSelectedIds(
  draft: DoctorDraft,
  clinic: ClinicDraft,
): string[] {
  const source = draft.mode === "Custom" ? draft.planIds : clinic.defaults;
  return source.filter((id) => clinic.accepted.includes(id));
}

export function isDoctorDirty(
  draft: DoctorDraft,
  saved: DoctorDraft,
  clinic: ClinicDraft,
) {
  if (draft.mode !== saved.mode) return true;
  return (
    draft.mode === "Custom"
    && !sameSelection(doctorSelectedIds(draft, clinic), doctorSelectedIds(saved, clinic))
  );
}

/** O que a lista do médico tem a mais (+) e a menos (−) em relação ao padrão da clínica. */
export function diffFromDefault(
  planIds: readonly string[],
  defaultIds: readonly string[],
) {
  return {
    added: planIds.filter((id) => !defaultIds.includes(id)),
    removed: defaultIds.filter((id) => !planIds.includes(id)),
  };
}

/** Quantos médicos atendem cada convênio, a partir da lista efetiva de cada um. */
export function countDoctorsByPlan(effectiveLists: ReadonlyArray<readonly string[]>) {
  const counts = new Map<string, number>();
  for (const list of effectiveLists) {
    for (const id of new Set(list)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function withoutKey<T>(record: Record<string, T>, key: string) {
  return Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key),
  );
}
