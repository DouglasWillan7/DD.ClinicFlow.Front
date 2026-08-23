# Cadastro de paciente em etapas

## Problem Statement

O cadastro atual apresenta todos os dados de uma vez e não segue a composição aprovada no handoff de cadastro. A secretária precisa registrar um paciente com rapidez, entender o que é obrigatório e concluir o fluxo sem perder o que já digitou.

## Goals

- [ ] Organizar o cadastro em três etapas curtas, com progresso e validação contextual.
- [ ] Preservar o contrato atual de criação de paciente e os retornos para Pacientes ou Novo agendamento.
- [ ] Entregar uma composição responsiva e acessível alinhada ao tema Painel Clínico.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar o contrato da API de pacientes | O domínio e o payload existentes já suportam o cadastro solicitado. |
| Transformar a edição em wizard | A solicitação cobre somente o cadastro de um novo paciente. |
| Persistir rascunho após recarregar | Não existe requisito ou infraestrutura de rascunho para pacientes. |
| Criar ou editar médicos durante o fluxo | O pré-requisito de médico ativo já possui uma jornada própria. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Relação entre o handoff e os campos do paciente | Reutilizar composição, hierarquia e estados do handoff com os campos reais de paciente. | O handoff é de criação de conta, enquanto o pedido e a rota existentes são de paciente. | yes, explicit user request plus handoff |
| Organização das etapas | Identificação, Dados clínicos e Atendimento. | A ordem começa pelos dados obrigatórios mais frequentes e revela os opcionais progressivamente. | assumed from product workflow |
| Persistência entre etapas | Preservar valores ao avançar e voltar durante a sessão atual. | É o comportamento esperado do handoff sem ampliar o escopo para armazenamento de rascunho. | assumed |
| Demais dimensões implícitas | Permanecem N/A neste escopo. | Autorização, concorrência, ciclo de vida, observabilidade e dependências externas não mudam. | assumed |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Cadastrar um paciente com orientação progressiva ⭐ MVP

**User Story**: Como secretária, quero cadastrar um paciente em etapas curtas para concluir os dados essenciais com segurança e sem perder o que já digitei.

**Why P1**: O cadastro é uma ação operacional frequente e alimenta pacientes e agendamentos.

**Acceptance Criteria**:

1. `PATREG-01` WHEN a rota de novo paciente carregar com pelo menos um médico ativo THEN the interface SHALL mostrar as etapas “Identificação”, “Dados clínicos” e “Atendimento”, iniciando em “Identificação”.
2. `PATREG-02` IF nome, WhatsApp ou CPF estiver inválido ao continuar da primeira etapa THEN the interface SHALL permanecer em “Identificação” e mostrar a mensagem específica junto de cada campo inválido.
3. `PATREG-03` WHEN a primeira etapa válida avançar THEN the interface SHALL mostrar “Dados clínicos” e preservar nome, WhatsApp e CPF ao voltar.
4. `PATREG-04` WHEN “Dados clínicos” avançar THEN the interface SHALL aceitar data de nascimento, tipo sanguíneo e sexo laboratorial como opcionais e preservar suas seleções ao voltar.
5. `PATREG-05` IF nenhum médico ativo estiver disponível THEN the interface SHALL substituir o wizard pela orientação existente para adicionar um médico.
6. `PATREG-06` IF o médico responsável não estiver selecionado ao salvar THEN the interface SHALL permanecer em “Atendimento” e mostrar “Selecione o médico responsável.” junto do campo.
7. `PATREG-07` WHILE a criação estiver pendente the interface SHALL desabilitar a ação final, ocultar a ação de voltar e mostrar “Salvando paciente…”.
8. `PATREG-08` IF a API recusar o cadastro THEN the interface SHALL mostrar a mensagem retornada em uma faixa de erro e preservar todos os valores do formulário.
9. `PATREG-09` WHEN a API criar o paciente THEN the application SHALL preservar o retorno seguro existente, incluindo `patientId` ao voltar para `/app/agenda/nova`.
10. `PATREG-10` The interface SHALL manter rótulos associados, foco visível, estado atual anunciado, alvos de no mínimo 44px e nenhuma rolagem horizontal em viewports de 390px e 1440px.

**Independent Test**: Abrir `/app/pacientes/novo`, completar as três etapas, voltar para conferir os valores, avançar novamente e salvar o paciente observando o payload e o destino final.

---

## Edge Cases

- IF o cadastro for aberto com `?nome=` THEN the interface SHALL preencher o nome sugerido na primeira etapa sem ultrapassar 120 caracteres.
- IF o retorno informado for externo ou não permitido THEN the application SHALL usar `/app/pacientes` ao cancelar ou concluir.
- IF o conteúdo em português ocupar a largura mínima THEN the interface SHALL esconder apenas os rótulos visuais do stepper, mantendo os nomes disponíveis para tecnologia assistiva.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PATREG-01 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-02 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-03 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-04 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-05 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-06 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-07 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-08 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-09 | P1: Cadastro progressivo | Execute | Implementing |
| PATREG-10 | P1: Cadastro progressivo | Execute | Implementing |

**Coverage:** 10 total, 10 mapped to the implicit execution plan, 0 unmapped.

---

## Success Criteria

- [ ] O fluxo completo envia o mesmo payload aceito hoje pela API.
- [ ] Os testes unitários, de página e Playwright cobrem avanço, volta, validação, pendência, erro e retorno.
- [ ] Lint, build, Vitest e os testes Playwright de pacientes passam sem skips.
- [ ] A inspeção visual em 390px e 1440px não encontra overflow, clipping ou perda de hierarquia.
