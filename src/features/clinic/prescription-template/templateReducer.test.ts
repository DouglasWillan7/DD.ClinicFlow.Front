import { describe, expect, test } from "vitest";
import {
  blankLayout,
  createImageElement,
  createLineElement,
  createTextElement,
  type TemplateElement,
  type TemplateLayout,
} from "./templateModel";
import {
  canAddElement,
  type EditorAction,
  type EditorState,
  initialEditorState,
  selectedElement,
  templateReducer,
} from "./templateReducer";

function run(state: EditorState, ...actions: EditorAction[]) {
  return actions.reduce(templateReducer, state);
}

function withElements(elements: TemplateElement[], header = 30, footer = 20): EditorState {
  return initialEditorState({ headerHeightMm: header, footerHeightMm: footer, elements });
}

function element(state: EditorState, id: string) {
  return state.layout!.elements.find((item) => item.id === id)!;
}

describe("adicionar", () => {
  test("entra na área ativa, abaixo do último bloco, e fica selecionado", () => {
    let state = initialEditorState(blankLayout());
    state = run(state, { type: "add", element: createTextElement("a") });
    expect(element(state, "a")).toMatchObject({ zone: "Header", xMm: 20, yMm: 2 });
    expect(state.selectedId).toBe("a");

    state = run(
      state,
      { type: "measureTexts", heights: { a: 5 } },
      { type: "setActiveZone", zone: "Footer" },
      { type: "add", element: createLineElement("b") },
      { type: "setActiveZone", zone: "Header" },
      { type: "add", element: createLineElement("c") },
    );
    expect(element(state, "b")).toMatchObject({ zone: "Footer", yMm: 2 });
    // Abaixo do texto de 5 mm que começa em 2 mm.
    expect(element(state, "c")).toMatchObject({ zone: "Header", yMm: 9 });
  });

  test("a área cresce para caber uma imagem alta, até o limite", () => {
    let state = initialEditorState({ ...blankLayout(), headerHeightMm: 10 });
    state = run(state, { type: "add", element: createImageElement("i", "img", 1) });
    expect(state.layout!.headerHeightMm).toBe(34);
    expect(element(state, "i")).toMatchObject({ widthMm: 30, heightMm: 30, yMm: 2 });

    let tall = initialEditorState({ ...blankLayout(), footerHeightMm: 10 });
    tall = run(
      tall,
      { type: "setActiveZone", zone: "Footer" },
      { type: "add", element: createImageElement("t", "img", 0.25) },
    );
    expect(tall.layout!.footerHeightMm).toBe(60);
    // 30 × 120 mm não cabe: encolhe para a altura da área mantendo a proporção.
    expect(element(tall, "t")).toMatchObject({ heightMm: 60, widthMm: 15, yMm: 0 });
  });

  test("não passa de 30 blocos", () => {
    const full = withElements(
      Array.from({ length: 30 }, (_, index) => ({ ...createLineElement(`l${index}`), yMm: 1 })),
    );
    expect(canAddElement(full)).toBe(false);
    expect(run(full, { type: "add", element: createTextElement("x") })).toBe(full);
    expect(run(full, { type: "duplicate", id: "l0", newId: "y" })).toBe(full);
    expect(canAddElement(initialEditorState(null))).toBe(false);
  });
});

describe("mover e redimensionar", () => {
  const base = () =>
    run(
      withElements([{ ...createTextElement("t"), yMm: 4 }, { ...createImageElement("i", "img", 2), yMm: 2 }]),
      { type: "measureTexts", heights: { t: 5 } },
    );

  test("arrastar recorta à folha e à área", () => {
    const state = run(base(), { type: "move", id: "t", xMm: 150.04, yMm: 40 });
    expect(element(state, "t")).toMatchObject({ xMm: 120, yMm: 25 });
    const back = run(state, { type: "move", id: "t", xMm: -3, yMm: -3 });
    expect(element(back, "t")).toMatchObject({ xMm: 0, yMm: 0 });
  });

  test("setas deslocam a partir da posição atual", () => {
    const state = run(
      base(),
      { type: "nudge", id: "t", dxMm: 1, dyMm: 0 },
      { type: "nudge", id: "t", dxMm: 0, dyMm: 5 },
    );
    expect(element(state, "t")).toMatchObject({ xMm: 21, yMm: 9 });
  });

  test("a alça muda a largura com a borda esquerda parada", () => {
    let state = run(base(), { type: "resize", id: "t", widthMm: 300 });
    expect(element(state, "t")).toMatchObject({ xMm: 20, widthMm: 190 });
    state = run(state, { type: "resize", id: "t", widthMm: 3 });
    expect(element(state, "t").widthMm).toBe(10);
  });

  test("imagem redimensiona mantendo a proporção e sem passar da área", () => {
    let state = run(base(), { type: "resize", id: "i", widthMm: 40 });
    expect(element(state, "i")).toMatchObject({ widthMm: 40, heightMm: 20 });
    // Área de 30 mm com a imagem em 2 mm: no máximo 28 mm de altura (56 mm de largura).
    state = run(state, { type: "resize", id: "i", widthMm: 100 });
    expect(element(state, "i")).toMatchObject({ widthMm: 56, heightMm: 28 });
  });
});

describe("alterar pelo painel", () => {
  test("limita fonte e espessura às faixas da API", () => {
    let state = withElements([createTextElement("t"), createLineElement("l")]);
    state = run(
      state,
      { type: "update", id: "t", changes: { fontSizePt: 50, bold: true, align: "Center" } },
      { type: "update", id: "l", changes: { thicknessPt: 0.1, colorHex: "#3b5bfe" } },
    );
    expect(element(state, "t")).toMatchObject({ fontSizePt: 36, bold: true, align: "Center" });
    expect(element(state, "l")).toMatchObject({ thicknessPt: 0.25, colorHex: "#3b5bfe" });
  });

  test("largura nova da imagem mantém a proporção e a posição é recortada", () => {
    let state = withElements([{ ...createImageElement("i", "img", 1.5), yMm: 1 }], 40);
    state = run(state, { type: "update", id: "i", changes: { widthMm: 45 } });
    expect(element(state, "i")).toMatchObject({ widthMm: 45, heightMm: 30 });
    state = run(state, { type: "update", id: "i", changes: { xMm: 200 } });
    expect(element(state, "i").xMm).toBe(165);
  });

  test("trocar a imagem guarda o id novo e a altura pela proporção do arquivo", () => {
    let state = withElements([{ ...createImageElement("i", "velha", 1), yMm: 0 }], 40);
    state = run(state, { type: "replaceImage", id: "i", imageId: "nova", aspectRatio: 3 });
    expect(element(state, "i")).toMatchObject({ imageId: "nova", widthMm: 30, heightMm: 10 });
  });

  test("mudar de área leva o bloco, faz espaço e passa a ser a área ativa", () => {
    let state = withElements([{ ...createImageElement("i", "img", 1), yMm: 0 }], 40, 0);
    state = run(state, { type: "changeZone", id: "i", zone: "Footer" });
    expect(state.layout!.footerHeightMm).toBe(34);
    expect(element(state, "i")).toMatchObject({ zone: "Footer", yMm: 0 });
    expect(state.activeZone).toBe("Footer");
  });
});

describe("áreas", () => {
  test("a área não encolhe além do bloco mais baixo nem passa do limite", () => {
    const state = withElements([{ ...createLineElement("l"), yMm: 20 }]);
    expect(run(state, { type: "setZoneHeight", zone: "Header", heightMm: 5 }).layout!.headerHeightMm).toBe(20.4);
    expect(run(state, { type: "setZoneHeight", zone: "Header", heightMm: 120 }).layout!.headerHeightMm).toBe(80);
    expect(run(state, { type: "setZoneHeight", zone: "Footer", heightMm: 75 }).layout!.footerHeightMm).toBe(60);
    expect(run(state, { type: "setZoneHeight", zone: "Footer", heightMm: -4 }).layout!.footerHeightMm).toBe(0);
  });
});

describe("seleção, remoção e duplicação", () => {
  test("selecionar escolhe a área do bloco; id desconhecido tira a seleção", () => {
    let state = withElements([{ ...createLineElement("f"), zone: "Footer" }]);
    state = run(state, { type: "select", id: "f" });
    expect(selectedElement(state)?.id).toBe("f");
    expect(state.activeZone).toBe("Footer");
    expect(run(state, { type: "select", id: "x" }).selectedId).toBeNull();
  });

  test("remover tira a seleção e a medida do texto", () => {
    let state = run(
      withElements([createTextElement("t")]),
      { type: "select", id: "t" },
      { type: "measureTexts", heights: { t: 5 } },
      { type: "remove", id: "t" },
    );
    expect(state.layout!.elements).toEqual([]);
    expect(state.selectedId).toBeNull();
    expect(state.textHeights).toEqual({});
    state = run(state, { type: "remove", id: "t" });
    expect(state.layout!.elements).toEqual([]);
  });

  test("duplicar cria a cópia deslocada e seleciona", () => {
    const state = run(withElements([{ ...createLineElement("l"), yMm: 3 }]), {
      type: "duplicate",
      id: "l",
      newId: "copia",
    });
    expect(element(state, "copia")).toMatchObject({ xMm: 24, yMm: 5, kind: "Line" });
    expect(state.selectedId).toBe("copia");
  });
});

describe("medida dos textos e carga", () => {
  test("medida nova só reajusta o texto selecionado", () => {
    const layout: TemplateLayout = {
      headerHeightMm: 30,
      footerHeightMm: 20,
      elements: [
        { ...createTextElement("a"), yMm: 25 },
        { ...createTextElement("b"), yMm: 25 },
      ],
    };
    // Carregar a página não mexe no desenho, mesmo com texto passando da área.
    const loaded = run(initialEditorState(layout), { type: "measureTexts", heights: { a: 10, b: 10 } });
    expect(loaded.layout).toBe(layout);

    const editing = run(loaded, { type: "select", id: "a" }, { type: "measureTexts", heights: { a: 12, b: 10 } });
    expect(element(editing, "a").yMm).toBe(18);
    expect(element(editing, "b").yMm).toBe(25);
  });

  test("medida igual não gera estado novo", () => {
    const state = run(withElements([createTextElement("a")]), { type: "measureTexts", heights: { a: 5 } });
    expect(run(state, { type: "measureTexts", heights: { a: 5.01 } })).toBe(state);
  });

  test("salvar mantém a seleção; carregar e começar zeram", () => {
    const state = run(withElements([createTextElement("a")]), { type: "select", id: "a" });
    const savedLayout = { ...state.layout!, headerHeightMm: 31 };
    expect(run(state, { type: "saved", layout: savedLayout }).selectedId).toBe("a");
    expect(run(state, { type: "saved", layout: { ...savedLayout, elements: [] } }).selectedId).toBeNull();
    expect(run(state, { type: "load", layout: null })).toEqual(initialEditorState(null));
    expect(run(state, { type: "start", layout: blankLayout() }).selectedId).toBeNull();
  });
});
