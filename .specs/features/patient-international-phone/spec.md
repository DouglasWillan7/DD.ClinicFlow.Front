# Telefone internacional do paciente Specification

## Problem Statement

O cadastro exige que a equipe digite manualmente DDI, DDD e telefone sem formatação. Isso aumenta erros e não atende pacientes com números de outros países de forma clara.

## Goals

- [ ] Permitir selecionar o país por bandeira, nome e DDI.
- [ ] Formatar o número durante a digitação e enviar o valor internacional em E.164.
- [ ] Manter o mesmo comportamento no cadastro e na edição do paciente.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Persistir o país em coluna separada | O país pode ser derivado do telefone E.164 existente. |
| Alterar API ou banco | O contrato atual já aceita E.164 com 10 a 15 dígitos. |
| Validar se o número possui WhatsApp | Isso exigiria uma integração externa fora deste fluxo. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| País inicial em um cadastro vazio | Brasil (`BR`, `+55`) | O produto está em português do Brasil e opera inicialmente no Brasil. | n |
| Abrangência do seletor | Todos os países suportados pelo catálogo de numeração | Corresponde ao padrão esperado de um seletor de DDI e evita uma lista arbitrária. | n |
| Validação | Número possível para o plano do país selecionado | Evita rejeitar faixas recém-criadas por validação excessivamente estrita. | n |
| Troca de país após digitação | Preservar os dígitos nacionais | Impede perda silenciosa de dados e permite corrigir apenas o DDI. | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Informar telefone internacional ⭐ MVP

**User Story**: Como integrante da clínica, quero selecionar o país e digitar o telefone na forma familiar ao paciente para reduzir erros de cadastro.

**Why P1**: O telefone é obrigatório e utilizado nas confirmações de consulta pelo WhatsApp.

**Acceptance Criteria**:

1. WHILE o campo de telefone estiver vazio THEN o sistema SHALL selecionar Brasil e exibir a bandeira brasileira com o DDI `+55`.
2. WHEN a pessoa abrir o seletor de país THEN o sistema SHALL oferecer os países suportados com nome em português, bandeira e DDI.
3. WHEN a pessoa digitar os dígitos nacionais THEN o sistema SHALL aplicar progressivamente a máscara do país selecionado.
4. WHEN a pessoa trocar o país THEN o sistema SHALL preservar os dígitos nacionais e recalcular a máscara e o valor internacional.
5. WHEN um paciente com telefone E.164 for editado THEN o sistema SHALL selecionar o país correspondente e mostrar o número na máscara nacional.
6. WHEN um telefone possível for submetido THEN o sistema SHALL enviar o campo `phone` com `+`, DDI e número sem separadores.
7. IF o telefone estiver incompleto ou impossível para o plano selecionado THEN o sistema SHALL manter o formulário na etapa atual e mostrar `Informe um WhatsApp válido para o país selecionado.`.
8. WHILE o campo estiver visível em 390 px ou 1440 px THEN o sistema SHALL manter seletor e entrada sem rolagem horizontal e com alvos interativos de pelo menos 44 por 44 pixels.

**Independent Test**: Selecionar Portugal, digitar `912345678`, confirmar a máscara `912 345 678` e observar o envio de `+351912345678`.

---

## Edge Cases

- WHEN um telefone internacional completo for colado THEN o sistema SHALL detectar seu país e aplicar a máscara nacional correspondente.
- WHEN um telefone legado sem `+` começar por um DDI reconhecido THEN o sistema SHALL interpretá-lo como internacional na edição.
- IF o campo for apagado THEN o sistema SHALL manter o país selecionado e enviar valor vazio para a validação obrigatória.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PHONE-01 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-02 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-03 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-04 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-05 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-06 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-07 | P1: Informar telefone internacional | Execute | Verified |
| PHONE-08 | P1: Informar telefone internacional | Execute | Verified |

**Coverage:** 8 total, 8 mapped to the implicit execution plan, 0 unmapped.

---

## Success Criteria

- [ ] Cadastro e edição aceitam números brasileiros e internacionais sem digitação manual do DDI.
- [ ] A API recebe somente o telefone normalizado em E.164.
- [ ] Os fluxos permanecem acessíveis e responsivos nos viewports suportados.
