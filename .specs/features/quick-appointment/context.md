# Consulta Rápida Context

**Gathered:** 2026-08-23
**Spec:** `.specs/features/quick-appointment/spec.md`
**Status:** Ready for design

---

## Feature Boundary

A ação `Nova consulta` passa a oferecer o agendamento completo e uma consulta rápida. A consulta rápida usa o médico ativo, resolve o primeiro slot livre em até 62 dias e cria uma consulta comum após paciente, tipo e confirmação.

---

## Implementation Decisions

### Ação na Agenda

- `Nova consulta` abre um menu curto com duas ações nomeadas.
- `Agendar consulta` preserva o comportamento atual.
- `Consulta rápida` leva o médico e a data ativos para o mesmo formulário em `mode=quick`.

### Resolução de horário

- O período começa na data atual do fuso da clínica e termina 61 dias depois.
- O menor `startUtc` de toda a resposta vence, mesmo quando os dias chegam fora de ordem.
- Trocar o médico invalida o slot anterior e resolve outro automaticamente.

### Confirmação

- Paciente e confirmação explícita continuam obrigatórios.
- `Presencial` começa selecionado e pode ser trocado.
- O POST e o tratamento de conflito existentes permanecem a fonte de verdade.

### Agent's Discretion

- Microcopy auxiliar e composição exata do menu, dentro de `DESIGN.md`.
- Uso dos cards e feedbacks existentes no formulário para evitar um segundo fluxo visual.

### Declined / Undiscussed Gray Areas → Assumptions

- A busca não ultrapassa 62 dias e não cria encaixe fora da grade.
- `Rápida` não é persistida como tipo ou status.

---

## Specific References

- `PRODUCT.md`: priorizar a próxima tarefa operacional da secretária.
- `DESIGN.md`: azul funcional, superfícies brancas, foco visível e alvos de 44px.
- `src/features/appointments/AgendaPage.tsx`: médico e data ativos.
- `src/features/appointments/NewAppointmentPage.tsx`: seleção, disponibilidade, criação e recuperação de conflito existentes.

---

## Deferred Ideas

- Reserva transacional que pula automaticamente para o slot seguinte em uma corrida concorrente. O banco já evita dupla marcação e o fluxo atual recupera o conflito; mudar a semântica do backend é uma feature separada.
