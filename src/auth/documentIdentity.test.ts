import { describe, expect, test } from "vitest";
import {
  documentCredentialsSchema,
  documentPlaceholder,
  documentTypesFor,
  recoveryIdentitySchema,
} from "./documentIdentity";

describe("documentIdentity", () => {
  test("oferece tipos e exemplos coerentes com o país", () => {
    expect(documentTypesFor("BR").map(({ code }) => code)).toEqual(["CPF", "PASSPORT"]);
    expect(documentTypesFor("PT").map(({ code }) => code)).toEqual(["NIF", "PASSPORT"]);
    expect(documentPlaceholder("BR", "CPF")).toBe("000.000.000-00");
  });

  test("rejeita CPF incompleto antes de autenticar ou recuperar", () => {
    const credentials = documentCredentialsSchema.safeParse({
      countryCode: "BR", documentType: "CPF", document: "123",
      password: "segredo", rememberConnection: true,
    });
    const recovery = recoveryIdentitySchema.safeParse({
      countryCode: "BR", documentType: "CPF", document: "123",
    });

    expect(credentials.error?.issues[0]?.message).toBe("Informe um CPF com 11 dígitos.");
    expect(recovery.error?.issues[0]?.message).toBe("Informe um CPF com 11 dígitos.");
  });

  test("aceita documento internacional sem pressupor CPF", () => {
    expect(documentCredentialsSchema.safeParse({
      countryCode: "PT", documentType: "NIF", document: "123456789",
      password: "segredo", rememberConnection: false,
    }).success).toBe(true);
  });
});
