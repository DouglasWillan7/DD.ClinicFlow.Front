import { beforeEach, describe, expect, test } from "vitest";
import {
  formatOpenedAt,
  readRecents,
  rememberRecent,
} from "./recentSearches";

const scope = "clinica-1:usuario-1:Admin";
const store = new Map<string, string>();

// O localStorage do ambiente de teste não implementa os métodos padrão.
beforeEach(() => {
  store.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
});

describe("rememberRecent", () => {
  test("guarda o mais recente primeiro e não repete o mesmo item", () => {
    rememberRecent(scope, { kind: "patient", id: "p1", label: "Ana" });
    rememberRecent(scope, { kind: "doctor", id: "d1", label: "Dra. Helena" });
    rememberRecent(scope, { kind: "patient", id: "p1", label: "Ana Teixeira" });

    expect(readRecents(scope).map((recent) => recent.id)).toEqual(["p1", "d1"]);
    expect(readRecents(scope)[0].label).toBe("Ana Teixeira");
  });

  test("mantém no máximo cinco itens", () => {
    for (let index = 0; index < 7; index += 1) {
      rememberRecent(scope, {
        kind: "patient",
        id: `p${index}`,
        label: `Paciente ${index}`,
      });
    }

    expect(readRecents(scope).map((recent) => recent.id)).toEqual([
      "p6",
      "p5",
      "p4",
      "p3",
      "p2",
    ]);
  });

  test("não vaza o histórico de uma sessão para outra", () => {
    rememberRecent(scope, { kind: "patient", id: "p1", label: "Ana" });

    expect(readRecents("clinica-2:usuario-9:Doctor")).toEqual([]);
    expect(readRecents("")).toEqual([]);
  });
});

describe("readRecents", () => {
  test("descarta conteúdo corrompido em vez de derrubar a busca", () => {
    store.set("clinicflow.busca-recentes:" + scope, "{ nao é json");
    expect(readRecents(scope)).toEqual([]);

    store.set(
      "clinicflow.busca-recentes:" + scope,
      JSON.stringify([{ kind: "alien", id: 1 }, null]),
    );
    expect(readRecents(scope)).toEqual([]);
  });
});

describe("formatOpenedAt", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  test("fala em dias, como no handoff", () => {
    expect(formatOpenedAt("2026-08-09T09:00:00Z", now)).toBe("aberto hoje");
    expect(formatOpenedAt("2026-08-08T23:00:00Z", now)).toBe("aberto ontem");
    expect(formatOpenedAt("2026-08-06T09:00:00Z", now)).toBe("aberto há 3 dias");
    expect(formatOpenedAt("2026-06-01T09:00:00Z", now)).toBe(
      "aberto em 01/06/2026",
    );
  });

  test("não quebra com data inválida", () => {
    expect(formatOpenedAt("ontem", now)).toBe("aberto recentemente");
  });
});
