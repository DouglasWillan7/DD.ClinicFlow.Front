import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TemplateImageStore, templateImagePath } from "./templateImages";

let created = 0;

beforeEach(() => {
  created = 0;
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => `blob:imagem-${++created}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

test("baixa cada imagem uma vez e avisa quem acompanha", async () => {
  const load = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
  const store = new TemplateImageStore(load);
  const listener = vi.fn();
  store.subscribe(listener);

  store.ensure("a");
  store.ensure("a");
  expect(store.get("a")).toEqual({ status: "loading" });
  await vi.waitFor(() => expect(store.get("a")).toEqual({ status: "ready", url: "blob:imagem-1" }));
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith("a");
  expect(listener).toHaveBeenCalledTimes(2);
});

test("falha no download vira estado de erro", async () => {
  const store = new TemplateImageStore(async () => {
    throw new Error("404");
  });
  store.ensure("x");
  await vi.waitFor(() => expect(store.get("x")).toEqual({ status: "error" }));
});

test("arquivo recém-enviado entra sem download e troca revoga a URL anterior", () => {
  const load = vi.fn();
  const store = new TemplateImageStore(load);
  store.put("a", new Blob(["1"]));
  store.put("a", new Blob(["2"]));
  store.ensure("a");
  expect(load).not.toHaveBeenCalled();
  expect(store.get("a")).toEqual({ status: "ready", url: "blob:imagem-2" });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:imagem-1");
});

test("revoga tudo depois de sair da página, mas sobrevive ao desmonta-e-monta do StrictMode", async () => {
  const store = new TemplateImageStore(async () => new Blob(["png"]));
  store.put("a", new Blob(["1"]));

  store.release();
  store.retain();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(store.get("a")).toEqual({ status: "ready", url: "blob:imagem-1" });

  store.ensure("b");
  store.release();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:imagem-1");
  expect(store.get("a")).toBeUndefined();
  // A resposta que chega depois do descarte não cria URL que ninguém revogaria.
  await Promise.resolve();
  await Promise.resolve();
  expect(store.get("b")).toBeUndefined();
  expect(created).toBe(1);
});

test("monta o caminho autenticado da imagem", () => {
  expect(templateImagePath("abc-123")).toBe("/clinics/prescription-template/images/abc-123");
});
