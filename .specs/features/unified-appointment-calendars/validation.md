# Unified Appointment Calendars Validation

## Validation: unified-appointment-calendars - PASS ✅

**Date**: 2026-08-23
**Spec**: `.specs/features/unified-appointment-calendars/spec.md`
**Diff range**: `54f3c9c..91dcda0`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No formal `tasks.md` exists. The two implicit execution commits are complete: `9290fc7` introduced the shared policy, and `91dcda0` aligned Agenda with monthly availability.

| Work item | Status | Evidence |
| --- | --- | --- |
| Share one availability policy | ✅ Done | `src/features/appointments/AppointmentCalendar.tsx:132` and `src/features/appointments/AgendaMonthCalendar.tsx:132` both call `getCalendarAvailabilityState`. |
| Preserve Agenda appointment context | ✅ Done | `src/features/appointments/AgendaMonthCalendar.tsx:154` combines the availability label and count; `src/features/appointments/AgendaMonthCalendar.tsx:163` preserves the marker. |
| Fetch active-doctor monthly availability | ✅ Done | `src/features/appointments/AgendaPage.tsx:126` through `src/features/appointments/AgendaPage.tsx:134` build and request the inclusive month range. |

---

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | `file:line` + exact assertion | Result |
| --- | --- | --- | --- |
| CAL-01: one shared policy | Both calendars use the same function for enablement, selected state, slotless state, and Portuguese status. | Shared-policy behavior is fixed by `src/features/appointments/calendarAvailability.test.ts:34` - `expect(state(...)).toEqual({ available: true, selected: true, withoutSlots: false, status: "disponível" })`. New appointment integration asserts it at `src/features/appointments/AppointmentCalendar.test.tsx:61` - `expect(...).toBeEnabled()`. Agenda integration asserts the same outcome at `src/features/appointments/AgendaMonthCalendar.test.tsx:42` and `:46` - `expect(available).toBeEnabled()`. Both production components call the same helper at `src/features/appointments/AppointmentCalendar.tsx:132` and `src/features/appointments/AgendaMonthCalendar.tsx:132`. | ✅ PASS |
| CAL-02: past date | Each calendar disables the date and exposes exactly `data passada`, based on clinic-local today. | New appointment: `src/features/appointments/AppointmentCalendar.test.tsx:85` - `getByRole(... name: "1 de agosto de 2026, data passada")`, followed by `:89` - `toBeDisabled()`. Agenda: `src/features/appointments/AgendaMonthCalendar.test.tsx:51` uses the exact label and `:55` asserts `toBeDisabled()`. The policy outcome is also exact at `src/features/appointments/calendarAvailability.test.ts:71` through `:76`. | ✅ PASS |
| CAL-03: unavailable statuses, missing date, or zero slots | `Blocked`, `Full`, `NoSchedule`, missing, and slotless `Available` dates are disabled with their Portuguese labels. | The exhaustive policy table is asserted at `src/features/appointments/calendarAvailability.test.ts:44` through `:52`: `expect(state(...)).toEqual({ available: false, selected: false, withoutSlots, status: label })`; missing is exact at `:56` through `:62`. New appointment wiring asserts `bloqueado`, `sem horários`, and `sem agenda` disabled at `src/features/appointments/AppointmentCalendar.test.tsx:90` through `:104`. Agenda asserts `bloqueado`, `sem horários`, `sem agenda`, and slotless `Available` disabled at `src/features/appointments/AgendaMonthCalendar.test.tsx:56` through `:75`. | ✅ PASS |
| CAL-04: available date with a real slot | Both calendars enable a non-past `Available` date with at least one slot. | New appointment: `src/features/appointments/AppointmentCalendar.test.tsx:61` through `:65` - exact `disponível` button followed by `toBeEnabled()`. Agenda: `src/features/appointments/AgendaMonthCalendar.test.tsx:42` through `:49` - exact `disponível` button, `toBeEnabled()`, and click callback `toHaveBeenCalledWith("2026-08-10")`. | ✅ PASS |
| CAL-05: inclusive active-doctor month request | Agenda requests the active doctor from the first through the last day of the displayed month. | `src/features/appointments/AgendaPage.test.tsx:229` - `expect(requestMock).toHaveBeenCalledWith("/doctors/.../availability?from=2026-08-01&to=2026-08-31")`; `:334` repeats it for the requested second doctor; `:399` through `:403` assert the changed month exactly as `from=2026-09-01&to=2026-09-30`. | ✅ PASS |
| CAL-06: appointment count and marker remain secondary context | Agenda retains the marker and exposes the appointment count together with the availability label. | `src/features/appointments/AgendaMonthCalendar.test.tsx:42` through `:47` resolve `"10 de agosto de 2026, disponível, 2 consultas, selecionado"`, assert the date enabled, and assert the marker span is present. A disabled full day also combines both states at `:61` through `:65`: `"sem horários, 1 consulta"` and `toBeDisabled()`. | ✅ PASS |
| CAL-07: retryable monthly availability failure | Agenda shows exactly `Não foi possível carregar a disponibilidade do médico.` with a retry action, then renders the calendar after retry. | `src/features/appointments/AgendaPage.test.tsx:429` through `:431` assert the exact alert text; `:432` clicks `Tentar novamente`; `:434` through `:437` assert the calendar becomes visible and `expect(availabilityAttempts).toBe(2)`. | ✅ PASS |
| CAL-08: invalid clinic time zone | Both calendars render without throwing and keep the endpoint's available state. | New appointment: `src/features/appointments/AppointmentCalendar.test.tsx:202` through `:221` assert `not.toThrow()` and the exact `disponível` date enabled. Agenda: `src/features/appointments/AgendaMonthCalendar.test.tsx:83` through `:104` assert the same. The fallback itself is exact at `src/features/appointments/calendarAvailability.test.ts:79` through `:85`, including `toBeNull()` for the invalid identifier. | ✅ PASS |
| CAL-09: active doctor or displayed month changes | The availability request is keyed to and issued for the new doctor-month combination. | Doctor change/input: `src/features/appointments/AgendaPage.test.tsx:318` through `:336` open the second doctor's URL, assert only that doctor's data, and assert `/doctors/${secondDoctorId}/availability?from=2026-08-01&to=2026-08-31`. Month change: `:388` through `:403` click `Próximo mês` and assert the September inclusive range. | ✅ PASS |
| CAL-10: no active doctor | Agenda keeps dates unavailable and makes no doctor-availability request. | `src/features/appointments/AgendaPage.test.tsx:353` through `:357` assert the exact `indisponível` date is disabled; `:358` through `:362` assert no request path includes `/availability`. | ✅ PASS |

**Status**: 10/10 requirement rows match the spec-defined outcomes. No spec-precision gaps.

---

## Edge Cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| Invalid time zone does not throw and preserves endpoint state in both calendars. | `src/features/appointments/AppointmentCalendar.test.tsx:202` through `:221`; `src/features/appointments/AgendaMonthCalendar.test.tsx:83` through `:104`. | ✅ PASS |
| Doctor or displayed month change requests the new combination. | `src/features/appointments/AgendaPage.test.tsx:318` through `:336` and `:388` through `:403`. | ✅ PASS |
| No active doctor leaves dates unavailable and skips availability requests. | `src/features/appointments/AgendaPage.test.tsx:339` through `:362`. | ✅ PASS |

---

## Discrimination Sensor

The sensor ran at `91dcda0` in a detached temporary worktree. Each mutant was independently discarded before the next attempt. The real-tree pre-sensor porcelain was empty and remained empty after scratch cleanup; only the requested validation/spec artifact edits were added afterward.

| Mutation | Production location | Behavioral fault | Focused result | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/features/appointments/calendarAvailability.ts:44` | Removed the real-slot condition so slotless `Available` dates became selectable. | 2 failed, 14 passed. `src/features/appointments/calendarAvailability.test.ts:47` rejected `available: true`; `src/features/appointments/AgendaMonthCalendar.test.tsx:75` rejected the enabled slotless day. | ✅ Killed |
| 2 | `src/features/appointments/AgendaPage.tsx:127` | Replaced month end with month start, producing one-day availability ranges. | 3 failed, 12 passed. Exact range assertions failed at `src/features/appointments/AgendaPage.test.tsx:229`, `:334`, and `:400`. | ✅ Killed |
| 3 | `src/features/appointments/AgendaMonthCalendar.tsx:163` | Flipped the appointment marker condition from positive to negative counts. | 1 failed, 1 passed. `src/features/appointments/AgendaMonthCalendar.test.tsx:47` detected the missing marker. | ✅ Killed |

**Sensor depth**: lightweight, three highest-risk behavior mutations
**Result**: 3/3 killed - PASS ✅

---

## Gate Check

No formal `tasks.md` exists, so the spec success criteria and repository frontend commands define the gate.

| Gate | Outcome |
| --- | --- |
| `npx vitest run src/features/appointments/calendarAvailability.test.ts src/features/appointments/AppointmentCalendar.test.tsx src/features/appointments/AgendaMonthCalendar.test.tsx src/features/appointments/AgendaPage.test.tsx` | ✅ 4 files, 31 passed, 0 failed, 0 skipped |
| `npm test` | ✅ 69 files, 611 passed, 0 failed, 0 skipped |
| `npm run lint` | ✅ Passed, zero warnings |
| `npm run build` | ✅ Passed (`tsc -b && vite build`) |
| `npx playwright test e2e/agenda.spec.ts` | ✅ 24 passed, 0 failed, 0 skipped |
| `git diff --check 54f3c9c..91dcda0` | ✅ Passed |

**Comparable baseline at `54f3c9c`**:

- Focused Vitest: 18 passed before across the two then-existing files; 31 passed after across the four in-scope files; delta `+13`.
- `e2e/agenda.spec.ts` is unchanged in the diff, so its collected count remains 24.
- No in-scope tests or assertions were deleted or weakened.

---

## Code Quality

| Principle | Status | Notes |
| --- | --- | --- |
| Minimum code | ✅ | One pure shared policy replaces duplicated classification, and Agenda adds only the monthly query and required UI states. |
| Surgical changes | ✅ | The diff is limited to the spec, shared policy, the two calendars, Agenda page/styles, and focused tests. |
| No scope creep | ✅ | No backend rules, appointment creation validation, or Agenda redesign was introduced. |
| Matches project patterns | ✅ | Strict TypeScript, function components, colocated CSS Module, React Query keys, Vitest, and Playwright follow `../../AGENTS.md:34` through `../../AGENTS.md:42`. |
| Spec-anchored outcomes | ✅ | All 10 rows cite exact asserted states, labels, URLs, call counts, or retry behavior. |
| Layered coverage | ✅ | Pure policy tests exhaust statuses; both calendar component suites verify wiring; Agenda page tests cover monthly happy, change, no-doctor, and retry paths; `e2e/agenda.spec.ts:722` exercises the Agenda route in a real browser. |
| No unclaimed feature tests | ✅ | New tests map to CAL-01 through CAL-10. Pre-existing tests in the modified suites remain regression guardrails and were not changed to satisfy this feature. |
| Accessibility and design guidance | ✅ | Disabled dates have textual reasons and appointment counts; this follows `../../DESIGN.md:222` and the accessible-calendar guidance in `../../Docs/Front Docs/FRONTEND_PLAN.md:15`. |
| Senior review standard | ✅ | Shared behavior has one source of truth, query ranges are explicit, error handling is retryable, and all three targeted mutants are detected. |

Interactive UAT was not required: exact interaction and accessibility outcomes are covered by component tests and the Agenda Playwright suite.

---

## Requirement Traceability Update

| Requirement | Previous status | New status |
| --- | --- | --- |
| CAL-01 | Implementing | ✅ Verified |
| CAL-02 | Implementing | ✅ Verified |
| CAL-03 | Implementing | ✅ Verified |
| CAL-04 | Implementing | ✅ Verified |
| CAL-05 | Implementing | ✅ Verified |
| CAL-06 | Implementing | ✅ Verified |
| CAL-07 | Implementing | ✅ Verified |
| CAL-08 | Implementing | ✅ Verified |
| CAL-09 | Implementing | ✅ Verified |
| CAL-10 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 requirements matched, 0 precision gaps
**Edges**: 3/3 covered
**Sensor**: 3/3 mutations killed
**Gate**: lint, build, 611 Vitest tests, 24 Agenda Playwright tests, and diff check passed

**Issues found**: none.
**Lessons**: none recorded for this clean PASS.
