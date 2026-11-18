import type {
  Prescription,
  PrescriptionList,
  PrescriptionStatus,
} from "../../../api/types";

/**
 * A lista fica sob o prefixo do paciente: invalidar `["patients", id]` também
 * a renova. Não há endpoint de detalhe; o detalhe é o item da lista.
 */
export const prescriptionKeys = {
  list: (patientId: string) => ["patients", patientId, "prescriptions"] as const,
};

/** O enum trafega em inglês e nunca aparece cru na tela. */
export const prescriptionStatusLabels: Record<PrescriptionStatus, string> = {
  Issued: "Emitida",
  Cancelled: "Cancelada",
};

const previewLength = 120;

/**
 * Começo do texto para a linha da lista. As quebras viram espaço e o corte cai
 * numa palavra: a linha é um botão e o nome acessível não pode carregar a
 * receita inteira.
 */
export function prescriptionPreview(content: string) {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= previewLength) return flat;
  const cut = flat.slice(0, previewLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > previewLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Receita recém-emitida no topo, antes de a lista voltar do servidor. */
export function prependPrescription(
  list: PrescriptionList | undefined,
  prescription: Prescription,
): PrescriptionList | undefined {
  if (!list) return list;
  return {
    ...list,
    items: [prescription, ...list.items.filter((item) => item.id !== prescription.id)],
  };
}

/** Troca a receita pela versão devolvida pela API (ex.: depois de cancelar). */
export function replacePrescription(
  list: PrescriptionList | undefined,
  prescription: Prescription,
): PrescriptionList | undefined {
  if (!list) return list;
  return {
    ...list,
    items: list.items.map((item) => (item.id === prescription.id ? prescription : item)),
  };
}
