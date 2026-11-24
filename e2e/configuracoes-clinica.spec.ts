import { expect, test, type Page } from "@playwright/test";

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
    accessToken: "visual-test-token",
    refreshToken: "visual-test-refresh",
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

const pendingSteps = {
  completed: false,
  completedCount: 2,
  totalCount: 4,
  steps: [
    {
      code: "clinic",
      label: "Completar dados da clínica",
      path: "/app/configuracoes/clinica/dados",
      completed: true,
      blocked: false,
    },
    {
      code: "doctor",
      label: "Adicionar o primeiro médico",
      path: "/app/equipe/novo",
      completed: true,
      blocked: false,
    },
    {
      code: "schedule",
      label: "Configurar horários de atendimento",
      path: "/app/configuracoes/agenda",
      completed: false,
      blocked: false,
    },
    {
      code: "whatsapp",
      label: "Conectar as confirmações por WhatsApp",
      path: "/app/configuracoes/clinica/whatsapp",
      completed: false,
      blocked: false,
    },
  ],
};

const completedSteps = {
  ...pendingSteps,
  completed: true,
  completedCount: 4,
  steps: pendingSteps.steps.map((step) => ({ ...step, completed: true })),
};

async function mockClinicSettings(
  page: Page,
  options: { pendingSteps?: boolean } = {},
) {
  let currentClinic = clinic;

  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    const request = route.request();

    if (url.pathname === "/clinics/current") {
      if (request.method() === "PUT") {
        currentClinic = { ...currentClinic, ...request.postDataJSON() };
      }
      return route.fulfill({ status: 200, json: currentClinic });
    }

    if (url.pathname === "/onboarding/status") {
      return route.fulfill({
        status: 200,
        json: options.pendingSteps ? pendingSteps : completedSteps,
      });
    }

    if (url.pathname === "/clinics/whatsapp-config") {
      return route.fulfill({
        status: 200,
        json: {
          phoneNumberId: "123456789",
          templateName: "appointment_confirmation",
          enabled: true,
          hasToken: true,
          updatedAtUtc: "2026-07-01T12:00:00Z",
        },
      });
    }

    if (
      url.pathname === "/patients" ||
      url.pathname === `/clinics/${session.clinicId}/members/summary`
    ) {
      return route.fulfill({ status: 200, json: [] });
    }

    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });
}

test("telefone da clínica usa DDI, máscara e permanece responsivo", async ({
  page,
}) => {
  await mockClinicSettings(page);
  // Com tudo configurado, a entrada da configuração abre direto nos dados da clínica.
  await page.goto("/app/configuracoes/clinica");
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica\/dados$/);
  await expect(
    page
      .getByRole("navigation", { name: "Configuração da clínica" })
      .getByRole("link", { name: "Primeiros passos" }),
  ).toHaveCount(0);

  const phone = page.getByRole("textbox", { name: "Telefone", exact: true });
  const country = page.getByLabel("País ou região do telefone");

  await expect(phone).toHaveValue("(11) 3000-0000");
  await expect(country).toHaveValue("BR");
  await expect(page.getByText("🇧🇷", { exact: true })).toBeVisible();
  await expect(page.getByText("+55", { exact: true })).toBeVisible();

  await phone.fill("");
  await country.selectOption("PT");
  await phone.fill("912345678");
  await expect(phone).toHaveValue("912 345 678");
  const updateRequestPromise = page.waitForRequest(
    (request) =>
      request.url().endsWith("/clinics/current") && request.method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados atualizados.")).toBeVisible();

  const updateRequest = await updateRequestPromise;
  expect(updateRequest.postDataJSON()).toMatchObject({
    phone: "+351912345678",
  });

  await page.screenshot({
    path: "test-results/configuracoes-clinica-telefone-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const control = page.locator("[data-phone-control]");
  const controlBox = await control.boundingBox();
  const countryBox = await country.boundingBox();

  expect(controlBox).not.toBeNull();
  expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(390);
  expect(countryBox).not.toBeNull();
  expect(countryBox!.height).toBeGreaterThanOrEqual(44);

  await page.screenshot({
    path: "test-results/configuracoes-clinica-telefone-mobile.png",
    fullPage: true,
  });
});

test("WhatsApp é uma aba da configuração da clínica e o link antigo continua valendo", async ({
  page,
}) => {
  await mockClinicSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // O link antigo (que a API ainda devolve em "Primeiros passos") redireciona para a aba.
  await page.goto("/app/configuracoes/whatsapp");
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica\/whatsapp$/);

  const tabs = page.getByRole("navigation", { name: "Configuração da clínica" });
  await expect(tabs.getByRole("link", { name: "WhatsApp" }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Clínica", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Confirmações por WhatsApp", level: 2 }),
  ).toBeVisible();
  await expect(page.getByLabel("ID do número de telefone")).toHaveValue("123456789");

  // No menu lateral sobra um destino só: "Clínica", ativo também nesta aba.
  const rail = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(rail.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Clínica" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await tabs.getByRole("link", { name: "Dados da clínica" }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica\/dados$/);
  await expect(page.getByRole("heading", { name: "Clínica", level: 1 })).toBeVisible();

  await page.goto("/app/configuracoes/clinica/whatsapp");
  await expect(page.getByLabel("ID do número de telefone")).toHaveValue("123456789");
  await page.screenshot({
    path: "test-results/configuracoes-clinica-whatsapp-desktop.png",
    fullPage: true,
  });
});

test("primeiros passos são a entrada da configuração enquanto houver etapa pendente", async ({
  page,
}) => {
  await mockClinicSettings(page, { pendingSteps: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/agenda");

  // O menu lateral não tem mais o destino próprio: a lista mora dentro de "Clínica".
  const rail = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(rail.getByRole("link", { name: "Primeiros passos" })).toHaveCount(0);
  await rail.getByRole("link", { name: "Clínica" }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica$/);

  const tabs = page.getByRole("navigation", { name: "Configuração da clínica" });
  await expect(tabs.getByRole("link").first()).toHaveText("Primeiros passos");
  await expect(tabs.getByRole("link", { name: "Primeiros passos" }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByText("2 de 4 etapas concluídas")).toBeVisible();
  await expect(page.getByText("Cadastrar o primeiro paciente")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/configuracoes-clinica-primeiros-passos-desktop.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Conectar as confirmações por WhatsApp" }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica\/whatsapp$/);
  // A aba continua oferecida nas outras seções enquanto houver pendência.
  await expect(tabs.getByRole("link", { name: "Primeiros passos" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/configuracoes/clinica");
  await expect(page.getByText("2 de 4 etapas concluídas")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  // Cinco abas não cabem em 390px: a barra rola e os rótulos não se sobrepõem.
  const boxes = await tabs.getByRole("link").evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect();
      return { left: box.left, right: box.right, clipped: link.scrollWidth > link.clientWidth };
    }),
  );
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
  }
  expect(boxes.some((box) => box.clipped)).toBe(false);
  await page.screenshot({
    path: "test-results/configuracoes-clinica-primeiros-passos-mobile.png",
    fullPage: true,
  });

  // A última aba abre visível, sem ficar escondida à direita.
  await page.goto("/app/configuracoes/clinica/receituario");
  await expect(tabs.getByRole("link", { name: "Receituário" })).toBeInViewport({ ratio: 1 });
});
