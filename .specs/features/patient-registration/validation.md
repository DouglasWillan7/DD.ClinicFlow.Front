# Cadastro de paciente em etapas Validation - PASS

**Date**: 2026-08-23
**Spec**: `.specs/features/patient-registration/spec.md`
**Diff range**: `428a51a^..16ea1f8` (`83cdac3..16ea1f8`)
**Verifier**: fresh independent sub-agent (author != verifier)

The complete feature passes all ten acceptance criteria. The accessibility fix closes the prior target-size gap: one helper checks every visible button, input, select, and textarea in all three wizard steps at 1440px and 390px. The exact prior Cancel regression now fails both viewport tests.

---

## Spec-Anchored Acceptance Criteria

Evidence-or-zero and the compound-criterion rule apply. Every assertion below targets the value or state required by the spec.

| ID | Spec-defined outcome | `file:line` + assertion expression | Result |
| --- | --- | --- | --- |
| PATREG-01 | Show the exact three steps and start on Identificação. | `src/features/patients/PatientRegistrationForm.test.tsx:33-43` - `getByRole("list", ...)`, three exact `toBeVisible()` assertions, `toHaveAttribute("aria-current", "step")`, and the initial heading assertion. | **PASS** |
| PATREG-02 | Each invalid name, WhatsApp, or CPF independently keeps step 1 and shows its specific message. | `src/features/patients/PatientRegistrationForm.test.tsx:72-104` - `test.each` enumerates all three field/message pairs; `findByText(message).toBeVisible()`; Identificação remains visible; `expect(onSubmit).not.toHaveBeenCalled()`. | **PASS** |
| PATREG-03 | A valid first step opens Dados clínicos and preserves name, WhatsApp, and CPF after Back. | `src/features/patients/PatientRegistrationForm.test.tsx:48-69` - Dados clínicos heading is visible, then `toHaveValue(...)` asserts all three restored values. | **PASS** |
| PATREG-04 | Birth date, blood type, and laboratory sex are optional and preserve populated selections. | Optional path: `src/features/patients/NewPatientPage.test.tsx:79-82` advances through blank clinical fields and reaches the doctor selector. Preservation: `src/features/patients/PatientRegistrationForm.test.tsx:51-65` asserts the exact restored date, blood type, and laboratory sex. | **PASS** |
| PATREG-05 | No active doctor replaces the wizard with add-doctor guidance. | `src/features/patients/NewPatientPage.test.tsx:145-152` - exact guidance heading `toBeVisible()` and wizard list `not.toBeInTheDocument()`. | **PASS** |
| PATREG-06 | Missing responsible doctor keeps Atendimento and shows the exact message. | `src/features/patients/PatientRegistrationForm.test.tsx:130-132` - save is attempted, `findByText("Selecione o médico responsável.").toBeVisible()`, and the still-visible field accepts a selection. | **PASS** |
| PATREG-07 | Pending creation disables the final action, hides Back, and shows the loading label. | `src/features/patients/PatientRegistrationForm.test.tsx:146-158` - pending rerender; `getByRole("button", { name: "Salvando paciente…" }).toBeDisabled()`; Back `not.toBeInTheDocument()`. | **PASS** |
| PATREG-08 | API rejection shows its message in an alert and preserves every form value. | `src/features/patients/NewPatientPage.test.tsx:185-199` - exact API message via `findByRole("alert").toHaveTextContent(...)`; eight `toHaveValue(...)` assertions cover doctor, notes, clinical fields, name, WhatsApp, and CPF. | **PASS** |
| PATREG-09 | Success safely returns to `/app/agenda/nova`, retains query state, and adds `patientId`. | `src/features/patients/NewPatientPage.test.tsx:84-87` - `expect(navigateMock).toHaveBeenCalledWith(...)` asserts the exact `/app/agenda/nova?date=2026-08-10&patientId=${patientId}` URL. | **PASS** |
| PATREG-10 | Associated labels, visible focus, announced current step, every target at least 44px, and no horizontal scroll at 390px and 1440px. | Labels and focus: `e2e/pacientes.spec.ts:460-464` resolves the labelled field and asserts computed focus shadow is not `none`; the flow resolves every form field through `getByLabel` at `:467-491` and `:581-587`. Current step: `:452-454`, `:486-488`, `:567-569`, and `:588-590` assert the exact `[aria-current="step"]` text at both viewports. Targets: helper `:268-280` selects all visible `button`, `input`, `select`, and `textarea` under `main` and asserts both dimensions `>= 44`; calls at `:465`, `:476`, `:489`, `:579`, `:585`, and `:591` cover every step at both viewports. Overflow: `:458` asserts 1440 body width; `:573-578` asserts the form stays inside 390px and body width equals 390. | **PASS** |

**Status**: **10/10 PASS; 0 gaps; 0 spec-precision gaps.**

### Payload/conjunction check

The complete serialized POST body is asserted exactly at `e2e/pacientes.spec.ts:496-509` with `toEqual({ name, phone, cpf, bloodType, sexForClinicalUse, doctorUserId, birthDate, notes })`. No required payload field is covered only partially.

---

## Edge Cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| `?nome=` does not exceed 120 characters. | `src/features/patients/NewPatientPage.test.tsx:202-218` creates 140 characters and asserts `suggestedName.slice(0, 120)`. | **PASS** |
| External/disallowed return falls back on cancel and completion. | Cancel: `src/features/patients/NewPatientPage.test.tsx:113-130`; completion: `:221-244`; both assert `/app/pacientes`. | **PASS** |
| At 390px, visual step labels hide but accessible names remain. | `src/features/patients/PatientRegistrationForm.module.css:298-306` visually hides only `.stepLabel`; `e2e/pacientes.spec.ts:561-569` still resolves all three names and the current step. | **PASS** |

---

## Gate Check

All gates ran at detached clean commit `16ea1f8`. The unrelated dirty real tree did not enter any command.

| Gate | Result | Counts / notes |
| --- | --- | --- |
| `npm test` | **PASS**, exit 0 | 70 files; **622 passed, 0 failed, 0 skipped**. |
| `npm run lint` | **PASS**, exit 0 | Zero warnings. |
| `npm run build` | **PASS**, exit 0 | TypeScript and Vite production build succeeded. |
| `npx playwright test e2e/pacientes.spec.ts` | **PASS**, exit 0 | **12 passed, 0 failed, 0 skipped**. |

**Combined executed cases**: 634 passed, 0 failed, 0 skipped.
**Clean pre-feature Vitest baseline** (`428a51a^` / `83cdac3`): 69 files, 613 passed.
**Clean current Vitest count** (`16ea1f8`): 70 files, 622 passed.
**Delta**: +9 tests. No skips, disabled tests, weakened assertions, or count decrease found.
**Diff hygiene**: `git diff --check 428a51a^..16ea1f8` passed.

---

## Discrimination Sensor

All mutations ran only in detached temporary worktrees at `16ea1f8`. The real tree was never mutated or stashed.

| Mutation | Production location | Fault | Focused result | Killed? |
| --- | --- | --- | --- | --- |
| M1 | `src/features/patients/PatientRegistrationForm.module.css:234-236` | Shrink Cancel from `min-height: 44px; padding: 8px 14px` to `20px; 0 14px`. | Desktop and mobile registration tests both failed in helper assertion `e2e/pacientes.spec.ts:279`: expected `>= 44`, received `21`. This is the exact previously surviving mutation. | **Killed** |
| M2 | `src/features/patients/PatientRegistrationForm.module.css:184` | Override Back with `min-height: 20px`. | Mobile failed in helper assertion `e2e/pacientes.spec.ts:279`: expected `>= 44`, received `24.5`. Desktop correctly stayed green because flex stretch kept the actual rendered Back target at least 44px. | **Killed** |
| M3 | `src/features/patients/PatientRegistrationForm.tsx:99` | Keep `aria-current="step"` on Identificação after advancing. | Desktop and mobile failed at `e2e/pacientes.spec.ts:486` and `:588`: expected Atendimento, received Identificação. | **Killed** |

**Sensor depth**: lightweight, three targeted behavior mutations.
**Result**: **3/3 killed; 0 survived - PASS.**
**Isolation**: the real-tree porcelain snapshot before and after all scratch gates and mutations was byte-identical, SHA-256 `9e134fc5baf42b4259c9320e073954b4c282e8512feeff05b2954af96a4fca91`.

---

## Visual Inspection

The clean Playwright gate regenerated and the verifier inspected:

- `pacientes-09-cadastro-identificacao.png`, 1440x1044, SHA-256 `709b6308...b3f25`.
- `pacientes-10-cadastro-atendimento.png`, 1440x1044, SHA-256 `49872d56...a595`.
- `pacientes-11-cadastro-mobile.png`, 390x844, SHA-256 `06d175aa...e578`.

No clipping, overlap, text truncation, horizontal overflow, or hierarchy loss is visible. The mobile screenshot keeps every final-step action fully visible and stacked.

---

## Code Quality

| Principle | Status | Evidence / note |
| --- | --- | --- |
| Minimum code, surgical scope, existing patterns | **PASS** | The feature reuses React Hook Form, Zod, Query, navigation helpers, Field components, and CSS modules. The final fix adds the bounded e2e helper and removes the nested `main` landmark. |
| Test integrity | **PASS** | Test count increased by nine. No skip/only/todo marker or weakened feature assertion was found. |
| Spec-anchored outcome check | **PASS** | All ten criteria assert their exact required value or state. |
| Per-layer coverage expectation | **PASS** | Component tests cover wizard state/validation; page tests cover mutation, errors, fallbacks, and return behavior; Playwright covers the serialized contract and responsive accessibility. |
| Every scoped test is claimed | **PASS** | Each added test maps to PATREG-01..10 or a listed edge case. |
| Documented guidelines | **PASS** | `AGENTS.md`, `PRODUCT.md:25-33`, and `/Users/douglaswillan/Sources/Pessoal/ClinicFlow/DESIGN.md:214-226,265` were followed. |
| Senior-engineer approval | **PASS** | The prior known regression is now killed at both specified viewports with one reusable, bounded helper. |

---

## Requirement Traceability

| Requirement | Previous status | New status |
| --- | --- | --- |
| PATREG-01..10 | Implementing | **Verified** |

---

## Summary

**Overall**: **PASS - Ready**
**Spec-anchored check**: 10/10 ACs matched; 0 gaps.
**Gate**: 4/4 commands passed; 634/634 cases passed.
**Sensor**: 3/3 mutants killed, including the exact prior Cancel target regression at both 1440px and 390px.
**Issues found**: none.
**Next step**: none required for this feature.
