import "@testing-library/jest-dom/vitest";

// O jsdom não implementa rolagem; componentes que mantêm o item ativo visível
// (busca global, listas com teclado) chamariam um método inexistente.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
