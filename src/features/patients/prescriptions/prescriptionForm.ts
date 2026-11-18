import { z } from "zod";

/** Mesmo limite do validador da API (`IssuePrescriptionRequestValidator`). */
export const prescriptionContentMaxLength = 5000;

/**
 * Um único campo de texto livre. As bordas são aparadas; as quebras de linha
 * internas fazem parte da receita e seguem como foram digitadas.
 */
export const prescriptionSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Escreva o texto da receita.")
    .max(
      prescriptionContentMaxLength,
      "A receita pode ter até 5.000 caracteres.",
    ),
});

export type PrescriptionFormInput = z.input<typeof prescriptionSchema>;
export type PrescriptionFormValue = z.output<typeof prescriptionSchema>;

/** Contador do campo, no formato pt-BR ("1.234 de 5.000 caracteres"). */
export function prescriptionLengthHint(content: string) {
  const format = new Intl.NumberFormat("pt-BR");
  return `${format.format(content.length)} de ${format.format(prescriptionContentMaxLength)} caracteres`;
}
