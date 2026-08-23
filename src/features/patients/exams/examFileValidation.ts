export const MAX_EXAM_PDF_BYTES = 10 * 1024 * 1024;

export async function validateExamPdf(file: File): Promise<string | null> {
  if (file.size > MAX_EXAM_PDF_BYTES) return "O PDF deve ter no máximo 10 MB.";
  const signature = new TextDecoder("ascii").decode(
    await file.slice(0, 5).arrayBuffer(),
  );
  return signature === "%PDF-" ? null : "Envie um arquivo PDF válido.";
}
