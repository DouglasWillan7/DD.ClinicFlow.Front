import { expect, test, type Locator, type Page } from "@playwright/test";

const session = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  phone: "+5511988887777",
  clinicId: "22222222-2222-2222-2222-222222222222",
  clinicName: "Clínica Vital",
  userClinicId: "uc-secretary",
  clinicRole: "Secretary",
  isAdmin: true,
  roles: ["Admin", "Secretary"],
  name: "Ana Martins",
  availableClinics: [{
    userClinicId: "uc-secretary",
    clinicId: "22222222-2222-2222-2222-222222222222",
    clinicName: "Clínica Vital",
    role: "Secretary",
    isAdmin: true,
  }],
  tokens: {
    accessToken: "receituario-e2e-token",
    refreshToken: "receituario-e2e-refresh",
    accessTokenExpiresAtUtc: "2030-08-23T12:00:00Z",
  },
};

const clinic = {
  id: session.clinicId,
  name: "Clínica Vital",
  timeZoneId: "America/Sao_Paulo",
  phone: "+551130000000",
  address: "Rua das Flores, 100, São Paulo",
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: 10,
  createdAtUtc: "2026-07-01T12:00:00Z",
};

interface Layout {
  headerHeightMm: number;
  footerHeightMm: number;
  elements: Array<Record<string, unknown>>;
}

type SavedTemplate = Layout & { version: number; updatedAtUtc: string };

interface TemplateState {
  template: SavedTemplate | null;
  puts: Array<Layout & { expectedVersion: number | null }>;
  previews: Layout[];
  uploads: string[];
  deletes: number;
}

/** PNG de 40 × 20 px (proporção 2:1), gerado para o teste: não é imagem de paciente. */
const logoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR42mOwjv43IIhh1OJRi0ctHrV41OJRi0ctHrV45FgMAE6m7r1F9+eYAAAAAElFTkSuQmCC",
  "base64",
);

/**
 * API simulada: sem `initial`, a clínica começa no cabeçalho padrão (404); o PUT
 * devolve a versão seguinte e o envio de imagem devolve ids `img-upload-N`.
 */
async function mockReceituario(page: Page, initial: SavedTemplate | null = null) {
  const state: TemplateState = { template: initial, puts: [], previews: [], uploads: [], deletes: 0 };

  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/clinics/current") return route.fulfill({ status: 200, json: clinic });

    if (url.pathname === "/clinics/prescription-template") {
      if (method === "GET") {
        return state.template
          ? route.fulfill({ status: 200, json: state.template })
          : route.fulfill({ status: 404, json: { title: "Receituário não encontrado" } });
      }
      if (method === "DELETE") {
        state.deletes += 1;
        state.template = null;
        return route.fulfill({ status: 204 });
      }
      if (method === "PUT") {
        const body = request.postDataJSON();
        state.puts.push(body);
        const { expectedVersion, ...layout } = body;
        state.template = {
          ...layout,
          version: (expectedVersion ?? 0) + 1,
          updatedAtUtc: "2026-11-18T12:00:00Z",
        };
        return route.fulfill({ status: 200, json: state.template });
      }
    }

    if (url.pathname === "/clinics/prescription-template/images" && method === "POST") {
      const id = `img-upload-${state.uploads.length + 1}`;
      state.uploads.push(request.postDataBuffer()?.toString("latin1") ?? "");
      return route.fulfill({
        status: 201,
        json: { id, contentType: "image/png", sizeBytes: logoPng.length },
      });
    }

    if (url.pathname.startsWith("/clinics/prescription-template/images/") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "image/png", body: logoPng });
    }

    if (url.pathname === "/clinics/prescription-template/preview" && method === "POST") {
      state.previews.push(request.postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7\nprevia" });
    }

    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });

  return state;
}

async function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Alvos de toque fora da folha. Os blocos da folha têm o tamanho que terão no papel
 * (uma linha tem menos de 1 mm); a lista "Blocos" é o alvo equivalente de 44px.
 */
async function undersizedControls(page: Page) {
  return page
    .locator("main button:visible, main select:visible, main input:visible")
    .evaluateAll((controls) =>
      controls
        .filter((control) => !control.closest("[data-element-id]"))
        .map((control) => {
          const box = control.getBoundingClientRect();
          return {
            name:
              control.getAttribute("aria-label") ??
              control.textContent?.trim() ??
              control.getAttribute("id"),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })
        .filter((control) => control.width < 44 || control.height < 44),
    );
}

async function numberValue(field: Locator) {
  return Number(await field.inputValue());
}

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`monta o receituário, arrasta, move pelo teclado, salva e pede a prévia em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const state = await mockReceituario(page);
    await page.goto("/app/configuracoes/clinica/receituario");

    const tabs = page.getByRole("navigation", { name: "Configuração da clínica" });
    await expect(tabs.getByRole("link", { name: "Receituário" })).toHaveAttribute("aria-current", "page");
    expect(
      await tabs.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);

    // 1. Sem receituário: a clínica está no cabeçalho padrão.
    await expect(page.getByText("A clínica usa o cabeçalho padrão")).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Começar um receituário" }).click();

    const sheet = page.getByRole("group", { name: "Folha da receita em escala" });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole("region", { name: "Alterações não salvas" })).toBeVisible();

    // 2. Texto e campo automático entram no cabeçalho.
    await page.getByRole("button", { name: "Texto", exact: true }).click();
    await expect(sheet.getByRole("button", { name: "Texto no cabeçalho: Novo texto" })).toBeFocused();
    await page.getByLabel("Adicionar campo automático").selectOption({ label: "Nome da clínica" });
    const field = sheet.getByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" });
    await expect(field).toBeFocused();
    // Na folha o campo aparece com o valor de exemplo; no painel, na forma legível.
    // O campo mostra o nome real da clínica da sessão.
    await expect(field).toContainText("Clínica Vital");
    await expect(page.getByRole("textbox", { name: "Texto" })).toHaveValue("{Nome da clínica}");
    await expect(
      page.getByRole("list", { name: "Cabeçalho" }).getByRole("button"),
    ).toHaveCount(2);

    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    expect(await undersizedControls(page)).toEqual([]);

    // 3. Arrastar: só na horizontal, para a altura continuar previsível.
    const xField = page.getByRole("spinbutton", { name: "X (cm)" });
    const yField = page.getByRole("spinbutton", { name: "Y (cm)" });
    const startX = await numberValue(xField);
    const startY = await numberValue(yField);
    await field.scrollIntoViewIfNeeded();
    const box = (await field.boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    const pxPerMm = sheetBox.width / 210;
    await page.mouse.move(box.x + 6, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 6 + 15 * pxPerMm, box.y + box.height / 2, { steps: 6 });
    await page.mouse.move(box.x + 6 + 30 * pxPerMm, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const draggedX = await numberValue(xField);
    // 30 mm de arrasto, com folga para o arredondamento a 0,1 mm.
    expect(draggedX - startX).toBeGreaterThan(2.8);
    expect(draggedX - startX).toBeLessThan(3.2);
    expect(await numberValue(yField)).toBe(startY);

    // 4. Teclado: seta move 1 mm; com Shift, 5 mm.
    await expect(field).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(xField).toHaveValue(String(Math.round((draggedX + 0.1) * 100) / 100));
    await page.keyboard.press("Shift+ArrowDown");
    await expect(yField).toHaveValue(String(Math.round((startY + 0.5) * 100) / 100));

    // A lista de blocos seleciona sem ponteiro.
    await page.getByRole("list", { name: "Cabeçalho" }).getByRole("button", { name: /Novo texto/ }).click();
    await expect(page.getByRole("textbox", { name: "Texto" })).toHaveValue("Novo texto");

    await page.screenshot({
      path: `test-results/receituario-editor-${viewport.name}.png`,
      fullPage: true,
    });

    // 5. Salvar: o desenho vai com os campos na forma gravada e sem versão anterior.
    const putRequest = page.waitForRequest(
      (request) => request.url().endsWith("/clinics/prescription-template") && request.method() === "PUT",
    );
    await page.getByRole("button", { name: "Salvar receituário" }).click();
    await putRequest;
    await expect(page.getByText("Receituário salvo. As próximas receitas já saem com este desenho.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Alterações não salvas" })).toHaveCount(0);

    expect(state.puts).toHaveLength(1);
    const saved = state.puts[0];
    expect(saved).toMatchObject({ headerHeightMm: 30, footerHeightMm: 20, expectedVersion: null });
    expect(saved.elements).toHaveLength(2);
    expect(saved.elements[0]).toMatchObject({ zone: "Header", kind: "Text", text: "Novo texto", fontFamily: "Lato" });
    expect(saved.elements[1]).toMatchObject({
      zone: "Header",
      kind: "Text",
      text: "{{clinic.name}}",
      xMm: Math.round((draggedX + 0.1) * 100) / 10,
      yMm: Math.round((startY + 0.5) * 100) / 10,
    });
    // Depois de salvo, Restaurar padrão passa a existir.
    await expect(page.getByRole("button", { name: "Restaurar padrão" })).toBeVisible();

    // 6. Prévia: o desenho atual vai para a API e o PDF abre numa aba nova.
    const previewRequest = page.waitForRequest((request) =>
      request.url().endsWith("/clinics/prescription-template/preview"),
    );
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Prévia PDF" }).click();
    expect((await previewRequest).headers().authorization).toBe(`Bearer ${session.tokens.accessToken}`);
    const popup = await popupPromise;
    await expect.poll(() => popup.url()).toMatch(/^blob:/);
    await popup.close();
    expect(state.previews).toHaveLength(1);
    expect(state.previews[0].elements).toEqual(saved.elements);

    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/receituario-salvo-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("as margens do conteúdo são ajustadas no painel, movem o corpo na folha e vão no salvar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await mockReceituario(page);
  await page.goto("/app/configuracoes/clinica/receituario");
  await page.getByRole("button", { name: "Começar um receituário" }).click();

  const sheet = page.getByRole("group", { name: "Folha da receita em escala" });
  const sheetBox = (await sheet.boundingBox())!;
  const pxPerMm = sheetBox.width / 210;
  const title = sheet.getByText("Receita médica");
  const leftMm = async () => ((await title.boundingBox())!.x - sheetBox.x) / pxPerMm;
  expect(await leftMm()).toBeCloseTo(20, 0);

  const left = page.getByRole("spinbutton", { name: "Esquerda (cm)" });
  await expect(left).toHaveValue("2");
  await left.fill("4");
  await left.blur();
  expect(await leftMm()).toBeCloseTo(40, 0);

  // Fora do limite, o campo volta ao máximo aceito pela API.
  const right = page.getByRole("spinbutton", { name: "Direita (cm)" });
  await right.fill("9");
  await right.blur();
  await expect(right).toHaveValue("6");
  await page.getByRole("spinbutton", { name: "Acima (cm)" }).fill("1.5");
  await page.getByRole("spinbutton", { name: "Abaixo (cm)" }).fill("2");

  await page.getByRole("button", { name: "Salvar receituário" }).click();
  await expect(page.getByRole("region", { name: "Alterações não salvas" })).toHaveCount(0);
  expect(state.puts[0]).toMatchObject({
    contentMarginLeftMm: 40,
    contentMarginRightMm: 60,
    contentMarginTopMm: 15,
    contentMarginBottomMm: 20,
  });
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
});

test("em 960px folha e painel ficam lado a lado sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await mockReceituario(page);
  await page.goto("/app/configuracoes/clinica/receituario");
  await page.getByRole("button", { name: "Partir do exemplo" }).click();

  const sheet = page.getByRole("group", { name: "Folha da receita em escala" });
  await expect(sheet.getByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" })).toBeVisible();
  const sheetBox = (await sheet.boundingBox())!;
  const inspectorBox = (await page.getByRole("region", { name: "Página" }).boundingBox())!;
  expect(inspectorBox.x).toBeGreaterThan(sheetBox.x + sheetBox.width);
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  expect(await undersizedControls(page)).toEqual([]);

  // A alça da divisa muda a altura do cabeçalho pelo teclado.
  const grip = page.getByRole("slider", { name: "Altura do cabeçalho" });
  await grip.focus();
  await page.keyboard.press("ArrowDown");
  await expect(grip).toHaveAttribute("aria-valuenow", "41");
  await expect(page.getByRole("spinbutton", { name: "Altura do cabeçalho (cm)" })).toHaveValue("4.1");

  await page.screenshot({ path: "test-results/receituario-exemplo-960.png", fullPage: true });
});

test("abre o receituário salvo com logotipo, envia outra imagem e restaura o padrão", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await mockReceituario(page, {
    headerHeightMm: 36,
    footerHeightMm: 18,
    version: 4,
    updatedAtUtc: "2026-11-10T12:00:00Z",
    elements: [
      {
        id: "logo", zone: "Header", kind: "Image", xMm: 20, yMm: 6, widthMm: 40, heightMm: 20,
        text: null, fontFamily: null, fontSizePt: null, bold: false, italic: false,
        colorHex: null, align: null, thicknessPt: null, imageId: "img-saved",
      },
      {
        id: "nome", zone: "Header", kind: "Text", xMm: 66, yMm: 10, widthMm: 120, heightMm: null,
        text: "{{clinic.name}}", fontFamily: "Lora", fontSizePt: 18, bold: true, italic: false,
        colorHex: "#16283a", align: "Left", thicknessPt: null, imageId: null,
      },
    ],
  });
  await page.goto("/app/configuracoes/clinica/receituario");

  const sheet = page.getByRole("group", { name: "Folha da receita em escala" });
  const images = sheet.getByRole("button", { name: "Imagem no cabeçalho: Imagem" });
  await expect(images).toHaveCount(1);
  // A imagem salva vem da API autenticada e aparece como object URL.
  const savedImage = images.first().locator("img");
  await expect(savedImage).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => savedImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(40);
  await expect(page.getByRole("region", { name: "Alterações não salvas" })).toHaveCount(0);

  // Enviar uma imagem: vai para a API na hora e entra na folha com a proporção do arquivo.
  await page.getByRole("button", { name: "Rodapé", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Imagem", exact: true }).click();
  await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: logoPng });
  const footerImage = sheet.getByRole("button", { name: "Imagem no rodapé: Imagem" });
  await expect(footerImage).toBeFocused();
  await expect(footerImage.locator("img")).toHaveAttribute("src", /^blob:/);
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0]).toContain('name="file"');
  await expect(page.getByRole("spinbutton", { name: "Largura (cm)" })).toHaveValue("3");
  const footerBox = (await footerImage.boundingBox())!;
  expect(footerBox.width / footerBox.height).toBeCloseTo(2, 1);
  await expect(page.getByRole("region", { name: "Alterações não salvas" })).toBeVisible();

  await page.screenshot({ path: "test-results/receituario-imagens-desktop.png", fullPage: true });

  // Restaurar padrão pede confirmação e apaga o receituário na API.
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Restaurar o cabeçalho padrão?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Restaurar padrão" }).click();
  await expect(dialog).toBeHidden();
  expect(state.deletes).toBe(1);
  await expect(page.getByText("A clínica usa o cabeçalho padrão")).toBeVisible();
  await expect(page.getByRole("region", { name: "Alterações não salvas" })).toHaveCount(0);
  expect(state.puts).toHaveLength(0);
});

test.describe("toque", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("arrasta um bloco e a divisa com o dedo", async ({ page }) => {
    await mockReceituario(page);
    await page.goto("/app/configuracoes/clinica/receituario");
    await page.getByRole("button", { name: "Partir do exemplo" }).click();
    const sheet = page.getByRole("group", { name: "Folha da receita em escala" });
    const field = sheet.getByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" });
    await field.scrollIntoViewIfNeeded();
    const box = (await field.boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    const scale = sheetBox.width / 210;
    const client = await page.context().newCDPSession(page);
    const x = box.x + 8;
    const y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (step * 20 * scale) / 8, y: y + (step * 5 * scale) / 8 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("spinbutton", { name: "X (cm)" })).toHaveValue("4");
    await expect(page.getByRole("spinbutton", { name: "Y (cm)" })).toHaveValue("1.4");
    const scrollY = await page.evaluate(() => window.scrollY);

    // Alça da divisa do cabeçalho: 6 mm para baixo.
    const grip = sheet.getByRole("slider", { name: "Altura do cabeçalho" });
    const gripBox = (await grip.boundingBox())!;
    const gx = gripBox.x + gripBox.width / 2;
    const gy = gripBox.y + gripBox.height / 2;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gx, y: gy }] });
    for (let step = 1; step <= 6; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: gx, y: gy + step * scale }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(grip).toHaveAttribute("aria-valuenow", "46");
    // O arrasto não rolou a página.
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });
});
