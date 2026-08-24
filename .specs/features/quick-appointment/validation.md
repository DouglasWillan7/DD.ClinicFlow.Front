# Consulta Rápida Validation

**Date**: 2026-08-24  
**Spec**: `.specs/features/quick-appointment/spec.md`  
**Diff range**: `0d35fd9^..f075f1b`  
**Commits**: `0d35fd9`, `067e60d`, `92aa184`, `414af70`, `f075f1b`  
**Verifier**: independent fresh sub-agent (author != verifier)  
**Result**: PASS

## Verdict

PASS. QRAP-01 through QRAP-17 match their spec-defined outcomes. The QRAP-16 return journey proves the restored state as one conjunction after a real unmount/remount and proves the same values in the final POST. The exact build gate passed, both targeted mutants were killed, and no spec-precision gap, surviving mutant, `SPEC_DEVIATION`, skipped test, or code-quality blocker remains.

## Task Completion

| Task | Status | Evidence |
| --- | --- | --- |
| T1: Style the appointment action menu | Done | `src/features/appointments/AgendaPage.module.css:136` gives the trigger a 44px target; `src/features/appointments/AgendaPage.module.css:164` preserves focus visibility; `src/features/appointments/AgendaPage.module.css:178` bounds the overlay; `src/features/appointments/AgendaPage.module.css:1059` disables motion. |
| T2: Add the two-path Agenda action | Done | `src/features/appointments/AgendaPage.test.tsx:225`, `src/features/appointments/AgendaPage.test.tsx:249`, `src/features/appointments/AgendaPage.test.tsx:267`, and `src/features/appointments/AgendaPage.test.tsx:288`. |
| T3: Resolve the next free slot in quick mode | Done | `src/features/appointments/NewAppointmentPage.test.tsx:242`, `src/features/appointments/NewAppointmentPage.test.tsx:335`, `src/features/appointments/NewAppointmentPage.test.tsx:388`, `src/features/appointments/NewAppointmentPage.test.tsx:418`, and `src/features/appointments/NewAppointmentPage.test.tsx:455`. |
| T4: Cover the critical quick appointment journey | Done | `e2e/agenda.spec.ts:503` covers menu keyboard behavior, quick routing, automatic selection, exact payload, destination, and success feedback. |
| T5: Prove patient-registration round-trip restoration | Done | `src/features/appointments/NewAppointmentPage.test.tsx:517` covers save, patient-registration route, unmount/remount, restored conjunction, confirmation, payload, and destination. |

All five tasks are checked complete in `tasks.md`; no blocked or partial task remains.

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | Implementation evidence | Assertion evidence | Result |
| --- | --- | --- | --- | --- |
| QRAP-01 | `Nova consulta` exposes distinct `Agendar consulta` and `Consulta rápida` actions. | `src/features/appointments/AgendaPage.tsx:384` renders the trigger/menu and `src/features/appointments/AgendaPage.tsx:413` plus `src/features/appointments/AgendaPage.tsx:428` render the two actions. | `src/features/appointments/AgendaPage.test.tsx:241` asserts the menu is visible; `src/features/appointments/AgendaPage.test.tsx:242` selects `Agendar consulta`; `src/features/appointments/AgendaPage.test.tsx:260` selects `Consulta rápida`. | PASS |
| QRAP-02 | Standard scheduling keeps the active date and doctor unchanged. | `src/features/appointments/AgendaPage.tsx:295` builds the standard route from `day` and active `doctor`. | `src/features/appointments/AgendaPage.test.tsx:244` asserts `/app/agenda/nova?date=2026-08-10&doctorId=<active>`. | PASS |
| QRAP-03 | Quick scheduling opens with `mode=quick`, active date, and active doctor in the URL. | `src/features/appointments/AgendaPage.tsx:304` sets all three query values. | `src/features/appointments/AgendaPage.test.tsx:262` asserts the exact quick URL; `e2e/agenda.spec.ts:525` asserts the same route in-browser. | PASS |
| QRAP-04 | Without an active doctor, quick scheduling is disabled and explains that a doctor is required. | `src/features/appointments/AgendaPage.tsx:428` disables the action when `doctor` is absent and `src/features/appointments/AgendaPage.tsx:441` supplies the explanation. | `src/features/appointments/AgendaPage.test.tsx:306` asserts disabled; `src/features/appointments/AgendaPage.test.tsx:309` asserts `Selecione um médico para usar este atalho.`; `src/features/appointments/AgendaPage.test.tsx:310` keeps standard scheduling enabled. | PASS |
| QRAP-05 | Quick availability spans the clinic-local current date through 61 days later, 62 inclusive. | `src/features/appointments/NewAppointmentPage.tsx:218` derives the clinic-local day and `src/features/appointments/NewAppointmentPage.tsx:221` adds 61 days before building the request at `src/features/appointments/NewAppointmentPage.tsx:234`. | With the clock instant still on Aug 6 in São Paulo but Aug 7 in Kiritimati, `src/features/appointments/NewAppointmentPage.test.tsx:297` asserts exactly `from=2026-08-07&to=2026-10-07`. | PASS |
| QRAP-06 | The lowest `startUtc` across the complete response is selected. | `src/features/appointments/NewAppointmentPage.tsx:102` flattens all days and sorts by parsed `startUtc`; `src/features/appointments/NewAppointmentPage.tsx:280` resolves that slot into selection. | The response puts Aug 11 before Aug 10 at `src/features/appointments/NewAppointmentPage.test.tsx:252`; `src/features/appointments/NewAppointmentPage.test.tsx:313` and `src/features/appointments/NewAppointmentPage.test.tsx:314` assert Aug 10 at 09:00, and `src/features/appointments/NewAppointmentPage.test.tsx:320` asserts its exact `startUtc` in the POST. | PASS |
| QRAP-07 | Quick mode defaults to `Presencial` without a saved type and permits change before confirmation. | `src/features/appointments/NewAppointmentPage.tsx:141` defaults only quick mode to `InPerson`, while `src/features/appointments/NewAppointmentPage.tsx:498` keeps both type controls editable. | `src/features/appointments/NewAppointmentPage.test.tsx:301` asserts `Presencial` selected; `src/features/appointments/NewAppointmentPage.test.tsx:304` changes to `Teleconsulta`; `src/features/appointments/NewAppointmentPage.test.tsx:305` asserts it selected. | PASS |
| QRAP-08 | Changing the doctor discards the previous slot and resolves the earliest slot for the new doctor. | `src/features/appointments/newAppointmentState.ts:63` clears date and slot on a changed doctor; `src/features/appointments/NewAppointmentPage.tsx:285` selects from the new availability result. | `src/features/appointments/NewAppointmentPage.test.tsx:382` asserts Dr. Paulo, `src/features/appointments/NewAppointmentPage.test.tsx:383` and `src/features/appointments/NewAppointmentPage.test.tsx:384` assert his Aug 9 09:30 slot, and `src/features/appointments/NewAppointmentPage.test.tsx:385` asserts the former 09:00 slot is gone. | PASS |
| QRAP-09 | Confirmation sends the existing payload with selected patient, doctor, type, and automatic `startUtc`. | `src/features/appointments/NewAppointmentPage.tsx:629` builds the existing five-field payload directly from the complete selection. | `src/features/appointments/NewAppointmentPage.test.tsx:320` uses one `toHaveBeenCalledWith` assertion for `patientId`, `doctorUserId`, `startUtc`, `type`, and `notes`; `e2e/agenda.spec.ts:548` independently asserts the same payload object. | PASS |
| QRAP-10 | Creation returns to the agenda date of the created appointment and shows existing success feedback. | `src/features/appointments/NewAppointmentPage.tsx:348` builds the dated destination with appointment ID and `created=true`; `src/features/appointments/AgendaPage.tsx:452` renders the existing created banner. | `e2e/agenda.spec.ts:545` asserts the exact dated destination and `e2e/agenda.spec.ts:555` asserts the complete success message. | PASS |
| QRAP-11 | No slots yields the exact 62-day message and disables confirmation. | `src/features/appointments/NewAppointmentPage.tsx:563` renders the exact empty-state copy; incomplete selection disables confirmation through `src/features/appointments/AppointmentSummary.tsx:98`. | `src/features/appointments/NewAppointmentPage.test.tsx:409` asserts `Nenhum horário livre nos próximos 62 dias.` and `src/features/appointments/NewAppointmentPage.test.tsx:412` asserts disabled confirmation. | PASS |
| QRAP-12 | Availability failure shows the exact message and a retry that can recover. | `src/features/appointments/NewAppointmentPage.tsx:547` renders `ErrorBlock` with the required copy and `availability.refetch`. | `src/features/appointments/NewAppointmentPage.test.tsx:443` asserts the message, `src/features/appointments/NewAppointmentPage.test.tsx:446` activates retry, `src/features/appointments/NewAppointmentPage.test.tsx:451` asserts the recovered slot, and `src/features/appointments/NewAppointmentPage.test.tsx:452` asserts two attempts. | PASS |
| QRAP-13 | A 409 shows the backend message, refreshes quick availability, and remains in quick mode. | `src/features/appointments/NewAppointmentPage.tsx:353` preserves the backend message and, for 409, invalidates/refetches the attempted availability key while `quickMode` stays unchanged. | `src/features/appointments/NewAppointmentPage.test.tsx:503` asserts `Horário ocupado`; `src/features/appointments/NewAppointmentPage.test.tsx:507` asserts the refreshed slot; `src/features/appointments/NewAppointmentPage.test.tsx:509` asserts the quick heading remains; `src/features/appointments/NewAppointmentPage.test.tsx:513` asserts two availability requests; `src/features/appointments/NewAppointmentPage.test.tsx:514` asserts no navigation. | PASS |
| QRAP-14 | The open menu exposes expanded state; Escape closes it and returns focus to `Nova consulta`. | `src/features/appointments/AgendaPage.tsx:189` installs Escape handling and restores trigger focus; `src/features/appointments/AgendaPage.tsx:385` exposes `aria-expanded`. | `src/features/appointments/AgendaPage.test.tsx:240` asserts expanded `true`; `src/features/appointments/AgendaPage.test.tsx:281` sends Escape; `src/features/appointments/AgendaPage.test.tsx:283`, `src/features/appointments/AgendaPage.test.tsx:284`, and `src/features/appointments/AgendaPage.test.tsx:285` assert closed, collapsed, and focused. Browser coverage repeats this at `e2e/agenda.spec.ts:512` and `e2e/agenda.spec.ts:517`. | PASS |
| QRAP-15 | Unordered availability days still produce the lowest `startUtc`. | `src/features/appointments/NewAppointmentPage.tsx:102` sorts the flattened response independently of day order. | The deliberately unordered fixture starts at `src/features/appointments/NewAppointmentPage.test.tsx:252`; the assertions at `src/features/appointments/NewAppointmentPage.test.tsx:313` and `src/features/appointments/NewAppointmentPage.test.tsx:320` prove the lower Aug 10 `startUtc` wins. | PASS |
| QRAP-16 | After creating a patient, quick mode, doctor, non-default type, and automatic slot resolution survive together. | `src/features/appointments/NewAppointmentPage.tsx:126` restores the scoped draft, `src/features/appointments/NewAppointmentPage.tsx:141` restores its type, `src/features/appointments/NewAppointmentPage.tsx:205` restores its doctor, `src/features/appointments/NewAppointmentPage.tsx:285` re-resolves the automatic slot, and `src/features/appointments/NewAppointmentPage.tsx:395` preserves `mode=quick` in the patient-return URL. | In one test, `src/features/appointments/NewAppointmentPage.test.tsx:559` asserts the saved doctor/type/date, `src/features/appointments/NewAppointmentPage.test.tsx:566` asserts the quick return route, `src/features/appointments/NewAppointmentPage.test.tsx:570` performs unmount, `src/features/appointments/NewAppointmentPage.test.tsx:583` through `src/features/appointments/NewAppointmentPage.test.tsx:599` jointly assert quick mode + new patient + restored doctor + `Teleconsulta` + auto 09:00/date, and `src/features/appointments/NewAppointmentPage.test.tsx:607` asserts those same values together in the final POST. | PASS |
| QRAP-17 | No slot inside the 62-day response never falls back outside configured availability. | `src/features/appointments/NewAppointmentPage.tsx:102` can select only response slots; `src/features/appointments/NewAppointmentPage.tsx:295` clears selection when none exists and never synthesizes a fallback. | With an empty 62-day response, `src/features/appointments/NewAppointmentPage.test.tsx:409` asserts the no-slot state, `src/features/appointments/NewAppointmentPage.test.tsx:412` asserts confirmation disabled, and `src/features/appointments/NewAppointmentPage.test.tsx:415` asserts no manual calendar fallback. | PASS |

**Status**: 17/17 acceptance criteria match precise spec outcomes. Evidence-or-zero is satisfied for every criterion. Spec-precision gaps: 0.

## Payload and Conjunction Rule

- QRAP-09 is not satisfied by a call-count assertion. `src/features/appointments/NewAppointmentPage.test.tsx:320` asserts the exact appointment endpoint, POST method, and one payload object containing patient, doctor, automatic `startUtc`, selected type, and `notes: null`.
- QRAP-16 is not satisfied by independent pre-navigation checks. The same test unmounts at `src/features/appointments/NewAppointmentPage.test.tsx:570`, remounts with the new patient at `src/features/appointments/NewAppointmentPage.test.tsx:577`, asserts the full restored UI conjunction at `src/features/appointments/NewAppointmentPage.test.tsx:583`, then asserts the complete POST conjunction at `src/features/appointments/NewAppointmentPage.test.tsx:607`.

## Edge Cases

- [x] Unordered days choose the lowest `startUtc`: QRAP-15.
- [x] Patient-registration return preserves mode, doctor, non-default type, and re-resolved slot as one journey: QRAP-16.
- [x] Empty 62-day availability never creates an off-schedule fallback: QRAP-17.
- [x] Doctor changes remove the former slot before resolving the new doctor's first slot: QRAP-08.
- [x] Availability error and appointment conflict both remain recoverable in quick mode: QRAP-12 and QRAP-13.

## Discrimination Sensor

The sensor used a detached temporary git worktree at `f075f1b`. Each mutation was applied and tested separately, then restored. No mutation touched the real worktree. No `git stash` was used.

| Mutation | Scratch file:line | Behavior fault | Focused command | Result |
| --- | --- | --- | --- | --- |
| M1 | `src/features/appointments/NewAppointmentPage.tsx:143` | Ignored `restoredDraft.type` and forced quick mode back to `InPerson` after the patient-return remount. | `npm test -- NewAppointmentPage.test.tsx -t "consulta rápida preserva o modo e as escolhas ao cadastrar paciente"` | KILLED. Exit 1 at `src/features/appointments/NewAppointmentPage.test.tsx:587`: restored `Teleconsulta` was absent. |
| M2 | `src/features/appointments/NewAppointmentPage.tsx:287` | Reversed the quick-mode guard so automatic slot resolution never ran. | `npm test -- NewAppointmentPage.test.tsx -t "consulta rápida preserva o modo e as escolhas ao cadastrar paciente"` | KILLED. Exit 1 at `src/features/appointments/NewAppointmentPage.test.tsx:559`: the automatically resolved draft date became `null`. |

**Sensor depth**: lightweight, 2 targeted behavior mutations.  
**Result**: 2/2 killed, 0 survived. PASS.

**Isolation proof**: real-tree `git status --porcelain=v1` was empty before sensor work and empty after both temporary worktrees were removed. `git worktree list --porcelain` then listed only the real `main` worktree at `f075f1b`.

## Gate Check

- **Exact Build command**: `npm run lint && npm run build && npm test && npm run test:e2e -- agenda.spec.ts`
- **Exit code**: 0
- **Lint**: PASS, zero warnings (`eslint . --max-warnings=0`)
- **Build**: PASS (`tsc -b && vite build`)
- **Vitest after feature**: 73 files, 653 passed, 0 failed, 0 skipped
- **Playwright after feature**: 29 passed, 0 failed, 0 skipped
- **Pre-feature baseline at `0d35fd9^`**: 73 Vitest files, 644 tests; 28 Playwright tests listed in `agenda.spec.ts`
- **Delta**: +9 Vitest tests and +1 Playwright test, +10 total; no test count decrease
- **Skipped tests**: none
- **Failures**: none

## Code Quality

| Check | Status | Evidence |
| --- | --- | --- |
| Minimum code and reuse of existing flow | PASS | The feature remains a query-param mode in `NewAppointmentPage`; no second API contract, status, or persisted type was added. |
| Surgical diff and no scope creep | PASS | The product diff changes only the Agenda action/menu, quick scheduling page, their tests, one agenda E2E, and feature artifacts. |
| Existing patterns and strict TypeScript | PASS | Existing React Query, reducer, navigation, API payload, feedback, and conflict paths are reused; lint and TypeScript build pass. |
| Test integrity | PASS | Pre-feature 644+28 tests grew to 653+29; no test was skipped or deleted to satisfy the feature. |
| Spec-anchored outcomes | PASS | 17/17 criteria cite exact values/states and assertions above; vague existence assertions do not stand in for required outcomes. |
| Payload/conjunction coverage | PASS | QRAP-09 and QRAP-16 assert all correlated fields together. |
| Per-layer coverage | PASS | Agenda interaction has unit coverage, quick selection/error branches have unit coverage, and the critical user flow has Playwright coverage. |
| No unclaimed tests | PASS | All feature-added tests map to QRAP criteria or T1 presentation done-when conditions in `tasks.md`. |
| Documented guidelines | PASS | Repository `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, and the test matrix in `tasks.md` were respected; the exact registered Build gate passed. |
| Diff hygiene | PASS | `git diff --check 0d35fd9^..f075f1b` passed and no `SPEC_DEVIATION` exists in the changed surface. |

## Interactive UAT

Not performed. The acceptance outcomes are deterministic and fully exercised by unit tests plus the critical Playwright browser journey at `e2e/agenda.spec.ts:503`; no unresolved visual-judgment criterion remains in the spec.

## Requirement Traceability

| Requirement | Previous status | Verified status |
| --- | --- | --- |
| QRAP-01 | Verified | Verified |
| QRAP-02 | Verified | Verified |
| QRAP-03 | Verified | Verified |
| QRAP-04 | Verified | Verified |
| QRAP-05 | Verified | Verified |
| QRAP-06 | Verified | Verified |
| QRAP-07 | Verified | Verified |
| QRAP-08 | Verified | Verified |
| QRAP-09 | Verified | Verified |
| QRAP-10 | Verified | Verified |
| QRAP-11 | Verified | Verified |
| QRAP-12 | Verified | Verified |
| QRAP-13 | Verified | Verified |
| QRAP-14 | Verified | Verified |
| QRAP-15 | Verified | Verified |
| QRAP-16 | Verified | Verified |
| QRAP-17 | Verified | Verified |

## Lessons Distillation

Clean PASS: 0 failed/uncovered ACs, 0 spec-precision gaps, 0 surviving mutants, 0 gate failures, and 0 `SPEC_DEVIATION` markers. No lesson was added. The earlier QRAP-16 `ac_gap` is already grounded as L-025 and is not duplicated by this clean re-verification.

## Summary

**Overall**: Ready.  
**Spec-anchored check**: 17/17 PASS, 0 precision gaps.  
**Gate**: lint/build PASS; Vitest 653/653; Playwright 29/29; 0 skipped.  
**Sensor**: 2/2 mutants killed.  
**Ranked gaps**: none.
