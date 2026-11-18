import { expect, test, type Page } from "@playwright/test";

const session = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  phone: "+5511988887777",
  clinicId: "22222222-2222-2222-2222-222222222222",
  clinicName: "Clínica Vital",
  userClinicId: "uc-doctor",
  clinicRole: "Doctor",
  isAdmin: false,
  roles: ["Doctor"],
  name: "Ana Martins",
  availableClinics: [{
    userClinicId: "uc-doctor",
    clinicId: "22222222-2222-2222-2222-222222222222",
    clinicName: "Clínica Vital",
    role: "Doctor",
    isAdmin: false,
  }],
  tokens: {
    accessToken: "receitas-e2e-token",
    refreshToken: "receitas-e2e-refresh",
    accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
  },
};

const patientId = "60000000-0000-4000-8000-000000000001";
const issuedId = "70000000-0000-4000-8000-000000000001";
const cancelledId = "70000000-0000-4000-8000-000000000002";

const patient = {
  id: patientId,
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "41288755601",
  name: "Mohammad Jaber Abdullah",
  phone: "+5511999990000",
  email: null,
  medicalRecordNumber: 10001,
  bloodType: null,
  birthDate: "1984-03-12",
  notes: null,
  isActive: true,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

interface Prescription {
  id: string;
  patientId: string;
  content: string;
  status: "Issued" | "Cancelled";
  version: number;
  issuedAtUtc: string;
  issuedByUserId: string;
  issuedByName: string;
  issuedByRegistration: string | null;
  cancelledAtUtc: string | null;
  cancelledByUserId: string | null;
  capabilities: { canCancel: boolean };
}

const issuedContent = "Amoxicilina 500 mg\nTomar 1 cápsula de 8 em 8 horas por 7 dias.\n\nUso oral.";

function initialPrescriptions(): Prescription[] {
  return [
    {
      id: issuedId,
      patientId,
      content: issuedContent,
      status: "Issued",
      version: 1,
      issuedAtUtc: "2026-08-12T17:30:00Z",
      issuedByUserId: session.userId,
      issuedByName: "Dra. Ana Martins",
      issuedByRegistration: "CRM-SP 123456",
      cancelledAtUtc: null,
      cancelledByUserId: null,
      capabilities: { canCancel: true },
    },
    {
      id: cancelledId,
      patientId,
      content: "Dipirona 500 mg\nTomar 1 comprimido se dor.",
      status: "Cancelled",
      version: 2,
      issuedAtUtc: "2026-07-01T13:00:00Z",
      issuedByUserId: "33333333-3333-3333-3333-333333333333",
      issuedByName: "Dr. Bruno Lima",
      issuedByRegistration: null,
      cancelledAtUtc: "2026-07-02T12:15:00Z",
      cancelledByUserId: "33333333-3333-3333-3333-333333333333",
      capabilities: { canCancel: false },
    },
  ];
}

async function mockReceitas(page: Page) {
  const state = {
    items: initialPrescriptions(),
    writes: [] as Array<{ method: string; path: string; body: unknown }>,
    issued: 0,
  };

  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/clinics/current") {
      return route.fulfill({ status: 200, json: {
        id: session.clinicId,
        name: "Clínica Vital",
        timeZoneId: "America/Sao_Paulo",
        phone: null,
        address: null,
        plan: "Clinic",
        subscriptionStatus: "Active",
        maxDoctors: null,
        createdAtUtc: "2026-07-01T12:00:00Z",
      } });
    }
    if (url.pathname === `/patients/${patientId}`) {
      return route.fulfill({ status: 200, json: patient });
    }
    if (url.pathname === "/users/me") {
      return route.fulfill({ status: 200, json: {
        userId: session.userId,
        email: session.email,
        phone: session.phone,
        name: session.name,
        role: session.clinicRole,
        isAdmin: session.isAdmin,
        medicalLicense: null,
        medicalLicenseState: null,
        specialty: null,
      } });
    }
    if (url.pathname === `/prescriptions/patients/${patientId}` && method === "GET") {
      return route.fulfill({ status: 200, json: { items: state.items, capabilities: { canIssue: true } } });
    }
    if (url.pathname === `/prescriptions/patients/${patientId}` && method === "POST") {
      const body = request.postDataJSON() as { content: string };
      state.writes.push({ method, path: url.pathname, body });
      state.issued += 1;
      const created: Prescription = {
        ...initialPrescriptions()[0],
        id: `70000000-0000-4000-8000-00000000010${state.issued}`,
        content: body.content,
        issuedAtUtc: `2026-08-20T1${state.issued}:00:00Z`,
      };
      state.items = [created, ...state.items];
      return route.fulfill({ status: 201, json: created });
    }

    const match = url.pathname.match(/^\/prescriptions\/([0-9a-f-]+)\/(cancel|document)$/i);
    if (match) {
      const current = state.items.find((item) => item.id === match[1]);
      if (!current) return route.fulfill({ status: 404, json: { title: "Receita não encontrada" } });
      if (match[2] === "document" && method === "GET") {
        if (current.status === "Cancelled") {
          return route.fulfill({ status: 409, json: { title: "Receita cancelada" } });
        }
        return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7\nreceita" });
      }
      if (match[2] === "cancel" && method === "POST") {
        const body = request.postDataJSON() as { expectedVersion: number };
        state.writes.push({ method, path: url.pathname, body });
        if (body.expectedVersion !== current.version) {
          return route.fulfill({ status: 409, json: { title: "A receita foi alterada." } });
        }
        const cancelled: Prescription = {
          ...current,
          status: "Cancelled",
          version: current.version + 1,
          cancelledAtUtc: "2026-08-20T15:00:00Z",
          cancelledByUserId: session.userId,
          capabilities: { canCancel: false },
        };
        state.items = state.items.map((item) => (item.id === cancelled.id ? cancelled : item));
        return route.fulfill({ status: 200, json: cancelled });
      }
    }

    return route.fulfill({ status: 200, json: [] });
  });

  return state;
}

async function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function undersizedButtons(page: Page) {
  return page.locator("main button:visible").evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const box = button.getBoundingClientRect();
        return {
          name: button.getAttribute("aria-label") ?? button.textContent?.trim(),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((button) => button.width < 44 || button.height < 44),
  );
}

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`emite, abre o PDF, usa como base e cancela em ${viewport.width}px`, async ({ page }) => {
    const mobile = viewport.width < 960;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const state = await mockReceitas(page);
    await page.goto(`/app/pacientes/${patientId}/receitas`);

    await expect(page.getByText("2 receitas")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Seções do paciente" }).getByRole("link", { name: "Receitas" }),
    ).toHaveAttribute("aria-current", "page");
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    expect(
      await page
        .getByRole("navigation", { name: "Seções do paciente" })
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(await undersizedButtons(page)).toEqual([]);

    const history = page.getByRole("list", { name: "Histórico de receitas" });
    const backToList = page.getByRole("button", { name: "Voltar às receitas" });

    // 1. Emitir do zero.
    await page.getByRole("button", { name: "Nova receita" }).click();
    let composer = page.getByRole("dialog", { name: "Nova receita" });
    await expect(composer).toBeVisible();
    await expect(composer.getByText("Depois de emitida, a receita não pode ser editada.")).toBeVisible();
    await expect(page).toHaveURL(/acao=nova/);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    expect(await undersizedButtons(page)).toEqual([]);
    await composer.getByRole("textbox", { name: "Texto da receita" }).fill("Losartana 50 mg\n1 comprimido pela manhã.");
    await composer.getByRole("button", { name: "Emitir receita" }).click();

    await expect(composer).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Receita emitida." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Receita de 20/08/2026" })).toBeVisible();
    await expect(page).toHaveURL(/receita=70000000-0000-4000-8000-000000000101/);
    expect(state.writes[0]).toEqual({
      method: "POST",
      path: `/prescriptions/patients/${patientId}`,
      body: { content: "Losartana 50 mg\n1 comprimido pela manhã." },
    });

    // 2. Abrir o PDF da receita original, autenticado, numa aba nova.
    if (mobile) await backToList.click();
    // 14:30 em São Paulo: a receita original, emitida antes das de hoje.
    const originalRow = history.getByRole("button", { name: /12\/08\/2026, 14:30/ });
    await originalRow.click();
    const detail = page.getByRole("article", { name: "Receita de 12/08/2026" });
    await expect(detail).toBeVisible();
    // As quebras de linha digitadas aparecem como linhas separadas (quatro linhas).
    const contentBox = await detail
      .getByRole("region", { name: "Texto da receita" })
      .locator("div")
      .boundingBox();
    expect(contentBox!.height).toBeGreaterThan(60);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    expect(await undersizedButtons(page)).toEqual([]);

    const pdfRequest = page.waitForRequest((request) => request.url().endsWith(`/prescriptions/${issuedId}/document`));
    const popupPromise = page.waitForEvent("popup");
    await detail.getByRole("button", { name: "Abrir PDF" }).click();
    expect((await pdfRequest).headers().authorization).toBe(`Bearer ${session.tokens.accessToken}`);
    const popup = await popupPromise;
    await expect.poll(() => popup.url()).toMatch(/^blob:/);
    await popup.close();

    // 3. Usar como base: o texto vem copiado e a emissão cria outra receita.
    await detail.getByRole("button", { name: "Usar como base" }).click();
    composer = page.getByRole("dialog", { name: "Nova receita" });
    const field = composer.getByRole("textbox", { name: "Texto da receita" });
    await expect(field).toHaveValue(issuedContent);
    await expect(page).toHaveURL(new RegExp(`base=${issuedId}`));
    await field.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(element.value.length, element.value.length);
    });
    await field.pressSequentially("\nRetorno em 7 dias.");
    await composer.getByRole("button", { name: "Emitir receita" }).click();

    await expect(composer).toBeHidden();
    await expect(page).toHaveURL(/receita=70000000-0000-4000-8000-000000000102/);
    expect(state.writes[1]).toEqual({
      method: "POST",
      path: `/prescriptions/patients/${patientId}`,
      body: { content: `${issuedContent}\nRetorno em 7 dias.` },
    });
    // A original não recebeu nenhuma escrita.
    expect(state.items.find((item) => item.id === issuedId)?.content).toBe(issuedContent);

    // 4. Cancelar a original: continua no histórico, marcada como cancelada.
    if (mobile) await backToList.click();
    await expect(history.getByRole("listitem")).toHaveCount(4);
    await originalRow.click();
    await detail.getByRole("button", { name: "Cancelar receita" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Cancelar esta receita?" });
    await expect(confirm).toBeVisible();
    // A opção segura recebe o foco: Enter por engano mantém a receita.
    await expect(confirm.getByRole("button", { name: "Manter receita" })).toBeFocused();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    await confirm.getByRole("button", { name: "Cancelar receita" }).click();

    await expect(confirm).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Receita cancelada." })).toBeVisible();
    await expect(detail.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Abrir PDF" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Cancelar receita" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Usar como base" })).toBeVisible();
    expect(state.writes[2]).toEqual({
      method: "POST",
      path: `/prescriptions/${issuedId}/cancel`,
      body: { expectedVersion: 1 },
    });
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-results/receitas-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("fechar o formulário com texto digitado pede confirmação e preserva o texto", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockReceitas(page);
  await page.goto(`/app/pacientes/${patientId}/receitas?acao=nova`);

  const composer = page.getByRole("dialog", { name: "Nova receita" });
  const field = composer.getByRole("textbox", { name: "Texto da receita" });
  await expect(field).toBeFocused();
  await field.fill("Losartana 50 mg");
  await page.keyboard.press("Escape");

  const discard = page.getByRole("dialog", { name: "Descartar alterações?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Continuar editando" }).click();

  // O <dialog> nativo continua aberto: recusar o fechamento não o esconde.
  await expect(discard).toBeHidden();
  await expect(composer).toBeVisible();
  await expect(field).toHaveValue("Losartana 50 mg");

  await composer.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("dialog", { name: "Descartar alterações?" }).getByRole("button", { name: "Descartar alterações" }).click();
  await expect(composer).toBeHidden();
  await expect(page).not.toHaveURL(/acao=nova/);
});
