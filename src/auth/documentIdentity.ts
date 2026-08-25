import { z } from "zod";

export const documentCountries = [
  { code: "BR", label: "Brasil" },
  { code: "PT", label: "Portugal" },
  { code: "US", label: "Estados Unidos" },
  { code: "AR", label: "Argentina" },
  { code: "UY", label: "Uruguai" },
] as const;

const countryDocumentTypes: Record<string, Array<{ code: string; label: string }>> = {
  BR: [
    { code: "CPF", label: "CPF" },
    { code: "PASSPORT", label: "Passaporte" },
  ],
  PT: [
    { code: "NIF", label: "NIF" },
    { code: "PASSPORT", label: "Passaporte" },
  ],
  US: [{ code: "PASSPORT", label: "Passaporte" }],
  AR: [
    { code: "DNI", label: "DNI" },
    { code: "PASSPORT", label: "Passaporte" },
  ],
  UY: [
    { code: "CI", label: "Cédula de identidade" },
    { code: "PASSPORT", label: "Passaporte" },
  ],
};

export function documentTypesFor(countryCode: string) {
  return countryDocumentTypes[countryCode] ?? [{ code: "PASSPORT", label: "Passaporte" }];
}

export function documentPlaceholder(countryCode: string, documentType: string) {
  if (countryCode === "BR" && documentType === "CPF") return "000.000.000-00";
  if (countryCode === "PT" && documentType === "NIF") return "000 000 000";
  return "Número do documento";
}

const documentIdentitySchema = z.object({
  countryCode: z.string().length(2, "Selecione o país do documento."),
  documentType: z.string().min(2, "Selecione o tipo de documento."),
  document: z.string().trim().min(3, "Informe o número do documento."),
});

function validateDocument(
  value: z.infer<typeof documentIdentitySchema>,
  context: z.RefinementCtx,
) {
  if (
    value.countryCode === "BR" &&
    value.documentType === "CPF" &&
    value.document.replace(/\D/g, "").length !== 11
  ) {
    context.addIssue({
      code: "custom",
      path: ["document"],
      message: "Informe um CPF com 11 dígitos.",
    });
  }
}

export const documentCredentialsSchema = documentIdentitySchema
  .extend({
    password: z.string().min(1, "Informe sua senha."),
    rememberConnection: z.boolean(),
  })
  .superRefine(validateDocument);

export type DocumentCredentials = z.infer<typeof documentCredentialsSchema>;

export const recoveryIdentitySchema = documentIdentitySchema.superRefine(validateDocument);

export type RecoveryIdentity = z.infer<typeof recoveryIdentitySchema>;
