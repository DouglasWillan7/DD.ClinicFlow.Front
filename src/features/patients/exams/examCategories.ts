import type { ExamCategory } from "../../../api/types";

/**
 * Categorias que a equipe pode atribuir a um laudo. "Não classificado" fica de fora: é o estado de
 * quem ainda não foi classificado, nunca uma escolha.
 */
export const clinicalExamCategories = [
  "Laboratório",
  "Imagem",
  "Endoscopia",
  "Cardiologia",
] as const satisfies readonly Exclude<ExamCategory, "Não classificado">[];
