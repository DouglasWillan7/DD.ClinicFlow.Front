import { describe, expect, test } from "vitest";

/*
 * Convenções de CSS que DESIGN.md exige e que nenhum linter do projeto cobre.
 * Breakpoint fora do conjunto só entra na lista de exceções abaixo, e só com um
 * comentário no CSS dizendo por que o conjunto do sistema não serve ali.
 */
const sources = import.meta.glob<string>("../**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

const files = Object.entries(sources).map(([path, css]) => ({
  path: path.replace(/^\.\.\//, ""),
  css,
}));

/** Breakpoints do sistema (640/960/1280), escritos como `max-width` de n-1. */
const canonicalBreakpoints = new Set([
  "max-639",
  "max-959",
  "max-1279",
  "min-640",
  "min-960",
  "min-1280",
]);

/** Exceções justificadas, por arquivo (cada uma comentada no próprio CSS). */
const breakpointExceptions: Record<string, string[]> = {
  "auth/LoginPage.module.css": ["max-920"],
  "auth/RegisterPage.module.css": ["max-390"],
  "components/InternationalPhoneField.module.css": ["max-430"],
  "features/patients/PatientRegistrationForm.module.css": ["max-430"],
};

/** Aliases do antigo bloco de migração de tokens.css: não existem mais e não voltam. */
const migrationAlias =
  /var\(--(color-text-secondary|color-attention(-text|-tint)?|color-selected-(background|border)|color-hover|color-blue-tint|color-border(-soft)?|radius-(sm|md|lg)|space-10|shadow-(low|raised))\)/;

function breakpointsOf(css: string) {
  const found = new Set<string>();
  for (const media of css.match(/@media[^{]*/g) ?? []) {
    for (const [, kind, value] of media.matchAll(/\((max|min)-width:\s*(\d+)px\)/g)) {
      found.add(`${kind}-${value}`);
    }
  }
  return [...found];
}

test("o glob encontrou as folhas de estilo do app", () => {
  expect(files.length).toBeGreaterThan(40);
});

describe.each(files)("$path", ({ path, css }) => {
  test("não usa vidro (backdrop-filter)", () => {
    expect(css).not.toMatch(/backdrop-filter/);
  });

  test("não tem texto abaixo de 12px", () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(([, size]) => Number(size));
    expect(sizes.filter((size) => size < 12)).toEqual([]);
  });

  test("usa só os breakpoints do sistema, além das exceções justificadas", () => {
    const allowed = new Set(breakpointExceptions[path] ?? []);
    const offenders = breakpointsOf(css).filter(
      (breakpoint) => !canonicalBreakpoints.has(breakpoint) && !allowed.has(breakpoint),
    );
    expect(offenders).toEqual([]);
  });

  test("não usa aliases de migração", () => {
    expect(css).not.toMatch(migrationAlias);
  });
});

test("toda exceção registrada ainda existe: as resolvidas saem da lista", () => {
  const stale: string[] = [];
  for (const [path, allowed] of Object.entries(breakpointExceptions)) {
    const css = files.find((file) => file.path === path)?.css;
    const present = css ? breakpointsOf(css) : [];
    for (const breakpoint of allowed) {
      if (!present.includes(breakpoint)) stale.push(`${path}: ${breakpoint}`);
    }
  }
  expect(stale).toEqual([]);
});
