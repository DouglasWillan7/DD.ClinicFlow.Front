import type {
  PrescriptionTemplate,
  PrescriptionTemplateElement,
  PrescriptionTemplateLayout,
  TemplateElementKind,
  TemplateFontFamily,
  TemplateTextAlign,
  TemplateZone,
} from "../../../api/types";

/*
 * Modelo do receituário: medidas, limites e campos espelhados da API. Tela e PDF usam
 * as mesmas medidas em milímetros; a folha na tela só muda a escala (px por mm).
 */

export type TemplateElement = PrescriptionTemplateElement;
export type TemplateLayout = PrescriptionTemplateLayout;

/** Milímetros por ponto tipográfico. */
export const MM_PER_PT = 0.3528;
/** Entrelinha do texto, igual à do gerador de PDF. */
export const TEXT_LINE_HEIGHT = 1.25;
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

export const TEMPLATE_LIMITS = {
  elements: 30,
  textLength: 300,
  fontMinPt: 6,
  fontMaxPt: 36,
  thicknessMinPt: 0.25,
  thicknessMaxPt: 8,
  textMinWidthMm: 10,
  shapeMinWidthMm: 4,
  idLength: 40,
  imageBytes: 2 * 1024 * 1024,
} as const;

export const templateZones: readonly TemplateZone[] = ["Header", "Footer"];

export const zoneMaxHeightMm: Record<TemplateZone, number> = { Header: 80, Footer: 60 };
/** Altura com que a área nasce num receituário em branco. */
export const zoneDefaultHeightMm: Record<TemplateZone, number> = { Header: 30, Footer: 20 };

/* ---------- Margens do conteúdo (espelham PrescriptionTemplateRules na API) ---------- */

export type ContentMarginSide = "Left" | "Right" | "Top" | "Bottom";

export const contentMarginSides: readonly ContentMarginSide[] = ["Left", "Right", "Top", "Bottom"];

export const contentMarginLabels: Record<ContentMarginSide, string> = {
  Left: "Esquerda",
  Right: "Direita",
  Top: "Acima",
  Bottom: "Abaixo",
};

export const contentMarginLimitsMm: Record<ContentMarginSide, { min: number; max: number }> = {
  Left: { min: 5, max: 60 },
  Right: { min: 5, max: 60 },
  Top: { min: 0, max: 50 },
  Bottom: { min: 0, max: 50 },
};

/** O conteúdo fica a pelo menos esta distância do topo e da base da folha. */
export const MIN_EDGE_DISTANCE_MM = 5;

const marginKey = {
  Left: "contentMarginLeftMm",
  Right: "contentMarginRightMm",
  Top: "contentMarginTopMm",
  Bottom: "contentMarginBottomMm",
} as const;

/** As margens que o PDF usava antes de serem configuráveis. */
export function defaultContentMargins(headerHeightMm: number, footerHeightMm: number) {
  return {
    contentMarginLeftMm: 20,
    contentMarginRightMm: 20,
    // Sem cabeçalho ou rodapé desenhado, o corpo mantém a distância da borda da folha.
    contentMarginTopMm: headerHeightMm > 0 ? 6 : 20,
    contentMarginBottomMm: footerHeightMm > 0 ? 4 : 16,
  };
}

export function contentMarginMm(layout: PrescriptionTemplateLayout, side: ContentMarginSide) {
  return layout[marginKey[side]];
}

/** Menor valor aceito: acima e abaixo dependem da altura do cabeçalho e do rodapé. */
export function contentMarginMinMm(layout: PrescriptionTemplateLayout, side: ContentMarginSide) {
  const { min } = contentMarginLimitsMm[side];
  if (side === "Top") return Math.max(min, MIN_EDGE_DISTANCE_MM - layout.headerHeightMm);
  if (side === "Bottom") return Math.max(min, MIN_EDGE_DISTANCE_MM - layout.footerHeightMm);
  return min;
}

export function withContentMargin(
  layout: PrescriptionTemplateLayout,
  side: ContentMarginSide,
  valueMm: number,
): PrescriptionTemplateLayout {
  return { ...layout, [marginKey[side]]: valueMm };
}

export const zoneLabels: Record<TemplateZone, string> = {
  Header: "Cabeçalho",
  Footer: "Rodapé",
};

export const elementKindLabels: Record<TemplateElementKind, string> = {
  Text: "Texto",
  Image: "Imagem",
  Line: "Linha",
};

export const fontFamilyLabels: Record<TemplateFontFamily, string> = {
  Lato: "Lato (sem serifa)",
  Lora: "Lora (com serifa)",
};

export const textAlignLabels: Record<TemplateTextAlign, string> = {
  Left: "Esquerda",
  Center: "Centro",
  Right: "Direita",
};

/** Pilha de fontes da folha: a mesma família que a API embute no PDF. */
export const fontFamilyStacks: Record<TemplateFontFamily, string> = {
  Lato: '"Lato", "Helvetica Neue", Arial, sans-serif',
  Lora: '"Lora", Georgia, "Times New Roman", serif',
};

/**
 * Cores de tinta sugeridas. São cores do documento impresso, não do tema do app,
 * por isso ficam aqui em hexadecimal (o formato que a API grava).
 */
export const inkSwatches = [
  { hex: "#16283a", label: "Tinta escura" },
  { hex: "#33475b", label: "Grafite" },
  { hex: "#657685", label: "Cinza" },
  { hex: "#3b5bfe", label: "Azul" },
  { hex: "#237a45", label: "Verde" },
  { hex: "#c92f3a", label: "Vermelho" },
] as const;

export const defaultInkHex = "#16283a";

export interface TemplateField {
  /** Forma gravada, trocada pelo dado real na emissão. */
  token: string;
  /** Forma mostrada no painel, entre chaves simples: `{Nome da clínica}`. */
  label: string;
  /** Valor fictício mostrado na folha do editor. */
  sample: string;
}

// Dados fictícios: no PDF, cada campo recebe o dado da clínica e do médico que emite.
export const templateFields: readonly TemplateField[] = [
  { token: "{{clinic.name}}", label: "Nome da clínica", sample: "Clínica Horizonte" },
  { token: "{{clinic.address}}", label: "Endereço", sample: "Av. Paulista, 1000 · São Paulo" },
  { token: "{{clinic.phone}}", label: "Telefone", sample: "(11) 4000-0000" },
  { token: "{{doctor.name}}", label: "Médico", sample: "Dra. Helena Costa" },
  { token: "{{doctor.registration}}", label: "Registro", sample: "CRM-SP 123456" },
  { token: "{{doctor.specialty}}", label: "Especialidade", sample: "Cardiologia" },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const fieldByToken = new Map(templateFields.map((field) => [field.token, field]));
const fieldByLabel = new Map(
  templateFields.map((field) => [field.label.toLocaleLowerCase("pt-BR"), field]),
);
const knownTokenSource = templateFields.map((field) => escapeRegExp(field.token)).join("|");
const friendlySource = `\\{\\s*(${templateFields
  .map((field) => escapeRegExp(field.label))
  .join("|")})\\s*\\}`;

/** `{{clinic.name}}` → `{Nome da clínica}`: a forma que a pessoa lê e edita. */
export function toFriendlyText(text: string) {
  return text.replace(
    new RegExp(knownTokenSource, "g"),
    (token) => `{${fieldByToken.get(token)!.label}}`,
  );
}

/** `{Nome da clínica}` → `{{clinic.name}}`, aceitando caixa e espaços diferentes. */
export function toMachineText(text: string) {
  return text.replace(
    new RegExp(friendlySource, "giu"),
    (_, label: string) => fieldByLabel.get(label.toLocaleLowerCase("pt-BR"))!.token,
  );
}

/**
 * Valor real de cada campo, por token, quando o editor o conhece (os dados da clínica).
 * Token ausente usa o valor de exemplo; texto vazio significa que a clínica não tem o dado
 * e o campo sai vazio na receita.
 */
export type TemplateFieldValues = Readonly<Record<string, string>>;

export function clinicFieldValues(clinic: {
  name: string;
  address: string | null;
  phone: string | null;
}): TemplateFieldValues {
  return {
    "{{clinic.name}}": clinic.name.trim(),
    "{{clinic.address}}": clinic.address?.trim() ?? "",
    "{{clinic.phone}}": clinic.phone?.trim() ?? "",
  };
}

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "field"; field: TemplateField };

/** Divide o texto gravado em trechos literais e campos, para destacar os campos na folha. */
export function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(new RegExp(knownTokenSource, "g"))) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: "text", value: text.slice(last, index) });
    segments.push({ kind: "field", field: fieldByToken.get(match[0])! });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", value: text.slice(last) });
  return segments;
}

/** Texto com os campos trocados pelos valores de exemplo. */
export function sampleText(text: string) {
  return segmentText(text)
    .map((segment) => (segment.kind === "field" ? segment.field.sample : segment.value))
    .join("");
}

/** Campos `{{...}}` que a API não conhece (digitados à mão). */
export function unknownFields(text: string) {
  return [...text.matchAll(/\{\{([^{}]*)\}\}/g)]
    .map((match) => match[0])
    .filter((token) => !fieldByToken.has(token));
}

/* ---------- Medidas ---------- */

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// `+ 0` troca o -0 (Math.ceil de um negativo minúsculo) por 0 na medida gravada.

/** Arredonda a 0,1 mm, a precisão do editor. */
export function roundMm(value: number) {
  return Math.round(value * 10) / 10 + 0;
}

function floorMm(value: number) {
  return Math.floor(value * 10 + 1e-6) / 10 + 0;
}

function ceilMm(value: number) {
  return Math.ceil(value * 10 - 1e-6) / 10 + 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Escala da folha na tela: px por milímetro para uma folha com essa largura em px. */
export function pxPerMm(sheetWidthPx: number) {
  return sheetWidthPx > 0 ? sheetWidthPx / PAGE_WIDTH_MM : 1;
}

export function pxToMm(px: number, scale: number) {
  return px / scale;
}

export function mmToPx(mm: number, scale: number) {
  return mm * scale;
}

/** Medida em centímetros para leitura: 36,5 mm → "3,65". */
export function formatCm(mm: number) {
  return (mm / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

/** Valor de campo numérico (ponto decimal), sem zeros à direita: 36,5 mm → "3.65". */
export function inputNumber(value: number) {
  return String(round2(value));
}

/** Lê um número digitado com vírgula ou ponto; `null` enquanto não for um número. */
export function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function zoneHeightMm(layout: TemplateLayout, zone: TemplateZone) {
  return zone === "Header" ? layout.headerHeightMm : layout.footerHeightMm;
}

export function withZoneHeight(
  layout: TemplateLayout,
  zone: TemplateZone,
  heightMm: number,
): TemplateLayout {
  return zone === "Header"
    ? { ...layout, headerHeightMm: heightMm }
    : { ...layout, footerHeightMm: heightMm };
}

/** Topo da área na folha, em mm. */
export function zoneTopMm(layout: TemplateLayout, zone: TemplateZone) {
  return zone === "Header" ? 0 : PAGE_HEIGHT_MM - layout.footerHeightMm;
}

export function minWidthMm(kind: TemplateElementKind) {
  return kind === "Text" ? TEMPLATE_LIMITS.textMinWidthMm : TEMPLATE_LIMITS.shapeMinWidthMm;
}

export function lineThicknessMm(thicknessPt: number) {
  return thicknessPt * MM_PER_PT;
}

export function fontSizeMm(fontSizePt: number) {
  return fontSizePt * MM_PER_PT;
}

/**
 * Altura estimada de um texto, para quando a folha ainda não mediu a caixa (testes e o
 * primeiro quadro): linhas digitadas mais a quebra aproximada pela largura.
 */
export function estimateTextHeightMm(element: TemplateElement) {
  const sizeMm = fontSizeMm(element.fontSizePt ?? 11);
  const charsPerLine = Math.max(1, Math.floor(element.widthMm / (sizeMm * 0.5)));
  const lines = sampleText(element.text ?? "")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return round2(lines * sizeMm * TEXT_LINE_HEIGHT);
}

/** Altura ocupada pelo elemento na área; o texto usa a medida da folha quando houver. */
export function elementHeightMm(element: TemplateElement, measuredTextMm?: number) {
  if (element.kind === "Image") return element.heightMm ?? 0;
  if (element.kind === "Line") return lineThicknessMm(element.thicknessPt ?? 1);
  return measuredTextMm ?? estimateTextHeightMm(element);
}

/**
 * Recorta o elemento à folha e à sua área: largura mínima por tipo, nada além dos
 * 210 mm e a caixa inteira dentro da área (o editor é mais estrito que a API no texto).
 * A imagem mantém a proporção e encolhe se for mais alta que a área.
 */
export function fitElement(
  element: TemplateElement,
  zoneHeight: number,
  measuredTextMm?: number,
): TemplateElement {
  let widthMm = clamp(element.widthMm, minWidthMm(element.kind), PAGE_WIDTH_MM);
  let heightMm = element.heightMm;

  if (element.kind === "Image") {
    const ratio =
      element.heightMm && element.heightMm > 0 ? element.widthMm / element.heightMm : 1;
    widthMm = roundMm(widthMm);
    heightMm = round2(widthMm / ratio);
    if (zoneHeight > 0 && heightMm > zoneHeight) {
      heightMm = zoneHeight;
      widthMm = floorMm(Math.min(PAGE_WIDTH_MM, heightMm * ratio));
      heightMm = round2(Math.min(zoneHeight, widthMm / ratio));
    }
  } else {
    widthMm = roundMm(widthMm);
  }

  const occupied = elementHeightMm({ ...element, widthMm, heightMm }, measuredTextMm);
  const xMm = clamp(roundMm(element.xMm), 0, floorMm(PAGE_WIDTH_MM - widthMm));
  const yMm = clamp(roundMm(element.yMm), 0, floorMm(zoneHeight - occupied));

  return { ...element, xMm, yMm, widthMm, heightMm };
}

/** Ponto mais baixo ocupado na área, para a área não encolher por cima de um bloco. */
export function lowestBottomMm(
  layout: TemplateLayout,
  zone: TemplateZone,
  textHeights: Readonly<Record<string, number>> = {},
) {
  const bottom = layout.elements
    .filter((element) => element.zone === zone)
    .reduce(
      (lowest, element) =>
        Math.max(lowest, element.yMm + elementHeightMm(element, textHeights[element.id])),
      0,
    );
  return ceilMm(bottom);
}

/* ---------- Elementos ---------- */

/** Id do elemento, gerado no cliente (até 40 caracteres). */
export function createElementId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const emptyElement = {
  heightMm: null,
  text: null,
  fontFamily: null,
  fontSizePt: null,
  bold: false,
  italic: false,
  colorHex: null,
  align: null,
  thicknessPt: null,
  imageId: null,
} satisfies Partial<TemplateElement>;

export function createTextElement(id: string, text = "Novo texto"): TemplateElement {
  return {
    ...emptyElement,
    id,
    zone: "Header",
    kind: "Text",
    xMm: 20,
    yMm: 0,
    widthMm: 90,
    text,
    fontFamily: "Lato",
    fontSizePt: 11,
    colorHex: defaultInkHex,
    align: "Left",
  };
}

export function createLineElement(id: string): TemplateElement {
  return {
    ...emptyElement,
    id,
    zone: "Header",
    kind: "Line",
    xMm: 20,
    yMm: 0,
    widthMm: 170,
    colorHex: defaultInkHex,
    thicknessPt: 1,
  };
}

/** Imagem nova com 3 cm de largura e a altura pela proporção do arquivo. */
export function createImageElement(
  id: string,
  imageId: string,
  aspectRatio: number,
): TemplateElement {
  const widthMm = 30;
  const ratio = aspectRatio > 0 ? aspectRatio : 1;
  return {
    ...emptyElement,
    id,
    zone: "Header",
    kind: "Image",
    xMm: 20,
    yMm: 0,
    widthMm,
    heightMm: round2(widthMm / ratio),
    imageId,
  };
}

/** Completa um elemento vindo da API com os padrões do seu tipo. */
export function normalizeElement(element: TemplateElement): TemplateElement {
  const base = { ...element, bold: Boolean(element.bold), italic: Boolean(element.italic) };
  if (element.kind === "Text") {
    return {
      ...base,
      heightMm: null,
      text: element.text ?? "",
      fontFamily: element.fontFamily ?? "Lato",
      fontSizePt: element.fontSizePt ?? 11,
      colorHex: element.colorHex ?? defaultInkHex,
      align: element.align ?? "Left",
      thicknessPt: null,
      imageId: null,
    };
  }
  if (element.kind === "Line") {
    return {
      ...base,
      ...emptyElement,
      colorHex: element.colorHex ?? defaultInkHex,
      thicknessPt: element.thicknessPt ?? 1,
    };
  }
  return {
    ...base,
    ...emptyElement,
    heightMm: element.heightMm ?? element.widthMm,
    imageId: element.imageId,
  };
}

export function layoutFromTemplate(template: PrescriptionTemplate): TemplateLayout {
  const defaults = defaultContentMargins(template.headerHeightMm, template.footerHeightMm);
  return {
    headerHeightMm: template.headerHeightMm,
    footerHeightMm: template.footerHeightMm,
    contentMarginLeftMm: template.contentMarginLeftMm ?? defaults.contentMarginLeftMm,
    contentMarginRightMm: template.contentMarginRightMm ?? defaults.contentMarginRightMm,
    contentMarginTopMm: template.contentMarginTopMm ?? defaults.contentMarginTopMm,
    contentMarginBottomMm: template.contentMarginBottomMm ?? defaults.contentMarginBottomMm,
    elements: template.elements.map(normalizeElement),
  };
}

/** Forma canônica para comparar desenhos (ordem de chaves e 0,01 mm). */
function canonical(layout: TemplateLayout | null) {
  if (!layout) return "null";
  const number = (value: number | null) => (value === null ? null : round2(value));
  return JSON.stringify({
    h: number(layout.headerHeightMm),
    f: number(layout.footerHeightMm),
    m: contentMarginSides.map((side) => number(contentMarginMm(layout, side))),
    e: layout.elements.map((element) => [
      element.id,
      element.zone,
      element.kind,
      number(element.xMm),
      number(element.yMm),
      number(element.widthMm),
      number(element.heightMm),
      element.text,
      element.fontFamily,
      number(element.fontSizePt),
      element.bold,
      element.italic,
      element.colorHex?.toLowerCase() ?? null,
      element.align,
      number(element.thicknessPt),
      element.imageId,
    ]),
  });
}

export function sameLayout(a: TemplateLayout | null, b: TemplateLayout | null) {
  return canonical(a) === canonical(b);
}

export function blankLayout(): TemplateLayout {
  return {
    headerHeightMm: zoneDefaultHeightMm.Header,
    footerHeightMm: zoneDefaultHeightMm.Footer,
    ...defaultContentMargins(zoneDefaultHeightMm.Header, zoneDefaultHeightMm.Footer),
    elements: [],
  };
}

/**
 * Ponto de partida com os campos mais comuns. Sem logotipo: imagem só entra pelo envio
 * de um arquivo da clínica.
 */
export function sampleLayout(nextId: () => string = createElementId): TemplateLayout {
  const text = (changes: Partial<TemplateElement>): TemplateElement => ({
    ...createTextElement(nextId()),
    ...changes,
  });
  const line = (changes: Partial<TemplateElement>): TemplateElement => ({
    ...createLineElement(nextId()),
    ...changes,
  });
  return {
    headerHeightMm: 40,
    footerHeightMm: 22,
    ...defaultContentMargins(40, 22),
    elements: [
      text({ yMm: 9, widthMm: 170, text: "{{clinic.name}}", fontFamily: "Lora", fontSizePt: 20, bold: true }),
      text({
        yMm: 20,
        widthMm: 170,
        text: "{{doctor.name}} · {{doctor.specialty}}\n{{doctor.registration}}",
        fontSizePt: 10,
        colorHex: "#657685",
      }),
      line({ yMm: 36.5, thicknessPt: 1.5, colorHex: "#3b5bfe" }),
      line({ zone: "Footer", yMm: 4, thicknessPt: 0.75, colorHex: "#c9d1dc" }),
      text({
        zone: "Footer",
        yMm: 8,
        widthMm: 170,
        text: "{{clinic.address}} · {{clinic.phone}}",
        fontSizePt: 9,
        colorHex: "#657685",
        align: "Center",
      }),
    ],
  };
}

/** Nome curto do bloco na lista e nos rótulos acessíveis. */
export function elementListLabel(element: TemplateElement) {
  if (element.kind !== "Text") return elementKindLabels[element.kind];
  const flat = toFriendlyText(element.text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "Texto vazio";
  return flat.length > 34 ? `${flat.slice(0, 33)}…` : flat;
}

const addedMessages: Record<TemplateElementKind, string> = {
  Text: "Texto adicionado",
  Image: "Imagem adicionada",
  Line: "Linha adicionada",
};

export function addedMessage(kind: TemplateElementKind, zone: TemplateZone) {
  return `${addedMessages[kind]} ao ${zoneLabels[zone].toLowerCase()}.`;
}

/* ---------- Validação (espelho das regras da API) ---------- */

const EPSILON = 0.001;
const hexColor = /^#[0-9a-f]{6}$/i;

function describe(element: TemplateElement) {
  return `${elementKindLabels[element.kind]} “${elementListLabel(element)}” (${zoneLabels[
    element.zone
  ].toLowerCase()})`;
}

/**
 * Primeiro problema do desenho, com a mesma regra que a API aplica; `null` quando pode
 * ser salvo. O editor já impede quase todos; isto evita mandar um 400 previsível.
 */
export function validateLayout(layout: TemplateLayout): string | null {
  if (layout.headerHeightMm < 0 || layout.headerHeightMm > zoneMaxHeightMm.Header) {
    return "O cabeçalho deve ter de 0 a 8 cm.";
  }
  if (layout.footerHeightMm < 0 || layout.footerHeightMm > zoneMaxHeightMm.Footer) {
    return "O rodapé deve ter de 0 a 6 cm.";
  }
  for (const side of contentMarginSides) {
    const value = contentMarginMm(layout, side);
    const { min, max } = contentMarginLimitsMm[side];
    if (!(value >= min - EPSILON && value <= max + EPSILON)) {
      return side === "Left" || side === "Right"
        ? "As margens esquerda e direita do conteúdo devem ficar entre 0,5 e 6 cm."
        : "As margens acima e abaixo do conteúdo devem ficar entre 0 e 5 cm.";
    }
  }
  if (
    layout.headerHeightMm + layout.contentMarginTopMm < MIN_EDGE_DISTANCE_MM - EPSILON ||
    layout.footerHeightMm + layout.contentMarginBottomMm < MIN_EDGE_DISTANCE_MM - EPSILON
  ) {
    return "O conteúdo precisa ficar a pelo menos 0,5 cm do topo e da base da folha. Aumente a margem ou a altura do cabeçalho ou do rodapé.";
  }
  if (layout.elements.length > TEMPLATE_LIMITS.elements) {
    return `O receituário aceita até ${TEMPLATE_LIMITS.elements} blocos.`;
  }

  const ids = new Set<string>();
  for (const element of layout.elements) {
    if (!element.id || element.id.length > TEMPLATE_LIMITS.idLength || ids.has(element.id)) {
      return "Há blocos com identificação repetida. Recarregue a página e tente de novo.";
    }
    ids.add(element.id);

    const zoneHeight = zoneHeightMm(layout, element.zone);
    const name = describe(element);
    if (element.xMm < 0 || element.yMm < 0 || element.xMm + element.widthMm > PAGE_WIDTH_MM + EPSILON) {
      return `${name} passa da largura da folha.`;
    }
    if (element.widthMm < minWidthMm(element.kind) - EPSILON) {
      return `${name} é estreito demais.`;
    }

    if (element.kind === "Text") {
      const text = element.text ?? "";
      // A API recusa caixa de texto vazia; avisar aqui evita um 400 previsível.
      if (!text.trim()) return "Há uma caixa de texto vazia. Escreva o texto ou remova o bloco.";
      if (text.length > TEMPLATE_LIMITS.textLength) {
        return `${name} passa de ${TEMPLATE_LIMITS.textLength} caracteres.`;
      }
      const unknown = unknownFields(text);
      if (unknown.length) return `${name} usa um campo desconhecido: ${unknown[0]}.`;
      const size = element.fontSizePt ?? 0;
      if (size < TEMPLATE_LIMITS.fontMinPt || size > TEMPLATE_LIMITS.fontMaxPt) {
        return `${name}: o tamanho da fonte deve ficar entre ${TEMPLATE_LIMITS.fontMinPt} e ${TEMPLATE_LIMITS.fontMaxPt} pt.`;
      }
      if (!hexColor.test(element.colorHex ?? "")) return `${name} está com uma cor inválida.`;
      if (element.yMm >= zoneHeight) return `${name} está fora da área.`;
    } else if (element.kind === "Image") {
      if (!element.imageId) return `${name} está sem arquivo.`;
      if (!element.heightMm || element.yMm + element.heightMm > zoneHeight + EPSILON) {
        return `${name} passa da altura da área.`;
      }
    } else {
      const thickness = element.thicknessPt ?? 0;
      if (thickness < TEMPLATE_LIMITS.thicknessMinPt || thickness > TEMPLATE_LIMITS.thicknessMaxPt) {
        return `${name}: a espessura deve ficar entre 0,25 e 8 pt.`;
      }
      if (!hexColor.test(element.colorHex ?? "")) return `${name} está com uma cor inválida.`;
      if (element.yMm + lineThicknessMm(thickness) > zoneHeight + EPSILON) {
        return `${name} passa da altura da área.`;
      }
    }
  }
  return null;
}

/* ---------- Imagens ---------- */

const acceptedImageTypes = ["image/png", "image/jpeg"];

/** Confere tipo e tamanho antes do envio; a API confere de novo pelos bytes. */
export function validateImageFile(file: File): string | null {
  if (!acceptedImageTypes.includes(file.type)) return "Envie uma imagem PNG ou JPEG.";
  if (file.size > TEMPLATE_LIMITS.imageBytes) {
    return "A imagem tem mais de 2 MB. Reduza o arquivo e tente de novo.";
  }
  return null;
}
