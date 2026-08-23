import { z } from "zod";

const clinicalCategories = ["Laboratório", "Imagem", "Endoscopia", "Cardiologia"] as const;

export const examRequestSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do exame."),
  category: z.union([
    z.literal(""),
    z.enum(clinicalCategories),
  ]).refine((value) => value !== "", "Informe a categoria do exame."),
  scheduledOn: z.string(),
}).transform((value) => ({
  name: value.name,
  category: value.category as (typeof clinicalCategories)[number],
  scheduledOn: value.scheduledOn || null,
}));

export type ExamRequestFormInput = z.input<typeof examRequestSchema>;
export type ExamRequestFormValue = z.output<typeof examRequestSchema>;

export const examRequestCategories = clinicalCategories;
