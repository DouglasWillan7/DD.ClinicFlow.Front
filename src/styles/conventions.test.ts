import { describe, expect, test } from "vitest";

/*
 * Convenções de CSS que DESIGN.md exige e que nenhum linter do projeto cobre.
 * As listas de exceção abaixo são a dívida conhecida: cada fase da migração
 * remove entradas. Arquivo novo ou arquivo já migrado não pode entrar nelas.
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

/** Breakpoints fora do conjunto ainda tolerados, por arquivo. */
const breakpointDebt: Record<string, string[]> = {
  "app/AppErrorBoundary.module.css": ["max-520"],
  "auth/AuthLayout.module.css": ["max-820"],
  "auth/LoginPage.module.css": ["max-920"],
  "auth/RegisterPage.module.css": ["max-390"],
  "components/InternationalPhoneField.module.css": ["max-430"],
  "features/appointments/AgendaPage.module.css": ["max-899", "min-1180"],
  "features/appointments/NewAppointmentPage.module.css": ["min-1180"],
  "features/clinic-invitation/ClinicMembershipInvitationPage.module.css": ["max-560"],
  "features/clinic/HealthcarePlansSettingsPage.module.css": ["max-650"],
  "features/clinic/ScheduleSettingsPage.module.css": ["max-600", "max-820"],
  "features/clinic/SettingsLayout.module.css": ["max-650"],
  "features/dashboard/DoctorHomePage.module.css": ["max-799"],
  "features/onboarding/OnboardingPage.module.css": ["max-780"],
  "features/patient-actions/ClinicalAccessEmailAction.module.css": ["max-720"],
  "features/patients/PatientRegistrationForm.module.css": ["max-430"],
  "features/public-patient-action/PublicPatientActionPage.module.css": ["max-560"],
  "features/team/ClinicMemberForm.module.css": ["max-520", "max-760"],
  "features/team/TeamPage.module.css": ["max-520", "max-720", "max-980"],
};

/** Arquivos que ainda usam aliases do bloco de migração de tokens.css. */
const aliasDebt = new Set([
  "app/AppErrorBoundary.module.css",
  "app/NotFoundPage.module.css",
  "auth/AuthLayout.module.css",
  "auth/AuthPages.module.css",
  "features/clinic-invitation/ClinicMembershipInvitationPage.module.css",
  "features/clinic/HealthcarePlansSettingsPage.module.css",
  "features/clinic/SettingsLayout.module.css",
  "features/onboarding/OnboardingChecklist.module.css",
  "features/onboarding/OnboardingPage.module.css",
  "features/public-patient-action/PublicPatientActionPage.module.css",
  "features/team/ClinicMemberForm.module.css",
  "features/team/TeamPage.module.css",
]);

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

  test("usa só os breakpoints do sistema, além da dívida registrada", () => {
    const allowed = new Set(breakpointDebt[path] ?? []);
    const offenders = breakpointsOf(css).filter(
      (breakpoint) => !canonicalBreakpoints.has(breakpoint) && !allowed.has(breakpoint),
    );
    expect(offenders).toEqual([]);
  });

  test("não usa aliases de migração, além da dívida registrada", () => {
    if (aliasDebt.has(path)) return;
    expect(css).not.toMatch(migrationAlias);
  });
});

test("a dívida registrada ainda existe: entradas resolvidas saem da lista", () => {
  const stale: string[] = [];
  for (const [path, allowed] of Object.entries(breakpointDebt)) {
    const css = files.find((file) => file.path === path)?.css;
    const present = css ? breakpointsOf(css) : [];
    for (const breakpoint of allowed) {
      if (!present.includes(breakpoint)) stale.push(`${path}: ${breakpoint}`);
    }
  }
  for (const path of aliasDebt) {
    const css = files.find((file) => file.path === path)?.css;
    if (!css || !migrationAlias.test(css)) stale.push(`${path}: aliases`);
  }
  expect(stale).toEqual([]);
});
