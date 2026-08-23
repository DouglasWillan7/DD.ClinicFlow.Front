# Unified Appointment Calendars Specification

## Problem Statement

The new-appointment calendar uses the doctor's authoritative monthly availability to classify and enable dates. Agenda needs the same future-date availability states while remaining a historical navigation surface, where clinic professionals can inspect prior appointments even though those dates can no longer be booked.

## Goals

- [x] Make Agenda and New appointment use one availability policy for calendar dates.
- [x] Keep Agenda's appointment-count context without overriding availability state.
- [x] Load the active doctor's availability for the full displayed Agenda month.
- [x] Keep past dates disabled for booking and make only dates with appointments selectable for historical Agenda navigation.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Backend scheduling rules | The availability endpoint already owns these rules. |
| Appointment creation validation | The booking flow and API already validate the selected slot. |
| Agenda visual redesign | This change aligns behavior and reuses existing visual states. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Meaning of "same behavior" | Agenda and New appointment share future availability states; Agenda allows past dates only when that doctor has appointments to inspect. | The user clarified that empty historical dates have no useful Agenda destination. | y |
| Agenda appointment counts | Preserve the existing marker and accessible count as secondary context. | Counts remain useful and do not replace the authoritative availability state. | y |
| Invalid clinic time zone | Preserve the current fallback: availability remains authoritative and no local-past classification is added. | This matches New appointment and avoids crashing the calendar. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Consistent calendar availability

**User Story**: As a clinic professional, I want Agenda and New appointment to share scheduling availability while Agenda still opens historical dates so that I can both avoid invalid bookings and review prior attendance.

**Why P1**: Divergent calendars create invalid scheduling attempts and erode trust in the agenda.

**Acceptance Criteria**:

1. The frontend SHALL derive date selectability and availability labels in Agenda and New appointment from one shared calendar policy.
2. IF a date is earlier than today in the clinic time zone THEN New appointment SHALL disable it and label it `data passada`.
3. IF a date is earlier than today in the clinic time zone AND the active doctor has at least one non-canceled appointment on that date THEN Agenda SHALL enable it for historical navigation and label it `data passada`; OTHERWISE Agenda SHALL disable the past date and keep the same label.
4. IF a non-past date is `Blocked`, `Full`, `NoSchedule`, missing from availability, or `Available` with zero slots THEN both calendars SHALL disable it and expose the corresponding Portuguese availability label.
5. WHEN a non-past date is `Available` with at least one slot THEN both calendars SHALL enable it.
6. WHEN Agenda displays a month for an active doctor THEN the frontend SHALL request that doctor's availability from the first through the last date of that month.
7. WHEN Agenda renders a date with appointments THEN the calendar SHALL preserve its appointment marker and expose the appointment count together with the availability label.
8. IF Agenda cannot load the active doctor's availability THEN the page SHALL show `Não foi possível carregar a disponibilidade do médico.` with a retry action instead of presenting missing data as authoritative availability.

**Independent Test**: Verify future dates have the same state in both calendars, New appointment rejects a past date, Agenda opens a past date with appointments, and Agenda disables a past date without appointments.

---

## Edge Cases

- IF the clinic time zone is invalid THEN both calendars SHALL render without throwing and preserve the endpoint's availability status.
- WHEN the active doctor or displayed Agenda month changes THEN the frontend SHALL request availability for the new doctor-month combination.
- IF no doctor is active THEN Agenda SHALL keep dates unavailable and SHALL NOT request doctor availability.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CAL-01 | P1: Consistent calendar availability AC1 | Execute | Verified |
| CAL-02 | P1: Consistent calendar availability AC2 | Execute | Verified |
| CAL-11 | P1: Historical Agenda navigation AC3 | Execute | Verified |
| CAL-03 | P1: Consistent calendar availability AC4 | Execute | Verified |
| CAL-04 | P1: Consistent calendar availability AC5 | Execute | Verified |
| CAL-05 | P1: Consistent calendar availability AC6 | Execute | Verified |
| CAL-06 | P1: Consistent calendar availability AC7 | Execute | Verified |
| CAL-07 | P1: Consistent calendar availability AC8 | Execute | Verified |
| CAL-08 | Edge cases: invalid time zone | Execute | Verified |
| CAL-09 | Edge cases: doctor or month change | Execute | Verified |
| CAL-10 | Edge cases: no active doctor | Execute | Verified |

**Coverage:** 11 total, 11 mapped to implicit execution steps, 0 unmapped.

---

## Success Criteria

- [x] Agenda and New appointment classify the same non-past availability fixtures identically.
- [x] Agenda requests one inclusive monthly availability range per active doctor-month.
- [x] Frontend unit tests, lint, and production build pass without skipped tests.
- [x] Agenda opens a past date with appointments, disables an empty past date, and New appointment keeps every past date disabled.

## Implicit-Requirement Dimensions

- **State-transition integrity**: covered by doctor/month query-key and range acceptance criteria.
- **Failure states**: covered by the retryable availability error acceptance criterion.
- **Remaining dimensions**: N/A for this read-only frontend alignment; persistence, external writes, auth changes, payments, concurrency, lifecycle, and new observability are outside scope.
