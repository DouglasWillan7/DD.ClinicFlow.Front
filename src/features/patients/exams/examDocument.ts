/** Mensagem única para qualquer falha ao abrir o PDF: bloqueio de pop-up, rede ou arquivo ausente. */
export const examDocumentUnavailableMessage = "O laudo original está indisponível no momento.";

/**
 * Abre o PDF do exame em outra aba. A aba é aberta antes de o arquivo chegar porque o navegador só
 * permite `window.open` dentro do clique; se o carregamento falhar, ela é fechada.
 */
export async function openExamDocumentInNewTab(loadDocument: () => Promise<Blob>) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error(examDocumentUnavailableMessage);
  tab.opener = null;

  try {
    const blob = await loadDocument();
    const objectUrl = URL.createObjectURL(blob);
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    tab.close();
    throw new Error(examDocumentUnavailableMessage);
  }
}
