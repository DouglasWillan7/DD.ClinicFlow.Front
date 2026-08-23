# Unified Appointment Calendars Validation

## Validation: unified-appointment-calendars - PASS ✅

**Date**: 2026-08-23
**Spec**: `.specs/features/unified-appointment-calendars/spec.md`
**Feature diff range**: `54f3c9c..02b2aca`
**Corrective diff range**: `5c8cfa8..02b2aca`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No formal `tasks.md` exists. The correction at `02b2aca` is complete. It restricts Agenda historical navigation to dates whose active-doctor count is greater than zero. The count excludes canceled appointments before it reaches the calendar.

| Work item | Status | Evidence |
| --- | --- | --- |
| Disable empty historical dates in Agenda | ✅ Done | `src/features/appointments/AgendaMonthCalendar.tsx:133` reads the date count and `:140` passes `pastDatesSelectable && count > 0` to the shared policy. |
| Keep historical dates with appointments navigable | ✅ Done | `src/features/appointments/AgendaMonthCalendar.test.tsx:58` resolves the exact historical label, `:61` asserts enabled, and `:63` asserts the selected date. |
| Count only the active doctor's non-canceled appointments | ✅ Done | `src/features/appointments/AgendaPage.tsx:172` filters by active doctor; `:180` builds counts; `:183` excludes `Cancelada`; `:189` increments the clinic-local date. |

---

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | `file:line` + exact assertion | Result |
| --- | --- | --- | --- |
| CAL-01: one shared policy | Agenda and New appointment derive enablement, selection, slot state, and Portuguese labels from `getCalendarAvailabilityState`. | Exact helper outcomes are asserted at `src/features/appointments/calendarAvailability.test.ts:33` (`toEqual({ available: true, selected: true, withoutSlots: false, status: "disponível" })`) and `:44` (`toEqual({ available: false, selected: false, withoutSlots, status: label })`). Production calls are `src/features/appointments/AppointmentCalendar.tsx:132` and `src/features/appointments/AgendaMonthCalendar.tsx:134`. | ✅ PASS |
| CAL-02: every past date in New appointment | A clinic-local past date is disabled and labeled exactly `data passada`. | `src/features/appointments/AppointmentCalendar.test.tsx:85` resolves `1 de agosto de 2026, data passada` and `:89` asserts `toBeDisabled()`. The clinic-zone boundary resolves the same exact label and disabled state at `:195` through `:199`. | ✅ PASS |
| CAL-11: conditional historical Agenda navigation | A past date is enabled only when the active doctor has at least one non-canceled appointment; otherwise it is disabled. Both states keep `data passada`. | Component assertions: `src/features/appointments/AgendaMonthCalendar.test.tsx:53` resolves `1 de agosto de 2026, data passada, sem consultas` and `:56` asserts disabled; `:58` resolves `5 de agosto de 2026, data passada, 1 consulta`, `:61` asserts enabled, and `:63` asserts `2026-08-05`. Page assertions: `src/features/appointments/AgendaPage.test.tsx:410` resolves the empty historical day and `:414` asserts disabled; `:416` resolves the confirmed active-doctor appointment, `:419` asserts enabled, `:423` asserts `/app/agenda?date=2000-08-09`, and `:426` asserts `Paciente Histórico` visible. The fixture is active-doctor and non-canceled at `:118` through `:128`; production excludes other doctors and `Cancelada` at `src/features/appointments/AgendaPage.tsx:172` through `:190`. | ✅ PASS |
| CAL-03: unavailable non-past states | `Blocked`, `Full`, `NoSchedule`, missing availability, and slotless `Available` are disabled with exact Portuguese labels in both calendars. | The exhaustive helper table at `src/features/appointments/calendarAvailability.test.ts:12` and `:44` asserts `available: false` with `sem horários`, `bloqueado`, and `sem agenda`; missing availability is `indisponível` at `:56`. New appointment asserts disabled `bloqueado`, `sem horários`, and `sem agenda` at `src/features/appointments/AppointmentCalendar.test.tsx:90` through `:104`. Agenda asserts the same states plus slotless `Available` at `src/features/appointments/AgendaMonthCalendar.test.tsx:64` through `:83`. | ✅ PASS |
| CAL-04: available non-past date with a slot | Both calendars enable `Available` only when at least one slot exists. | Helper exact state: `src/features/appointments/calendarAvailability.test.ts:33` through `:41`. New appointment resolves `disponível` and asserts enabled at `src/features/appointments/AppointmentCalendar.test.tsx:61` through `:65`. Agenda resolves `disponível`, asserts enabled, and asserts the date callback at `src/features/appointments/AgendaMonthCalendar.test.tsx:44` through `:51`. | ✅ PASS |
| CAL-05: inclusive active-doctor month range | Agenda requests availability from the first through the last date of the displayed month for the active doctor. | `src/features/appointments/AgendaPage.test.tsx:241` asserts `/doctors/${doctorId}/availability?from=2026-08-01&to=2026-08-31`; `:346` asserts the second doctor's August range; `:441` through `:445` assert `from=2026-09-01&to=2026-09-30`. | ✅ PASS |
| CAL-06: marker and accessible count | A date with appointments preserves its marker and exposes count together with availability. | `src/features/appointments/AgendaMonthCalendar.test.tsx:44` resolves `disponível, 2 consultas, selecionado`; `:49` asserts an `aria-hidden` marker. A disabled date preserves `sem horários, 1 consulta` at `:69` through `:73`. | ✅ PASS |
| CAL-07: retryable monthly availability failure | Agenda shows exactly `Não foi possível carregar a disponibilidade do médico.` and retries instead of rendering missing availability as authoritative. | `src/features/appointments/AgendaPage.test.tsx:471` asserts the exact alert, `:474` clicks `Tentar novamente`, `:476` asserts the calendar visible, and `:479` asserts exactly two attempts. | ✅ PASS |
| CAL-08: invalid clinic time zone | Both calendars render without throwing and preserve endpoint availability. | The helper returns `null` for the invalid zone at `src/features/appointments/calendarAvailability.test.ts:96` through `:102`. New appointment asserts `not.toThrow()` and enabled `disponível` at `src/features/appointments/AppointmentCalendar.test.tsx:202` through `:221`. Agenda asserts the same at `src/features/appointments/AgendaMonthCalendar.test.tsx:91` through `:113`. | ✅ PASS |
| CAL-09: doctor or month changes | Agenda requests the new doctor-month combination after either input changes. | Doctor change is asserted at `src/features/appointments/AgendaPage.test.tsx:330` through `:348`; month change is asserted at `:430` through `:445`. | ✅ PASS |
| CAL-10: no active doctor | Agenda keeps dates unavailable and performs no doctor availability request. | `src/features/appointments/AgendaPage.test.tsx:351` sets no doctors; `:365` resolves the exact past-date label, `:369` asserts disabled, and `:370` through `:374` assert no request contains `/availability`. Production disables the query at `src/features/appointments/AgendaPage.tsx:130` and passes `pastDatesSelectable={false}` at `:366`. | ✅ PASS |

**Status**: 11/11 requirements match precise spec outcomes. No spec-precision gaps.

---

## Edge Cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| Invalid time zone does not throw and preserves endpoint state in both calendars. | `src/features/appointments/AppointmentCalendar.test.tsx:202` through `:221`; `src/features/appointments/AgendaMonthCalendar.test.tsx:91` through `:113`. | ✅ PASS |
| Active-doctor or displayed-month change requests the new combination. | `src/features/appointments/AgendaPage.test.tsx:330` through `:348` and `:430` through `:445`. | ✅ PASS |
| No active doctor leaves dates unavailable and skips availability requests. | `src/features/appointments/AgendaPage.test.tsx:351` through `:374`. | ✅ PASS |

**Status**: 3/3 edge cases covered.

---

## Discrimination Sensor

The sensor ran at `02b2aca` in detached temporary worktree `/tmp/clinicflow-calendar-verifier.QvnAIU/worktree`. Each mutant was reverted before the next attempt. The scratch worktree and its parent directory were removed. Real-tree porcelain was empty before the sensor and remained identical after cleanup.

| Mutation | Scratch production location | Behavioral fault | Focused result | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/features/appointments/AgendaMonthCalendar.tsx:140` | Replaced `pastDatesSelectable && count > 0` with `pastDatesSelectable`, enabling empty historical dates. | 2 failed, 16 passed. Both the component and page rejected enabled `sem consultas` dates. | ✅ Killed |
| 2 | `src/features/appointments/AgendaMonthCalendar.tsx:140` | Forced `pastDatesSelectable: false`, blocking historical dates with appointments. | 2 failed, 16 passed. Both the component and page rejected disabled `1 consulta` dates. | ✅ Killed |
| 3 | `src/features/appointments/AppointmentCalendar.tsx:138` | Passed `pastDatesSelectable: true` to New appointment, enabling past booking dates. | 2 failed, 4 passed. Both New appointment past-date assertions rejected the enabled dates. | ✅ Killed |

**Sensor depth**: lightweight, three behavior-level mutations covering both corrected historical branches and booking safety
**Result**: 3/3 killed - PASS ✅

---

## Gate Check

No formal `tasks.md` exists. Repository frontend commands and the spec success criteria define the gate.

| Gate | Exact outcome |
| --- | --- |
| `npx vitest run src/features/appointments/calendarAvailability.test.ts src/features/appointments/AppointmentCalendar.test.tsx src/features/appointments/AgendaMonthCalendar.test.tsx src/features/appointments/AgendaPage.test.tsx --reporter=verbose` | ✅ 4 files, 33 passed, 0 failed, 0 skipped |
| `npm test -- --reporter=default` | ✅ 69 files, 613 passed, 0 failed, 0 skipped |
| `npm run lint` | ✅ Exit 0, zero warnings (`eslint . --max-warnings=0`) |
| `npm run build` | ✅ Exit 0 (`tsc -b && vite build`; 2,932 modules transformed) |
| `npx playwright test e2e/agenda.spec.ts` | ✅ 24 passed, 0 failed, 0 skipped |
| `python3 /Users/douglaswillan/.codex/skills/tlc-spec-driven/scripts/validate_spec.py .specs/features/unified-appointment-calendars/spec.md` | ✅ 0 errors, 0 warnings |
| `git diff --check 5c8cfa8..02b2aca` | ✅ Exit 0 |

**Corrective baseline at `5c8cfa8`**:

- Focused Vitest remains 33 before and after, delta `0`.
- Full Vitest remains 613 before and after, delta `0`.
- Agenda Playwright remains 24; `e2e/agenda.spec.ts` is unchanged.
- The correction changes assertions rather than deleting tests: empty historical dates changed from enabled to disabled, while a separate historical fixture with one appointment remains enabled.
- No assertions were weakened. No tests were deleted, skipped, or disabled.

---

## Code Quality

| Principle | Status | Notes |
| --- | --- | --- |
| Minimum code | ✅ | One conjunction at the Agenda boundary expresses the corrected policy. |
| Surgical changes | ✅ | `02b2aca` changes the spec, Agenda calendar wiring, and the two focused test files only. |
| No scope creep | ✅ | Booking, backend scheduling, and visual design remain unchanged. |
| Matches project patterns | ✅ | Strict TypeScript, function components, Vitest, and Playwright follow `../../AGENTS.md:38` and `../../AGENTS.md:42`. |
| Spec-anchored outcomes | ✅ | All 11 rows cite exact values, labels, enabled states, URLs, counts, or retry behavior. |
| Layered coverage | ✅ | Shared policy tests cover all availability statuses; component tests cover both calendars; Agenda page tests cover data composition, navigation, requests, and retry; Agenda Playwright passes. |
| No unclaimed corrective tests | ✅ | The changed assertions map directly to CAL-11 and its independent test. |
| Senior review standard | ✅ | Active-doctor filtering and canceled exclusion occur before count construction; Agenda alone receives the historical exception; future availability remains slot-aware. |

Interactive UAT was not performed. The observable historical click, URL transition, patient rendering, empty-date restriction, booking restriction, accessibility labels, and full Agenda browser suite are automated.

---

## Requirement Traceability Update

The spec already records all 11 requirements as `Verified`; no traceability edit was needed.

| Requirement set | Previous status | New status |
| --- | --- | --- |
| CAL-01 through CAL-11 (11 mapped rows) | Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/11 requirements matched, 0 precision gaps
**Edges**: 3/3 covered
**Sensor**: 3/3 mutations killed
**Gate**: 33 focused Vitest, 613 full Vitest, 24 Agenda Playwright, lint, build, spec validation, and diff check passed

**Issues found**: none.
**Lessons**: none recorded for this clean PASS.
