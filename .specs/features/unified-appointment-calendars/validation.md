# Unified Appointment Calendars Validation

## Validation: unified-appointment-calendars - PASS ✅

**Date**: 2026-08-23
**Spec**: `.specs/features/unified-appointment-calendars/spec.md`
**Feature diff range**: `54f3c9c..aa8ef65`
**Corrective diff range**: `61fcaf6..aa8ef65`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No formal `tasks.md` exists. The implementation is complete in `9290fc7`, `91dcda0`, and the historical-navigation correction `aa8ef65`.

| Work item | Status | Evidence |
| --- | --- | --- |
| Share one availability policy | ✅ Done | `src/features/appointments/AppointmentCalendar.tsx:132` and `src/features/appointments/AgendaMonthCalendar.tsx:134` call `getCalendarAvailabilityState`. |
| Keep booking and historical-navigation policies separate | ✅ Done | New appointment relies on the helper default at `src/features/appointments/AppointmentCalendar.tsx:133`; Agenda passes `pastDatesSelectable` at `src/features/appointments/AgendaMonthCalendar.tsx:135`, enabled only with an active doctor at `src/features/appointments/AgendaPage.tsx:383`. |
| Preserve appointment context and load monthly availability | ✅ Done | `src/features/appointments/AgendaMonthCalendar.tsx:157` combines status and count; `src/features/appointments/AgendaMonthCalendar.tsx:166` preserves the marker; `src/features/appointments/AgendaPage.tsx:126` builds the inclusive range. |

---

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | `file:line` + exact assertion | Result |
| --- | --- | --- | --- |
| CAL-01: one shared policy | Both calendars derive enablement, selection, slotless state, and Portuguese labels from one helper. | The helper contract is exact at `src/features/appointments/calendarAvailability.test.ts:33` (`toEqual({ available: true, selected: true, withoutSlots: false, status: "disponível" })`) and `:44` (`toEqual({ available: false, selected: false, withoutSlots, status: label })`). Production calls are at `src/features/appointments/AppointmentCalendar.tsx:132` and `src/features/appointments/AgendaMonthCalendar.tsx:134`. | ✅ PASS |
| CAL-02: past date in New appointment | New appointment disables a clinic-local past date and labels it exactly `data passada`. | `src/features/appointments/AppointmentCalendar.test.tsx:85` resolves `"1 de agosto de 2026, data passada"`; `:89` asserts `toBeDisabled()`. The clinic-zone boundary is asserted at `:195` through `:199`. | ✅ PASS |
| CAL-11: past date in Agenda | Agenda enables a past date for historical navigation, labels it `data passada` regardless of availability, updates the URL, and shows prior attendance. | Unit policy: `src/features/appointments/calendarAvailability.test.ts:79` passes `availability: undefined` with `pastDatesSelectable: true`; `:88` asserts `available: true`, `selected: true`, and `status: "data passada"`. Component: `src/features/appointments/AgendaMonthCalendar.test.tsx:52` resolves the exact label, `:55` asserts `toBeEnabled()`, and `:57` asserts the selected date. Page: `src/features/appointments/AgendaPage.test.tsx:410` resolves `"9 de agosto de 2000, data passada, 1 consulta"`; `:413` asserts enabled, `:416` asserts `/app/agenda?date=2000-08-09`, and `:419` asserts `Paciente Histórico` is visible. | ✅ PASS |
| CAL-03: unavailable future states | A non-past `Blocked`, `Full`, `NoSchedule`, missing, or slotless `Available` date is disabled with its Portuguese label in both calendars. | Exhaustive helper table: `src/features/appointments/calendarAvailability.test.ts:12` and `:44`, with `available: false` and exact label; missing is exact at `:56`. New appointment wiring asserts disabled `bloqueado`, `sem horários`, and `sem agenda` at `src/features/appointments/AppointmentCalendar.test.tsx:90`. Agenda wiring asserts those states plus slotless `Available` disabled at `src/features/appointments/AgendaMonthCalendar.test.tsx:58` through `:77`. | ✅ PASS |
| CAL-04: future date with a real slot | Both calendars enable a non-past `Available` date with at least one slot. | Helper: `src/features/appointments/calendarAvailability.test.ts:33` asserts `available: true`. New appointment: `src/features/appointments/AppointmentCalendar.test.tsx:61` resolves `disponível` and `:65` asserts `toBeEnabled()`. Agenda: `src/features/appointments/AgendaMonthCalendar.test.tsx:43` resolves `disponível`, `:47` asserts enabled, and `:50` asserts the date callback. | ✅ PASS |
| CAL-05: inclusive active-doctor month request | Agenda requests the active doctor's availability from the first through the last date of the displayed month. | `src/features/appointments/AgendaPage.test.tsx:241` asserts `/doctors/${doctorId}/availability?from=2026-08-01&to=2026-08-31`; doctor change is exact at `:346`; month change is exact at `:435` as `from=2026-09-01&to=2026-09-30`. | ✅ PASS |
| CAL-06: count and marker remain secondary context | Agenda preserves the appointment marker and exposes count together with availability status. | `src/features/appointments/AgendaMonthCalendar.test.tsx:43` resolves `"disponível, 2 consultas, selecionado"`; `:48` asserts the marker. A disabled day combines `"sem horários, 1 consulta"` with `toBeDisabled()` at `:63` through `:67`. | ✅ PASS |
| CAL-07: retryable availability failure | Agenda shows exactly `Não foi possível carregar a disponibilidade do médico.` and a retry action instead of treating missing data as availability. | `src/features/appointments/AgendaPage.test.tsx:465` asserts the exact alert; `:468` clicks `Tentar novamente`; `:470` asserts the calendar becomes visible; `:473` asserts two attempts. | ✅ PASS |
| CAL-08: invalid clinic time zone | Both calendars render without throwing and preserve the endpoint's available state. | Helper returns `null` for the invalid zone at `src/features/appointments/calendarAvailability.test.ts:102`. New appointment asserts `not.toThrow()` and enabled `disponível` at `src/features/appointments/AppointmentCalendar.test.tsx:205` through `:221`. Agenda asserts the same at `src/features/appointments/AgendaMonthCalendar.test.tsx:89` through `:107`. | ✅ PASS |
| CAL-09: doctor or month change | Agenda requests availability for the new doctor-month combination. | Doctor change: `src/features/appointments/AgendaPage.test.tsx:330` selects the second doctor, `:343` proves only that doctor's timeline, and `:346` asserts his August URL. Month change: `:424` clicks `Próximo mês` and `:435` asserts the September inclusive range. | ✅ PASS |
| CAL-10: no active doctor | Agenda leaves dates unavailable and makes no doctor-availability request. | `src/features/appointments/AgendaPage.test.tsx:365` resolves the exact `data passada` day; `:369` asserts disabled; `:370` through `:374` assert that no request contains `/availability`. Production disables the query at `src/features/appointments/AgendaPage.tsx:130` and passes `pastDatesSelectable={false}` at `:366`. | ✅ PASS |

**Status**: 11/11 requirements match precise spec outcomes. No spec-precision gaps.

---

## Edge Cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| Invalid time zone does not throw and preserves endpoint state in both calendars. | `src/features/appointments/AppointmentCalendar.test.tsx:202`; `src/features/appointments/AgendaMonthCalendar.test.tsx:85`. | ✅ PASS |
| Doctor or displayed month change requests the new combination. | `src/features/appointments/AgendaPage.test.tsx:330` and `:424`. | ✅ PASS |
| No active doctor leaves dates unavailable and skips availability requests. | `src/features/appointments/AgendaPage.test.tsx:351`. | ✅ PASS |

---

## Discrimination Sensor

The sensor ran at `aa8ef65` in detached temporary worktree `/tmp/clinicflow-calendar-verifier.8zMLhn`. Each mutant was restored before the next attempt. The scratch worktree was removed after the run. The real-tree porcelain was empty before the sensor and remained identical after cleanup.

| Mutation | Scratch production location | Behavioral fault | Focused result | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/features/appointments/calendarAvailability.ts:46` | Forced all past dates unavailable, breaking historical selection in Agenda. | 3 failed, 24 passed: helper, Agenda calendar, and Agenda page rejected the disabled historical day. | ✅ Killed |
| 2 | `src/features/appointments/AppointmentCalendar.tsx:138` | Passed `pastDatesSelectable: true` into New appointment, mixing Agenda history policy into booking. | 2 failed, 4 passed: both New appointment past-date assertions rejected the enabled dates. | ✅ Killed |
| 3 | `src/features/appointments/calendarAvailability.ts:48` | Removed the real-slot condition, enabling future `Available` dates with zero slots. | 2 failed, 15 passed: helper and Agenda calendar rejected the enabled slotless day. | ✅ Killed |

**Sensor depth**: lightweight, three behavior-level mutations covering the corrected branch and future availability guard
**Result**: 3/3 killed - PASS ✅

---

## Gate Check

No formal `tasks.md` exists, so repository frontend commands and the spec success criteria define the gate.

| Gate | Outcome |
| --- | --- |
| `npx vitest run src/features/appointments/calendarAvailability.test.ts src/features/appointments/AppointmentCalendar.test.tsx src/features/appointments/AgendaMonthCalendar.test.tsx src/features/appointments/AgendaPage.test.tsx --reporter=verbose` | ✅ 4 files, 33 passed, 0 failed, 0 skipped |
| `npm test -- --reporter=default` | ✅ 69 files, 613 passed, 0 failed, 0 skipped |
| `npm run lint` | ✅ Passed, zero warnings |
| `npm run build` | ✅ Passed (`tsc -b && vite build`) |
| `npx playwright test e2e/agenda.spec.ts` | ✅ 24 passed, 0 failed, 0 skipped |
| `git diff --check 61fcaf6..aa8ef65` | ✅ Passed |

**Comparable corrective baseline at `61fcaf6`**:

- Focused Vitest: 31 before, 33 after, delta `+2`.
- Full Vitest: 611 before, 613 after, delta `+2`.
- Agenda Playwright remained at 24; `e2e/agenda.spec.ts` was unchanged.
- No tests were deleted, skipped, or weakened by `aa8ef65`.

---

## Code Quality

| Principle | Status | Notes |
| --- | --- | --- |
| Minimum code | ✅ | One optional helper input expresses the sole intentional policy difference. |
| Surgical changes | ✅ | The correction changes the helper, Agenda wiring, focused tests, and spec only. |
| No scope creep | ✅ | Booking rules, backend rules, and visual design remain unchanged. |
| Matches project patterns | ✅ | Strict TypeScript, function components, React Query, Vitest, and Playwright follow `../../AGENTS.md:34`. |
| Spec-anchored outcomes | ✅ | All 11 rows cite exact values, labels, enabled states, URLs, counts, or retry behavior. |
| Layered coverage | ✅ | Pure policy tests cover every availability branch; both calendar components verify wiring; Agenda page verifies historical navigation and fetch/error transitions; the Agenda browser suite passes. |
| No unclaimed corrective tests | ✅ | The two tests added by `aa8ef65` map directly to CAL-11 and the corrected no-doctor edge. |
| Senior review standard | ✅ | Agenda history is explicit, New appointment remains safe by default, and future unavailability remains slot-aware. |

Interactive UAT was not performed. The exact historical click, URL transition, patient rendering, booking restriction, and accessibility labels are asserted in component/page tests; the complete Agenda Playwright suite also passed.

---

## Requirement Traceability Update

| Requirement | Previous status | New status |
| --- | --- | --- |
| CAL-01 | Verified | ✅ Verified |
| CAL-02 | Implementing | ✅ Verified |
| CAL-11 | Implementing | ✅ Verified |
| CAL-03 | Implementing | ✅ Verified |
| CAL-04 | Verified | ✅ Verified |
| CAL-05 | Verified | ✅ Verified |
| CAL-06 | Verified | ✅ Verified |
| CAL-07 | Verified | ✅ Verified |
| CAL-08 | Verified | ✅ Verified |
| CAL-09 | Verified | ✅ Verified |
| CAL-10 | Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/11 requirements matched, 0 precision gaps
**Edges**: 3/3 covered
**Sensor**: 3/3 mutations killed
**Gate**: lint, build, 613 Vitest tests, 33 focused tests, 24 Agenda Playwright tests, and diff check passed

**Issues found**: none.
**Lessons**: none recorded for this clean PASS.
