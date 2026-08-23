# Unified Appointment Calendars Specification

## Problem Statement

The new-appointment calendar uses the doctor's authoritative monthly availability to classify and enable dates. The Agenda month calendar only counts appointments, so it allows dates that the booking flow rejects and can display a different calendar state for the same doctor and month.

## Goals

- [ ] Make Agenda and New appointment use one availability policy for calendar dates.
- [ ] Keep Agenda's appointment-count context without overriding availability state.
- [ ] Load the active doctor's availability for the full displayed Agenda month.

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
| Meaning of "same behavior" | Agenda disables past, blocked, full, no-schedule, missing, and slotless dates exactly as New appointment does. | The user explicitly requested the New appointment behavior as the reference. | y |
| Agenda appointment counts | Preserve the existing marker and accessible count as secondary context. | Counts remain useful and do not replace the authoritative availability state. | y |
| Invalid clinic time zone | Preserve the current fallback: availability remains authoritative and no local-past classification is added. | This matches New appointment and avoids crashing the calendar. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Consistent calendar availability

**User Story**: As a clinic professional, I want Agenda and New appointment to show the same date availability so that a date never appears selectable in one calendar and invalid in the other.

**Why P1**: Divergent calendars create invalid scheduling attempts and erode trust in the agenda.

**Acceptance Criteria**:

1. The frontend SHALL derive date selectability and availability labels in Agenda and New appointment from one shared calendar policy.
2. IF a date is earlier than today in the clinic time zone THEN both calendars SHALL disable it and label it `data passada`.
3. IF a date is `Blocked`, `Full`, `NoSchedule`, missing from availability, or `Available` with zero slots THEN both calendars SHALL disable it and expose the corresponding Portuguese availability label.
4. WHEN a non-past date is `Available` with at least one slot THEN both calendars SHALL enable it.
5. WHEN Agenda displays a month for an active doctor THEN the frontend SHALL request that doctor's availability from the first through the last date of that month.
6. WHEN Agenda renders a date with appointments THEN the calendar SHALL preserve its appointment marker and expose the appointment count together with the availability label.
7. IF Agenda cannot load the active doctor's availability THEN the page SHALL show `Não foi possível carregar a disponibilidade do médico.` with a retry action instead of presenting missing data as authoritative availability.

**Independent Test**: Render both calendars with the same monthly availability and verify that every date has the same enabled state and availability label; verify Agenda also reports appointment counts.

---

## Edge Cases

- IF the clinic time zone is invalid THEN both calendars SHALL render without throwing and preserve the endpoint's availability status.
- WHEN the active doctor or displayed Agenda month changes THEN the frontend SHALL request availability for the new doctor-month combination.
- IF no doctor is active THEN Agenda SHALL keep dates unavailable and SHALL NOT request doctor availability.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CAL-01 | P1: Consistent calendar availability AC1 | Execute | Implementing |
| CAL-02 | P1: Consistent calendar availability AC2 | Execute | Implementing |
| CAL-03 | P1: Consistent calendar availability AC3 | Execute | Implementing |
| CAL-04 | P1: Consistent calendar availability AC4 | Execute | Implementing |
| CAL-05 | P1: Consistent calendar availability AC5 | Execute | Pending |
| CAL-06 | P1: Consistent calendar availability AC6 | Execute | Pending |
| CAL-07 | P1: Consistent calendar availability AC7 | Execute | Pending |
| CAL-08 | Edge cases: invalid time zone | Execute | Pending |
| CAL-09 | Edge cases: doctor or month change | Execute | Pending |
| CAL-10 | Edge cases: no active doctor | Execute | Pending |

**Coverage:** 10 total, 10 mapped to implicit execution steps, 0 unmapped.

---

## Success Criteria

- [ ] Agenda and New appointment classify the same availability fixtures identically.
- [ ] Agenda requests one inclusive monthly availability range per active doctor-month.
- [ ] Frontend unit tests, lint, and production build pass without skipped tests.

## Implicit-Requirement Dimensions

- **State-transition integrity**: covered by doctor/month query-key and range acceptance criteria.
- **Failure states**: covered by the retryable availability error acceptance criterion.
- **Remaining dimensions**: N/A for this read-only frontend alignment; persistence, external writes, auth changes, payments, concurrency, lifecycle, and new observability are outside scope.
