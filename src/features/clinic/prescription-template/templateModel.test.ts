import { describe, expect, test } from "vitest";
import type { PrescriptionTemplate } from "../../../api/types";
import {
  defaultContentMargins,
  createImageElement,
  createLineElement,
  createTextElement,
  elementListLabel,
  estimateTextHeightMm,
  fitElement,
  formatCm,
  inputNumber,
  layoutFromTemplate,
  lowestBottomMm,
  parseDecimal,
  pxPerMm,
  pxToMm,
  sameLayout,
  sampleLayout,
  sampleText,
  segmentText,
  toFriendlyText,
  toMachineText,
  unknownFields,
  validateImageFile,
  validateLayout,
  type TemplateLayout,
} from "./templateModel";

function layoutWith(elements: TemplateLayout["elements"], header = 30, footer = 20): TemplateLayout {
  return {
    headerHeightMm: header,
    footerHeightMm: footer,
    ...defaultContentMargins(header, footer),
    elements,
  };
}

describe("campos automáticos", () => {
  test("mostra a forma legível no painel e grava a forma da API", () => {
    const stored = "{{clinic.name}} · {{doctor.registration}}";
    expect(toFriendlyText(stored)).toBe("{Nome da clínica} · {Registro}");
    expect(toMachineText("{Nome da clínica} · {Registro}")).toBe(stored);
    expect(toMachineText(toFriendlyText(stored))).toBe(stored);
  });

  test("aceita o rótulo com caixa e espaços diferentes e deixa o resto como texto", () => {
    expect(toMachineText("{ nome da CLÍNICA }")).toBe("{{clinic.name}}");
    expect(toMachineText("{Fax} e {Médico")).toBe("{Fax} e {Médico");
  });

  test("divide o texto em trechos e campos, com valor de exemplo para a folha", () => {
    expect(segmentText("Dr. {{doctor.name}}\nCRM")).toEqual([
      { kind: "text", value: "Dr. " },
      { kind: "field", field: expect.objectContaining({ token: "{{doctor.name}}", label: "Médico" }) },
      { kind: "text", value: "\nCRM" },
    ]);
    expect(sampleText("{{clinic.phone}}")).toBe("(11) 4000-0000");
  });

  test("aponta campos digitados à mão que a API não conhece", () => {
    expect(unknownFields("{{clinic.name}} {{clinic.fax}}")).toEqual(["{{clinic.fax}}"]);
    expect(unknownFields("{Nome da clínica}")).toEqual([]);
  });
});

describe("medidas", () => {
  test("converte entre px e mm pela largura da folha", () => {
    const scale = pxPerMm(630);
    expect(scale).toBe(3);
    expect(pxToMm(45, scale)).toBe(15);
    // Folha sem largura (oculta) não divide por zero.
    expect(pxPerMm(0)).toBe(1);
  });

  test("formata centímetros para leitura e para o campo numérico", () => {
    expect(formatCm(40)).toBe("4,0");
    expect(formatCm(36.5)).toBe("3,65");
    expect(inputNumber(36.5 / 10)).toBe("3.65");
    expect(inputNumber(4)).toBe("4");
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });

  test("estima a altura do texto pelas linhas e pela quebra na largura", () => {
    const text = { ...createTextElement("t"), fontSizePt: 10, text: "a\nb" };
    // 2 linhas × 10 pt × 0,3528 mm × 1,25 de entrelinha.
    expect(estimateTextHeightMm(text)).toBeCloseTo(8.82, 2);
    const long = { ...createTextElement("l"), fontSizePt: 10, widthMm: 20, text: "x".repeat(40) };
    expect(estimateTextHeightMm(long)).toBeGreaterThan(estimateTextHeightMm({ ...long, text: "x" }));
  });
});

describe("recorte do elemento à área", () => {
  test("mantém o bloco dentro dos 210 mm e respeita a largura mínima por tipo", () => {
    const text = fitElement({ ...createTextElement("t"), xMm: 190, widthMm: 90 }, 30, 5);
    expect(text.xMm).toBe(120);
    expect(text.widthMm).toBe(90);
    expect(fitElement({ ...createTextElement("t"), widthMm: 2 }, 30, 5).widthMm).toBe(10);
    expect(fitElement({ ...createLineElement("l"), widthMm: 1 }, 30).widthMm).toBe(4);
    expect(fitElement({ ...createLineElement("l"), xMm: -8, widthMm: 400 }, 30)).toMatchObject({
      xMm: 0,
      widthMm: 210,
    });
  });

  test("mantém a caixa inteira dentro da altura da área", () => {
    // Texto medido com 6 mm numa área de 30 mm: o topo vai até 24 mm.
    expect(fitElement({ ...createTextElement("t"), yMm: 29 }, 30, 6).yMm).toBe(24);
    // Linha de 2 pt (0,7056 mm).
    expect(fitElement({ ...createLineElement("l"), thicknessPt: 2, yMm: 40 }, 30).yMm).toBe(29.2);
    expect(fitElement({ ...createTextElement("t"), yMm: -5 }, 30, 6).yMm).toBe(0);
  });

  test("imagem mantém a proporção e encolhe se for mais alta que a área", () => {
    const image = createImageElement("i", "img", 0.5); // 30 × 60 mm
    const fitted = fitElement(image, 40);
    expect(fitted.heightMm).toBe(40);
    expect(fitted.widthMm).toBe(20);
    expect(fitted.yMm).toBe(0);
  });

  test("calcula o ponto mais baixo ocupado na área", () => {
    const layout = layoutWith([
      { ...createTextElement("a"), yMm: 4 },
      { ...createLineElement("b"), yMm: 20, thicknessPt: 1 },
      { ...createLineElement("c"), zone: "Footer", yMm: 15 },
    ]);
    expect(lowestBottomMm(layout, "Header", { a: 5 })).toBe(20.4);
    expect(lowestBottomMm(layout, "Footer")).toBe(15.4);
  });
});

describe("validação espelhada da API", () => {
  test("o exemplo e um desenho em branco passam", () => {
    expect(validateLayout(sampleLayout())).toBeNull();
    expect(validateLayout(layoutWith([]))).toBeNull();
  });

  test("recusa alturas fora dos limites das áreas", () => {
    expect(validateLayout(layoutWith([], 81, 20))).toBe("O cabeçalho deve ter de 0 a 8 cm.");
    expect(validateLayout(layoutWith([], 30, 61))).toBe("O rodapé deve ter de 0 a 6 cm.");
  });

  test("recusa mais de 30 blocos e ids repetidos", () => {
    const many = Array.from({ length: 31 }, (_, index) => ({
      ...createLineElement(`l${index}`),
      yMm: 1,
    }));
    expect(validateLayout(layoutWith(many))).toBe("O receituário aceita até 30 blocos.");
    expect(validateLayout(layoutWith([createLineElement("x"), createLineElement("x")]))).toMatch(
      /identificação repetida/,
    );
  });

  test("recusa texto longo, campo desconhecido e fonte fora da faixa", () => {
    const text = (changes: Partial<ReturnType<typeof createTextElement>>) =>
      validateLayout(layoutWith([{ ...createTextElement("t"), yMm: 2, ...changes }]));
    expect(text({ text: "  \n " })).toMatch(/caixa de texto vazia/);
    expect(text({ text: "a".repeat(301) })).toMatch(/passa de 300 caracteres/);
    expect(text({ text: "{{clinic.fax}}" })).toMatch(/campo desconhecido: \{\{clinic\.fax\}\}/);
    expect(text({ fontSizePt: 40 })).toMatch(/entre 6 e 36 pt/);
    expect(text({ colorHex: "azul" })).toMatch(/cor inválida/);
    expect(text({ yMm: 30 })).toMatch(/fora da área/);
  });

  test("recusa bloco fora da folha ou da área", () => {
    expect(
      validateLayout(layoutWith([{ ...createLineElement("l"), xMm: 50, widthMm: 170 }])),
    ).toMatch(/passa da largura da folha/);
    expect(
      validateLayout(layoutWith([{ ...createImageElement("i", "img", 1), yMm: 10 }], 30)),
    ).toMatch(/passa da altura da área/);
    expect(
      validateLayout(layoutWith([{ ...createLineElement("l"), thicknessPt: 9 }])),
    ).toMatch(/espessura/);
  });
});

describe("desenho vindo da API", () => {
  const template: PrescriptionTemplate = {
    headerHeightMm: 30,
    footerHeightMm: 20,
    version: 3,
    updatedAtUtc: "2026-11-01T12:00:00Z",
    elements: [
      {
        id: "t",
        zone: "Header",
        kind: "Text",
        xMm: 20,
        yMm: 4,
        widthMm: 90,
        heightMm: null,
        text: "{{clinic.name}}",
        fontFamily: null,
        fontSizePt: 12,
        bold: true,
        italic: false,
        colorHex: "#16283A",
        align: null,
        thicknessPt: null,
        imageId: null,
      },
    ],
  };

  test("completa os padrões do tipo e compara sem diferença de arredondamento", () => {
    const layout = layoutFromTemplate(template);
    expect(layout.elements[0]).toMatchObject({ fontFamily: "Lato", align: "Left" });
    const nudged = {
      ...layout,
      elements: [{ ...layout.elements[0], xMm: 20.0001, colorHex: "#16283a" }],
    };
    expect(sameLayout(layout, nudged)).toBe(true);
    expect(sameLayout(layout, { ...layout, headerHeightMm: 31 })).toBe(false);
    expect(sameLayout(null, null)).toBe(true);
    expect(sameLayout(layout, null)).toBe(false);
  });

  test("nomeia o bloco pela forma legível do texto", () => {
    expect(elementListLabel(layoutFromTemplate(template).elements[0])).toBe("{Nome da clínica}");
    expect(elementListLabel({ ...createTextElement("v"), text: "  " })).toBe("Texto vazio");
    expect(elementListLabel(createLineElement("l"))).toBe("Linha");
  });
});

describe("arquivo de imagem", () => {
  test("aceita PNG e JPEG até 2 MB", () => {
    expect(validateImageFile(new File(["x"], "logo.png", { type: "image/png" }))).toBeNull();
    expect(validateImageFile(new File(["x"], "logo.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateImageFile(new File(["x"], "logo.gif", { type: "image/gif" }))).toBe(
      "Envie uma imagem PNG ou JPEG.",
    );
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    expect(validateImageFile(big)).toBe("A imagem tem mais de 2 MB. Reduza o arquivo e tente de novo.");
  });
});

describe("margens do conteúdo", () => {
  test("sem margens na resposta (API anterior), o editor assume as que o PDF sempre usou", () => {
    const base = { version: 1, updatedAtUtc: "2026-11-18T12:00:00Z", elements: [] };
    expect(layoutFromTemplate({ ...base, headerHeightMm: 40, footerHeightMm: 22 })).toMatchObject({
      contentMarginLeftMm: 20,
      contentMarginRightMm: 20,
      contentMarginTopMm: 6,
      contentMarginBottomMm: 4,
    });
    // Sem cabeçalho ou rodapé desenhado, o corpo mantém a distância da borda da folha.
    expect(layoutFromTemplate({ ...base, headerHeightMm: 0, footerHeightMm: 0 })).toMatchObject({
      contentMarginTopMm: 20,
      contentMarginBottomMm: 16,
    });
    expect(
      layoutFromTemplate({
        ...base,
        headerHeightMm: 40,
        footerHeightMm: 22,
        contentMarginLeftMm: 35,
        contentMarginTopMm: 0,
      }),
    ).toMatchObject({ contentMarginLeftMm: 35, contentMarginRightMm: 20, contentMarginTopMm: 0 });
  });

  test("mudar uma margem conta como alteração do desenho", () => {
    const layout = layoutWith([]);
    expect(sameLayout(layout, { ...layout })).toBe(true);
    expect(sameLayout(layout, { ...layout, contentMarginRightMm: 25 })).toBe(false);
  });

  test("recusa margens fora dos limites e conteúdo colado na borda da folha", () => {
    const layout = layoutWith([]);
    expect(validateLayout({ ...layout, contentMarginLeftMm: 4 })).toMatch(/entre 0,5 e 6 cm/);
    expect(validateLayout({ ...layout, contentMarginRightMm: 61 })).toMatch(/entre 0,5 e 6 cm/);
    expect(validateLayout({ ...layout, contentMarginTopMm: 51 })).toMatch(/entre 0 e 5 cm/);
    expect(validateLayout({ ...layout, contentMarginBottomMm: -1 })).toMatch(/entre 0 e 5 cm/);
    expect(validateLayout({ ...layoutWith([], 0, 20), contentMarginTopMm: 3 })).toMatch(
      /pelo menos 0,5 cm do topo e da base/,
    );
    expect(validateLayout({ ...layout, contentMarginTopMm: 0 })).toBeNull();
  });
});
