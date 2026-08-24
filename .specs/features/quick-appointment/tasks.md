# Consulta Rápida Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/quick-appointment/design.md`
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: repository `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `package.json`, `vite.config.ts`, `playwright.config.ts`, and `.github/workflows/deploy.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Agenda interaction | unit | Menu actions, missing doctor, expanded state, Escape and route parameters | `src/features/appointments/*.test.tsx` | `npm test -- AgendaPage.test.tsx` |
| Quick selection logic | unit | All quick-mode branches and edge cases map to QRAP-05 through QRAP-17 | `src/features/appointments/*.test.tsx` | `npm test -- NewAppointmentPage.test.tsx` |
| Critical scheduling flow | e2e | Happy path from Agenda through created appointment plus keyboard menu behavior | `e2e/agenda.spec.ts` | `npm run test:e2e -- agenda.spec.ts` |
| CSS presentation | none | Build, lint and focused browser assertions only | `src/features/appointments/*.module.css` | build gate only |

## Gate Check Commands

> Generated from the repository scripts and CI workflow.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After unit-tested interaction or state changes | `npm test -- AgendaPage.test.tsx NewAppointmentPage.test.tsx` |
| Full | After the critical browser flow | `npm test -- AgendaPage.test.tsx NewAppointmentPage.test.tsx && npm run test:e2e -- agenda.spec.ts` |
| Build | After phase completion | `npm run lint && npm run build && npm test && npm run test:e2e -- agenda.spec.ts` |

---

## Execution Plan

### Phase 1: Agenda action

```
T1 → T2
```

### Phase 2: Quick scheduling

```
T2 → T3 → T4
```

## Task Breakdown

### T1: Style the appointment action menu

**What**: Add the responsive, focus-visible menu presentation beside the Agenda action.
**Where**: `src/features/appointments/AgendaPage.module.css`
**Depends on**: None
**Reuses**: `--radius-control`, `--shadow-overlay`, z-index and transition tokens.
**Requirement**: QRAP-01, QRAP-04, QRAP-14

**Tools**:

- MCP: NONE
- Skill: `impeccable`

**Done when**:

- [x] Trigger and menu items keep 44px targets and visible focus.
- [x] Menu fits narrow screens without horizontal overflow.
- [x] Reduced motion disables menu transitions.
- [x] Build gate passes with no lint, type or test regression.

**Tests**: none
**Gate**: build

### T2: Add the two-path Agenda action

**What**: Turn `Nova consulta` into an accessible menu for standard and quick scheduling.
**Where**: `src/features/appointments/AgendaPage.tsx`
**Depends on**: T1
**Reuses**: active doctor/date context, `bookSlot`, navigation and existing unit harness.
**Requirement**: QRAP-01, QRAP-02, QRAP-03, QRAP-04, QRAP-14

**Tools**:

- MCP: NONE
- Skill: `impeccable`

**Done when**:

- [ ] The trigger exposes expanded state and the menu has two named actions.
- [ ] Standard action preserves the existing URL.
- [ ] Quick action includes `mode=quick`, active date, doctor and origin when applicable.
- [ ] Missing doctor disables quick action with an explicit reason.
- [ ] Escape closes the menu and restores trigger focus.
- [ ] Unit gate passes with all menu paths asserted.

**Tests**: unit in `src/features/appointments/AgendaPage.test.tsx`
**Gate**: quick

### T3: Resolve the next free slot in quick mode

**What**: Extend the existing scheduling page with a 62-day quick mode and automatic earliest-slot selection.
**Where**: `src/features/appointments/NewAppointmentPage.tsx`
**Depends on**: T2
**Reuses**: selection reducer, availability query, patient creation draft, summary, POST mutation and conflict recovery.
**Requirement**: QRAP-05, QRAP-06, QRAP-07, QRAP-08, QRAP-09, QRAP-10, QRAP-11, QRAP-12, QRAP-13, QRAP-15, QRAP-16, QRAP-17

**Tools**:

- MCP: NONE
- Skill: `impeccable`

**Done when**:

- [ ] Query spans the clinic-local current day plus 61 days.
- [ ] Lowest `startUtc` is selected across unordered days and recalculated per doctor.
- [ ] Presential starts selected and remains editable.
- [ ] Calendar and manual slot grid are replaced by a clear next-slot state.
- [ ] Empty, error, retry and conflict states preserve the quick flow.
- [ ] Patient creation return preserves `mode=quick`.
- [ ] Unit gate passes with each quick branch asserted.

**Tests**: unit in `src/features/appointments/NewAppointmentPage.test.tsx`
**Gate**: quick

### T4: Cover the critical quick appointment journey

**What**: Add a browser test from the Agenda menu through successful quick creation.
**Where**: `e2e/agenda.spec.ts`
**Depends on**: T3
**Reuses**: existing mocked ClinicFlow routes and appointment store.
**Requirement**: QRAP-01, QRAP-03, QRAP-05, QRAP-06, QRAP-09, QRAP-10, QRAP-14

**Tools**:

- MCP: Playwright CLI
- Skill: `impeccable`

**Done when**:

- [ ] Browser flow chooses quick mode without touching calendar or slot controls.
- [ ] Created payload contains the earliest slot and selected patient/type/doctor.
- [ ] Success navigation identifies the created appointment and its date.
- [ ] Keyboard opens and dismisses the action menu with focus restored.
- [ ] Full build gate passes with no skipped or deleted tests.

**Tests**: e2e in `e2e/agenda.spec.ts`
**Gate**: build

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1: T1 → T2
Phase 2: T3 → T4
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | One CSS module | ✅ Granular |
| T2 | One page interaction | ✅ Granular |
| T3 | One page mode | ✅ Granular |
| T4 | One E2E journey | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | Phase 1 → Phase 2 and T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | CSS presentation | none | none | ✅ OK |
| T2 | Agenda interaction | unit | unit | ✅ OK |
| T3 | Quick selection logic | unit | unit | ✅ OK |
| T4 | Critical scheduling flow | e2e | e2e | ✅ OK |
