# Consulta Rápida Specification

## Problem Statement

A recepção precisa encaixar um atendimento no primeiro horário livre do médico sem percorrer calendário e grade de horários. O fluxo atual exige essas escolhas mesmo quando a intenção é aceitar o próximo slot disponível.

## Goals

- [x] Oferecer `Consulta rápida` dentro da ação `Nova consulta` da Agenda.
- [x] Escolher automaticamente o primeiro slot livre futuro do médico selecionado.
- [x] Criar a consulta pelo contrato de agendamento existente, sem novo estado ou tipo no backend.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Atendimento fora da grade configurada | A consulta rápida respeita agenda, bloqueios, duração e conflitos existentes. |
| Criação sem paciente ou sem confirmação | Identidade do paciente e confirmação explícita preservam segurança operacional. |
| Novo status ou tipo de consulta no backend | `Rápida` descreve o fluxo de criação, não a natureza clínica da consulta. |
| Busca sem limite temporal | A API aceita períodos de até 62 dias inclusivos. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Significado de consulta instantânea | Eliminar a escolha manual de data e horário; paciente, tipo e confirmação permanecem obrigatórios | Evita criação acidental e mantém os invariantes do agendamento atual. | yes, inferred from request |
| Tipo inicial | `Presencial`, com opção de trocar para teleconsulta | É o menor fluxo para recepção e continua reversível antes da confirmação. | yes, agent default |
| Horizonte da busca | Data atual da clínica mais 61 dias, total de 62 dias inclusivos | Usa o maior período já aceito pelo contrato de disponibilidade. | yes, agent default |
| Médico | Usar o médico ativo na Agenda e recalcular se ele for trocado no formulário | O pedido exige o médico selecionado e o formulário atual já permite correção. | yes, inferred from request |
| Concorrência | Manter a resposta `409` e recarregar a disponibilidade quando o slot for ocupado durante a confirmação | O backend e o banco já protegem os conflitos; o formulário existente preserva uma recuperação segura. | yes, existing invariant |
| Dimensões restantes | N/A para este escopo | Não há novo dado persistido, pagamento, integração externa ou ciclo de vida próprio. | yes, bounded scope |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Criar no próximo horário livre ⭐ MVP

**User Story**: As a secretária ou médica, I want iniciar uma consulta rápida para o médico ativo so that eu não precise escolher data e horário quando o próximo slot serve.

**Why P1**: Esse é o ganho operacional completo pedido para a Agenda.

**Acceptance Criteria**:

1. WHEN the user activates `Nova consulta` THEN the system SHALL display `Agendar consulta` and `Consulta rápida` as distinct actions.
2. WHEN the user activates `Agendar consulta` THEN the system SHALL open the existing scheduling flow with the active date and doctor unchanged.
3. WHEN the user activates `Consulta rápida` for an active doctor THEN the system SHALL open the scheduling flow with `mode=quick`, the active date, and the active doctor in the URL.
4. WHILE no active doctor exists the system SHALL keep `Consulta rápida` disabled and identify that a doctor must be selected.
5. WHEN quick mode loads a doctor THEN the system SHALL request availability from the clinic's current local date through the following 61 days inclusively.
6. WHEN quick availability contains slots THEN the system SHALL select the slot with the earliest `startUtc` across the complete response.
7. WHEN quick mode starts without a saved type THEN the system SHALL select `Presencial` and SHALL allow the user to change it before confirmation.
8. WHEN the quick-mode doctor changes THEN the system SHALL discard the previous slot and select the earliest slot returned for the new doctor.
9. WHEN the user confirms a complete quick appointment THEN the system SHALL send the existing appointment payload with the selected patient, doctor, type, and automatically selected `startUtc`.
10. WHEN a quick appointment is created THEN the system SHALL return to the originating agenda date for the created appointment and SHALL show the existing success feedback.
11. IF the 62-day availability response has no slots THEN the system SHALL state `Nenhum horário livre nos próximos 62 dias.` and SHALL keep confirmation disabled.
12. IF quick availability cannot be loaded THEN the system SHALL show `Não foi possível buscar o próximo horário livre.` and SHALL offer a retry action.
13. IF appointment creation returns a conflict THEN the system SHALL show the backend conflict message and SHALL refresh quick availability without leaving quick mode.
14. WHILE the action menu is open the system SHALL expose its expanded state to assistive technology and SHALL close it on `Escape` with focus returned to `Nova consulta`.

**Independent Test**: Na Agenda de um médico, abrir `Nova consulta`, escolher `Consulta rápida`, selecionar um paciente e confirmar. A consulta deve usar o primeiro `startUtc` retornado, sem interação com calendário ou grade.

## Edge Cases

- IF the availability days arrive outside chronological order THEN the system SHALL still choose the lowest `startUtc`.
- WHEN the user creates a patient from quick mode and returns THEN the system SHALL preserve quick mode, doctor, type, and automatic slot resolution.
- IF a doctor has no slots in the 62-day window THEN the system SHALL not fall back to a time outside the configured schedule.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| QRAP-01 | P1: Action menu | Execute | Verified |
| QRAP-02 | P1: Standard scheduling remains available | Execute | Verified |
| QRAP-03 | P1: Quick route context | Execute | Verified |
| QRAP-04 | P1: Missing doctor | Execute | Verified |
| QRAP-05 | P1: Availability window | Execute | Verified |
| QRAP-06 | P1: Earliest slot | Execute | Verified |
| QRAP-07 | P1: Default and editable type | Execute | Verified |
| QRAP-08 | P1: Doctor recalculation | Execute | Verified |
| QRAP-09 | P1: Existing appointment payload | Execute | Verified |
| QRAP-10 | P1: Success destination | Execute | Verified |
| QRAP-11 | P1: No availability | Execute | Verified |
| QRAP-12 | P1: Availability failure | Execute | Verified |
| QRAP-13 | P1: Conflict recovery | Execute | Verified |
| QRAP-14 | P1: Accessible menu | Execute | Verified |
| QRAP-15 | Edge: Unordered response | Execute | Verified |
| QRAP-16 | Edge: Patient creation return | Execute | Verified |
| QRAP-17 | Edge: No off-schedule fallback | Execute | Verified |

**Coverage:** 17 total, 17 verified, 0 pending.

## Success Criteria

- [x] A consulta rápida pode ser concluída sem escolher data ou horário.
- [x] O `startUtc` enviado é o menor slot livre retornado no período de 62 dias.
- [x] O agendamento comum continua acessível pela mesma ação da Agenda.
- [x] Estados sem médico, sem disponibilidade, erro e conflito permanecem recuperáveis por teclado e mouse.
