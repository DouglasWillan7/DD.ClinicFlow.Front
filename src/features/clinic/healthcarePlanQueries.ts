/**
 * Chaves das consultas de convênios. Configuração › Convênios, o vínculo em Equipe e
 * Meu perfil editam os mesmos dados; a chave única mantém as três telas em sincronia.
 */
export const healthcarePlanCatalogKey = ["healthcare-plans", "catalog"] as const;

export const clinicHealthcarePlansKey = ["healthcare-plans", "clinic"] as const;

export const doctorHealthcarePlansPrefix = ["healthcare-plans", "doctor"] as const;

export function doctorHealthcarePlansKey(userClinicId: string) {
  return [...doctorHealthcarePlansPrefix, userClinicId] as const;
}

/** Resumo dos integrantes, que traz o modo e a contagem de convênios de cada médico. */
export const clinicMembersSummaryKey = ["clinic", "members"] as const;
