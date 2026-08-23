import { describe, expect, test } from "vitest";
import { MAX_EXAM_PDF_BYTES, validateExamPdf } from "./examFileValidation";

function file(content: BlobPart[], name = "laudo.pdf", type = "application/pdf") {
  return new File(content, name, { type });
}

describe("validateExamPdf", () => {
  test("aceita arquivo que começa por %PDF-", async () => {
    expect(await validateExamPdf(file(["%PDF-1.7\nconteúdo"]))).toBeNull();
  });

  test("rejeita extensão PDF com magic bytes inválidos usando a mensagem da spec", async () => {
    expect(await validateExamPdf(file(["arquivo qualquer"]))).toBe("Envie um arquivo PDF válido.");
  });

  test("aceita exatamente 10 MB", async () => {
    const bytes = new Uint8Array(MAX_EXAM_PDF_BYTES);
    bytes.set(new TextEncoder().encode("%PDF-"));
    expect(await validateExamPdf(file([bytes]))).toBeNull();
  });

  test("rejeita acima de 10 MB usando a mensagem da spec", async () => {
    const oversized = new File([new Uint8Array(MAX_EXAM_PDF_BYTES + 1)], "laudo.pdf");
    expect(await validateExamPdf(oversized)).toBe("O PDF deve ter no máximo 10 MB.");
  });
});
