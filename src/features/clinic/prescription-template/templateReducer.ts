import type { TemplateZone } from "../../../api/types";
import {
  clamp,
  elementHeightMm,
  fitElement,
  lowestBottomMm,
  PAGE_WIDTH_MM,
  roundMm,
  TEMPLATE_LIMITS,
  type TemplateElement,
  type TemplateLayout,
  withZoneHeight,
  zoneDefaultHeightMm,
  zoneHeightMm,
  zoneMaxHeightMm,
} from "./templateModel";

/**
 * Rascunho do editor. `layout` nulo é a clínica no cabeçalho padrão do sistema.
 * As alturas medidas dos textos não fazem parte do desenho: servem só para manter a
 * caixa inteira dentro da área.
 */
export interface EditorState {
  layout: TemplateLayout | null;
  selectedId: string | null;
  /** Área onde entram os blocos novos. */
  activeZone: TemplateZone;
  textHeights: Readonly<Record<string, number>>;
}

/** Propriedades que o painel altera diretamente; posição e largura passam pelo recorte. */
export type ElementChanges = Partial<
  Pick<
    TemplateElement,
    | "text"
    | "fontFamily"
    | "fontSizePt"
    | "bold"
    | "italic"
    | "colorHex"
    | "align"
    | "thicknessPt"
    | "xMm"
    | "yMm"
    | "widthMm"
  >
>;

export type EditorAction =
  /** Troca o rascunho inteiro (carga, descarte, restaurar padrão). */
  | { type: "load"; layout: TemplateLayout | null }
  /** Desenho devolvido pela API ao salvar: mantém a seleção. */
  | { type: "saved"; layout: TemplateLayout }
  /** Começa um receituário (em branco ou do exemplo). */
  | { type: "start"; layout: TemplateLayout }
  /** Entra na área ativa, abaixo do último bloco dela, e fica selecionado. */
  | { type: "add"; element: TemplateElement }
  | { type: "select"; id: string | null }
  | { type: "setActiveZone"; zone: TemplateZone }
  /** Posição absoluta na área (arrasto). */
  | { type: "move"; id: string; xMm: number; yMm: number }
  /** Deslocamento relativo (teclado). */
  | { type: "nudge"; id: string; dxMm: number; dyMm: number }
  /** Largura pela alça: a borda esquerda fica parada; imagem mantém a proporção. */
  | { type: "resize"; id: string; widthMm: number }
  | { type: "update"; id: string; changes: ElementChanges }
  | { type: "replaceImage"; id: string; imageId: string; aspectRatio: number }
  | { type: "changeZone"; id: string; zone: TemplateZone }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "setZoneHeight"; zone: TemplateZone; heightMm: number }
  | { type: "measureTexts"; heights: Readonly<Record<string, number>> };

export function initialEditorState(layout: TemplateLayout | null): EditorState {
  return { layout, selectedId: null, activeZone: "Header", textHeights: {} };
}

export function canAddElement(state: EditorState) {
  return Boolean(state.layout) && state.layout!.elements.length < TEMPLATE_LIMITS.elements;
}

export function selectedElement(state: EditorState) {
  return state.layout?.elements.find((element) => element.id === state.selectedId) ?? null;
}

function fitIn(layout: TemplateLayout, element: TemplateElement, textHeights: EditorState["textHeights"]) {
  return fitElement(element, zoneHeightMm(layout, element.zone), textHeights[element.id]);
}

function replaceElement(state: EditorState, id: string, next: (element: TemplateElement, layout: TemplateLayout) => TemplateElement): EditorState {
  const layout = state.layout;
  const current = layout?.elements.find((element) => element.id === id);
  if (!layout || !current) return state;
  const updated = next(current, layout);
  return {
    ...state,
    layout: {
      ...layout,
      elements: layout.elements.map((element) => (element.id === id ? updated : element)),
    },
  };
}

/** A área cresce (até o limite) para caber um bloco novo ou que chega de outra área. */
function ensureRoom(layout: TemplateLayout, zone: TemplateZone, neededMm: number) {
  const height = zoneHeightMm(layout, zone);
  if (height >= neededMm + 2) return layout;
  const grown = Math.min(
    zoneMaxHeightMm[zone],
    Math.max(zoneDefaultHeightMm[zone], Math.ceil(neededMm + 4)),
  );
  return grown > height ? withZoneHeight(layout, zone, grown) : layout;
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string) {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function templateReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return initialEditorState(action.layout);

    case "saved": {
      const keepSelection = action.layout.elements.some((element) => element.id === state.selectedId);
      return {
        ...state,
        layout: action.layout,
        selectedId: keepSelection ? state.selectedId : null,
      };
    }

    case "start":
      return initialEditorState(action.layout);

    case "add": {
      if (!state.layout || !canAddElement(state)) return state;
      const zone = state.activeZone;
      const sized = { ...action.element, zone };
      const ownHeight = sized.kind === "Text" ? 8 : elementHeightMm(sized);
      let layout = ensureRoom(state.layout, zone, ownHeight);
      const zoneHeight = zoneHeightMm(layout, zone);
      const occupied = sized.kind === "Text" ? elementHeightMm(sized) : ownHeight;
      // Logo abaixo do último bloco da área, se couber; senão perto do topo.
      const bottom = lowestBottomMm(layout, zone, state.textHeights);
      const yMm = bottom + 2 + occupied <= zoneHeight ? bottom + 2 : 3;
      const element = fitElement({ ...sized, yMm }, zoneHeight);
      layout = { ...layout, elements: [...layout.elements, element] };
      return { ...state, layout, selectedId: element.id };
    }

    case "select": {
      const element = state.layout?.elements.find((item) => item.id === action.id);
      return {
        ...state,
        selectedId: element ? element.id : null,
        activeZone: element ? element.zone : state.activeZone,
      };
    }

    case "setActiveZone":
      return state.activeZone === action.zone ? state : { ...state, activeZone: action.zone };

    case "move":
      return replaceElement(state, action.id, (element, layout) =>
        fitIn(layout, { ...element, xMm: action.xMm, yMm: action.yMm }, state.textHeights),
      );

    case "nudge":
      return replaceElement(state, action.id, (element, layout) =>
        fitIn(
          layout,
          { ...element, xMm: element.xMm + action.dxMm, yMm: element.yMm + action.dyMm },
          state.textHeights,
        ),
      );

    case "resize":
      return replaceElement(state, action.id, (element, layout) => {
        const zoneHeight = zoneHeightMm(layout, element.zone);
        if (element.kind === "Image" && element.heightMm) {
          const ratio = element.widthMm / element.heightMm;
          const maxWidth = Math.min(PAGE_WIDTH_MM - element.xMm, (zoneHeight - element.yMm) * ratio);
          const widthMm = roundMm(clamp(action.widthMm, TEMPLATE_LIMITS.shapeMinWidthMm, maxWidth));
          return fitIn(layout, { ...element, widthMm, heightMm: widthMm / ratio }, state.textHeights);
        }
        const minWidth = element.kind === "Text" ? TEMPLATE_LIMITS.textMinWidthMm : TEMPLATE_LIMITS.shapeMinWidthMm;
        const widthMm = roundMm(clamp(action.widthMm, minWidth, PAGE_WIDTH_MM - element.xMm));
        return fitIn(layout, { ...element, widthMm }, state.textHeights);
      });

    case "update":
      return replaceElement(state, action.id, (element, layout) => {
        const changes = { ...action.changes };
        if (changes.fontSizePt !== undefined && changes.fontSizePt !== null) {
          changes.fontSizePt = clamp(changes.fontSizePt, TEMPLATE_LIMITS.fontMinPt, TEMPLATE_LIMITS.fontMaxPt);
        }
        if (changes.thicknessPt !== undefined && changes.thicknessPt !== null) {
          changes.thicknessPt = clamp(
            changes.thicknessPt,
            TEMPLATE_LIMITS.thicknessMinPt,
            TEMPLATE_LIMITS.thicknessMaxPt,
          );
        }
        if (changes.text !== undefined && changes.text !== null) {
          changes.text = changes.text.slice(0, TEMPLATE_LIMITS.textLength);
        }
        let next: TemplateElement = { ...element, ...changes };
        // Imagem com largura nova mantém a proporção.
        if (element.kind === "Image" && changes.widthMm !== undefined && element.heightMm) {
          next = { ...next, heightMm: changes.widthMm / (element.widthMm / element.heightMm) };
        }
        return fitIn(layout, next, state.textHeights);
      });

    case "replaceImage":
      return replaceElement(state, action.id, (element, layout) => {
        const ratio = action.aspectRatio > 0 ? action.aspectRatio : 1;
        return fitIn(
          layout,
          { ...element, imageId: action.imageId, heightMm: element.widthMm / ratio },
          state.textHeights,
        );
      });

    case "changeZone": {
      const layout = state.layout;
      const current = layout?.elements.find((element) => element.id === action.id);
      if (!layout || !current || current.zone === action.zone) return state;
      const roomy = ensureRoom(
        layout,
        action.zone,
        elementHeightMm(current, state.textHeights[current.id]),
      );
      const moved = fitIn(roomy, { ...current, zone: action.zone }, state.textHeights);
      return {
        ...state,
        activeZone: action.zone,
        layout: {
          ...roomy,
          elements: roomy.elements.map((element) => (element.id === action.id ? moved : element)),
        },
      };
    }

    case "remove": {
      if (!state.layout) return state;
      return {
        ...state,
        layout: {
          ...state.layout,
          elements: state.layout.elements.filter((element) => element.id !== action.id),
        },
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        textHeights: withoutKey(state.textHeights, action.id),
      };
    }

    case "duplicate": {
      const layout = state.layout;
      const current = layout?.elements.find((element) => element.id === action.id);
      if (!layout || !current || !canAddElement(state)) return state;
      const copy = fitIn(
        layout,
        { ...current, id: action.newId, xMm: current.xMm + 4, yMm: current.yMm + 2 },
        { ...state.textHeights, [action.newId]: state.textHeights[current.id] },
      );
      return {
        ...state,
        layout: { ...layout, elements: [...layout.elements, copy] },
        selectedId: copy.id,
        activeZone: copy.zone,
      };
    }

    case "setZoneHeight": {
      if (!state.layout) return state;
      // A área não encolhe além do bloco mais baixo: nada sai da folha sem a pessoa mover.
      const floor = lowestBottomMm(state.layout, action.zone, state.textHeights);
      const heightMm = roundMm(clamp(action.heightMm, floor, zoneMaxHeightMm[action.zone]));
      if (heightMm === zoneHeightMm(state.layout, action.zone)) return state;
      return { ...state, layout: withZoneHeight(state.layout, action.zone, heightMm) };
    }

    case "measureTexts": {
      let changed = false;
      const textHeights = { ...state.textHeights };
      for (const [id, height] of Object.entries(action.heights)) {
        if (Math.abs((textHeights[id] ?? -1) - height) > 0.05) {
          textHeights[id] = height;
          changed = true;
        }
      }
      if (!changed) return state;
      const next = { ...state, textHeights };
      // Só o texto em edição é reajustado: carregar a página não pode mexer no desenho.
      const selected = selectedElement(state);
      if (!selected || selected.kind !== "Text" || !(selected.id in action.heights)) return next;
      return replaceElement(next, selected.id, (element, layout) => fitIn(layout, element, textHeights));
    }

    default:
      return state;
  }
}
