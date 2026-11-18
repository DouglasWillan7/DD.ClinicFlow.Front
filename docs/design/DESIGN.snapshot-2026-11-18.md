---
name: ClinicFlow
description: Operação clínica clara, leve e confiável.
colors:
  primary: "#3B5BFE"
  primary-soft: "#DBE3FF"
  primary-subtle: "#EEF2FF"
  ink: "#16283A"
  text-body: "#33475B"
  text-muted: "#657685"
  text-disabled: "#93A3B0"
  danger: "#E8404A"
  danger-text: "#C92F3A"
  success: "#2F9E57"
  success-text: "#237A45"
  app-background: "#EEF1F6"
  surface: "#FFFFFF"
  border-hairline: "#ECEEEF"
typography:
  display:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  control: "16px"
  annotation: "18px"
  panel: "24px"
  rail: "28px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  7: "32px"
  8: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
    height: "52px"
  navigation-active:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    size: "48px"
  status-alert:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  status-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  surface-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px 28px"
---

# Design System: ClinicFlow

## Overview

**Creative North Star: "O Painel Clínico em Fluxo"**

ClinicFlow deve parecer a superfície de trabalho de uma clínica bem coordenada sob a luz clara de um consultório: leve para permanecer aberta o dia inteiro, precisa ao mostrar horários e estados e humana ao falar de pacientes. O fundo cinza-azulado cria o campo de trabalho; superfícies brancas, tipografia escura e azul royal conduzem a ação sem ruído ornamental.

A linguagem visual oficial deriva de `Docs/Front Docs/new_design/PatientDashboard.jsx`: rail lateral compacto, topbar funcional, painéis brancos generosos e hierarquia tipográfica direta. `Dashboard.jsx` e qualquer composição teal com glassmorphism são referências legadas e não devem orientar novas telas.

No desktop amplo (`>=1280px`), o shell usa menu lateral de 72px (264px expandido), topbar e conteúdo que pode ocupar duas colunas quando a tarefa se beneficiar de contexto simultâneo. Entre 960px e 1279px, painéis secundários podem ser empilhados. Abaixo de 960px, o menu vira drawer; abaixo de 640px, a leitura é de uma coluna. Nenhuma página exige largura mínima de 1560px ou rolagem horizontal, exceto tabelas que tenham alternativa acessível.

**Key Characteristics:**

- Azul royal raro e funcional sobre neutros clínicos frios.
- Rail compacto e topbar orientados à navegação e à busca real.
- Painéis brancos com agrupamento semântico, nunca grids decorativos.
- Densidade confortável, com corpo de 16px e alvos mínimos de 44px.
- Estados reconhecíveis por texto, ícone e cor.
- Complexidade progressiva conforme tarefa, papel e viewport.

**The Product Before Prototype Rule.** Protótipos definem aparência e composição; `PRODUCT.md` e os contratos da API definem funcionalidades e dados. Anatomia, diagnósticos, gauges, vitais ou gráficos só aparecem quando existirem no domínio real.

## Colors

A paleta é restrita. Azul royal orienta ação e seleção; vermelho e verde carregam apenas significado semântico; fundos e superfícies permanecem frios e neutros.

### Primary

- **Azul de Ação** (`primary`): ação primária, foco, navegação ativa, seleção e série de dados principal.
- **Névoa Azul** (`primary-soft` / `primary-subtle`): avatar sem foto, item ativo, seleção suave e fundo de informação.

### Secondary

- **Vermelho de Alerta** (`danger` / `danger-text`): `danger` marca séries e superfícies; `danger-text` comunica erro, conflito ou atenção em texto com contraste AA.
- **Verde Verificado** (`success` / `success-text`): `success` marca visualizações; `success-text` comunica conclusão ou valor verificado em texto com contraste AA.

### Neutral

- **Tinta Clínica** (`ink`): títulos, nomes e dados principais.
- **Texto Operacional** (`text-body`): conteúdo recorrente e descrições.
- **Texto de Apoio** (`text-muted`): metadados e informações secundárias; a referência foi ajustada para a variante acessível usada em produção.
- **Texto Indisponível** (`text-disabled`): somente conteúdo realmente desabilitado; não usar em placeholder essencial.
- **Campo Clínico** (`app-background`): fundo contínuo do aplicativo.
- **Superfície** (`surface`): painéis, campos, topbar e controles elevados.
- **Hairline** (`border-hairline`): separação estrutural derivada da Tinta Clínica em baixa opacidade.

**The Semantic Color Rule.** Azul, vermelho e verde nunca substituem texto nem aparecem para enfeitar uma tela.

**The Contrast Rule.** Texto comum deve atingir 4.5:1 e texto grande, 3:1. Se `text-muted` não passar no fundo usado, a cor sobe para `text-body`.

## Typography

**Display Font:** Instrument Sans (com Helvetica Neue, Arial e `sans-serif` como fallback)  
**Body Font:** Instrument Sans (com Helvetica Neue, Arial e `sans-serif` como fallback)  
**Label Font:** Instrument Sans (com Helvetica Neue, Arial e `sans-serif` como fallback)

**Character:** uma única sans humanista sustenta títulos, controles e dados sem separar a interface em vozes artificiais. Pesos entre 400 e 700 criam hierarquia; números que precisam alinhar usam algarismos tabulares da própria família.

### Hierarchy

- **Display** (600, 32px, 1.2): título único da tela; nunca usado dentro de cards.
- **Headline** (600, 26px, 1.25): nome de paciente ou entidade no contexto principal.
- **Title** (600, 20px, 1.3): título de painel e agrupamento de conteúdo.
- **Body** (400, 16px, 1.5): conteúdo operacional, navegação e formulários; prosa limitada a 65–75 caracteres por linha.
- **Label** (600, 14px, 1.4): botões, rótulos persistentes, filtros e estados.
- **Caption** (400, 13px, 1.4): datas e metadados. O piso absoluto é 12px.

**The One Clinical Voice Rule.** Não misturar Plus Jakarta Sans, IBM Plex Mono ou fontes de exibição com Instrument Sans nas telas migradas.

**The Data Alignment Rule.** Horas, medidas e resultados usam `font-variant-numeric: tabular-nums`; uma fonte mono não é necessária.

## Elevation

ClinicFlow usa elevação ambiente sobre um único fundo de aplicativo. Painéis comuns são brancos e recebem sombra curta, difusa e de baixa opacidade; elementos temporários podem elevar um nível. Bordas aparecem para estrutura e foco, não como decoração adicional à sombra.

### Shadow Vocabulary

- **Card** (`0 6px 18px rgba(23,63,84,.08)`): painéis, busca, chip do usuário e controles circulares.
- **Floating** (`0 12px 32px rgba(23,63,84,.10)`): popovers, tooltips e anotações sobre imagens ou gráficos.
- **Overlay** (`0 16px 40px rgba(23,63,84,.16)`): menus e painéis temporários acima do shell; nunca em cards comuns.

**The One Elevation Cue Rule.** Um elemento em repouso usa sombra ou borda estrutural. Nunca combinar hairline com sombra larga para fabricar profundidade.

**The No Glass Rule.** Não usar `backdrop-filter`, painéis translúcidos ou gradiente teal do protótipo legado.

## Components

### Application Shell

- **Desktop:** grid `auto 1fr` com padding de 24px e gap estrutural de 20px; topbar e conteúdo fluidos, sem `min-width` de protótipo.
- **Menu lateral:** painel branco único de altura total, raio de 28px, padding de 18px/12px e sombra Card. Recolhido tem 72px (só ícones) e expande para 264px no hover em 200ms; a expansão empurra o conteúdo e nunca o sobrepõe. Logo circular de 48px, wordmark em caixa alta com `letter-spacing` de 0.04em e alfinete de 32px que fixa a versão expandida por usuário.
- **Destinos:** pill de 48px com raio total, padding de 0 14px, gap de 14px entre ícone e rótulo, ícone outline de 20px com traço de 1.7px e 8px entre itens. O ativo usa `primary-subtle` com ícone e rótulo em Azul de Ação (600). "Sair" fica ancorado no rodapé do painel, no mesmo padrão de item inativo.
- **Sem tooltip:** o rótulo aparece na expansão; o menu não depende de tooltip para identificar destinos.
- **Topbar:** busca contextual, ações globais reais e chip do usuário. Busca não deve ocupar espaço se o backend ainda não oferecer o recurso.
- **Responsive:** abaixo de 960px o menu vira drawer sobreposto com rótulos sempre visíveis e sem alfinete; conteúdo de uma coluna abaixo de 640px; ordem de leitura e foco acompanha a ordem visual.

### Buttons

- **Shape:** 16px, altura mínima de 44px; círculo apenas para ações representadas por um ícone inequívoco.
- **Primary:** Azul de Ação, texto branco e um único destaque por região decisória.
- **Secondary:** Superfície, Tinta Clínica e hairline estrutural; sem sombra em repouso.
- **Hover / Active:** escurecer ou clarear em até 4%; `active` pode usar `scale(.98)` sem deslocar layout.
- **Focus / Loading / Disabled:** anel de 2px, rótulo estável durante carregamento e motivo da indisponibilidade quando necessário.

### Inputs and Search

- **Fields:** altura mínima de 44px, raio de 16px, rótulo persistente e mensagem junto ao campo.
- **Search:** pill de 52px somente quando a busca for uma ação global ou dominante.
- **Focus:** borda Azul de Ação e anel externo visível.
- **Placeholder:** exemplo de formato, nunca substituto do rótulo; deve manter contraste legível.

### Cards and Containers

- **Primary panel:** Superfície, raio de 24px, padding de 24–28px e sombra Card.
- **Inner group:** fundo `app-background`, raio de 16px e sem sombra.
- **Annotation:** raio de 18px e sombra Floating quando estiver conectada a uma imagem ou visualização.
- **Composition:** cards agrupam uma unidade de informação ou decisão; cards aninhados e grids intercambiáveis são proibidos.

### Navigation, Breadcrumbs and User Context

- O destino ativo combina `primary-subtle`, ícone e Azul de Ação; nenhum estado depende apenas de cor.
- Breadcrumbs usam botão de voltar de 40–44px, links reais e último item como texto atual.
- O chip do usuário pode ser pill, com avatar de 44–46px, nome e papel. Em mobile, reduz a um botão acessível sem truncar informação essencial.
- Itens não autorizados não são renderizados; o backend continua responsável pela autorização.

### Status and Data Visualization

- Estados sempre combinam rótulo, ícone e cor. Vermelho significa atenção/erro; verde significa verificação explícita.
- Gráficos usam séries reais, título, último valor, unidade, legenda acessível e alternativa textual. O padrão pontilhado é permitido apenas dentro da área de plotagem.
- Anotações corporais ou clínicas só existem em uma feature suportada pela API e precisam funcionar por teclado/toque, não apenas por hover.
- Skeletons preservam o contorno da região carregada; estados vazios ensinam a próxima ação e erros preservam o trabalho do usuário.

### Motion

- Hover, foco e seleção: 150–160ms com curva ease-out exponencial.
- Abertura de painel ou mudança contextual: até 200ms.
- Não animar layout sem necessidade, não criar coreografia de entrada e sempre respeitar `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** começar pela tarefa real do papel atual e manter ações frequentes próximas do contexto.
- **Do** usar o tema Painel Clínico: fundo `app-background`, superfícies brancas, Azul de Ação e Instrument Sans.
- **Do** adaptar o protótipo aos breakpoints de 640px, 960px e 1280px sem perder ordem semântica.
- **Do** manter alvos mínimos de 44px, foco visível e estados completos: default, hover, focus, active, disabled, loading e error.
- **Do** usar skeletons por região, vazios instrutivos e erros recuperáveis.
- **Do** validar a tela com conteúdo longo em PT-BR e dados plausíveis sem PII.
- **Do** exibir somente dados e ações suportados pelo backend e pelo papel atual.

### Don't:

- **Don't** usar o tema teal, gradientes de página, transparência ou glassmorphism de `Dashboard.jsx`.
- **Don't** copiar a largura mínima de 1560px ou depender de rolagem horizontal para a página.
- **Don't** fazer o ClinicFlow parecer um template administrativo genérico.
- **Don't** criar um dashboard SaaS decorativo com métricas fictícias ou grids de cards intercambiáveis.
- **Don't** reproduzir a sobrecarga de controles de um sistema hospitalar corporativo.
- **Don't** importar diagnósticos, vitais, gauges, anatomia ou gráficos do protótipo sem domínio e API correspondentes.
- **Don't** usar texto menor que 12px, depender de placeholder ou comunicar estado apenas por cor.
- **Don't** criar cards aninhados, faixas laterais coloridas, sombras pesadas ou componentes acima de 24px de raio, exceto rail e pills documentados.
- **Don't** abrir modal como primeira solução quando detalhe contextual, drawer ou edição inline preservarem melhor o fluxo.
- **Don't** usar animação decorativa, bounce, confete ou coreografia de carregamento.
