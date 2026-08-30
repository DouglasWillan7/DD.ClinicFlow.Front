import { expect, test, type Page, type Request } from "@playwright/test";

const reference = "opaque-invitation-reference";
const publicBase = "/public/clinic-membership-invitations";

const newIdentityView = {
  clinicName: "Clínica Horizonte",
  inviteeName: "Dra. Helena Costa",
  role: "Doctor",
  emailMasked: "he***@exemplo.com",
  expiresAtUtc: "2099-08-31T12:00:00Z",
  mode: "SetInitialPassword",
};

const invitationSession = {
  kind: "authenticated",
  accessToken: "invitation-access",
  refreshToken: "invitation-refresh",
  accessTokenExpiresAtUtc: "2099-09-01T12:00:00Z",
  user: { id: "invited-user", name: "Dra. Helena Costa" },
  clinicContext: {
    userClinicId: "invited-membership",
    clinicId: "clinic-horizonte",
    clinicName: "Clínica Horizonte",
    role: "Doctor",
    isAdmin: false,
    email: "helena@exemplo.com",
    phone: "+5511999990000",
  },
};

const wrongSession = {
  userId: "wrong-user",
  name: "Outra pessoa",
  email: "outra@clinica.test",
  phone: "+5511988880000",
  clinicId: "clinic-current",
  clinicName: "Clínica Atual",
  userClinicId: "current-membership",
  clinicRole: "Doctor",
  isAdmin: false,
  roles: ["Doctor"],
  availableClinics: [
    {
      userClinicId: "current-membership",
      clinicId: "clinic-current",
      clinicName: "Clínica Atual",
      role: "Doctor",
      isAdmin: false,
    },
  ],
  tokens: {
    accessToken: "wrong-access",
    refreshToken: "wrong-refresh",
    accessTokenExpiresAtUtc: "2099-09-01T12:00:00Z",
  },
};

async function fulfillJson(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockOnboarding(page: Page) {
  await page.route("**/onboarding/status", async (route) => {
    await fulfillJson(route, {
      completed: false,
      completedCount: 0,
      totalCount: 0,
      steps: [],
    });
  });
}

async function postBody(request: Request) {
  return request.postDataJSON() as Record<string, unknown>;
}

test("médico novo ativa a conta sem colocar a referência na URL da API", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockOnboarding(page);
  let acceptedBody: Record<string, unknown> | null = null;
  let acceptedUrl = "";
  await page.route("**/public/clinic-membership-invitations/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith(`${publicBase}/resolve`)) {
      expect(await postBody(request)).toEqual({ reference });
      await fulfillJson(route, newIdentityView);
      return;
    }
    acceptedUrl = request.url();
    acceptedBody = await postBody(request);
    await fulfillJson(route, { outcome: "Accepted", session: invitationSession });
  });

  await page.goto(`/convite-medico/${reference}`);
  await expect(
    page.getByRole("heading", { name: "Ative seu acesso à clínica" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-invitation-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Crie sua senha").fill("Senha123!");
  await page.getByLabel("Confirme sua senha").fill("Senha123!");
  await page.getByRole("button", { name: "Ativar meu acesso" }).click();

  await expect(page).toHaveURL(/\/app\/onboarding$/);
  expect(acceptedUrl).toContain(`${publicBase}/accept-new`);
  expect(acceptedUrl).not.toContain(reference);
  expect(acceptedBody).toEqual({ reference, password: "Senha123!" });
  const persisted = await page.evaluate(() =>
    window.localStorage.getItem("clinicflow.session"),
  );
  expect(persisted).toContain('"accessToken":"invitation-access"');
  expect(persisted).not.toContain(reference);
  expect(persisted).not.toContain("Senha123!");
});

test("conta existente aceita com a senha atual sem alterar a credencial", async ({
  page,
}) => {
  await mockOnboarding(page);
  let acceptedBody: Record<string, unknown> | null = null;
  await page.route("**/public/clinic-membership-invitations/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith(`${publicBase}/resolve`)) {
      await fulfillJson(route, {
        ...newIdentityView,
        mode: "AuthenticateExistingAccount",
      });
      return;
    }
    acceptedBody = await postBody(request);
    await fulfillJson(route, { outcome: "Accepted", session: invitationSession });
  });

  await page.goto(`/convite-medico/${reference}`);
  await page.getByLabel("Senha atual").fill("Atual123!");
  await page.getByRole("button", { name: "Aceitar convite" }).click();

  await expect(page).toHaveURL(/\/app\/onboarding$/);
  expect(acceptedBody).toEqual({ reference, currentPassword: "Atual123!" });
  const persisted = await page.evaluate(() =>
    window.localStorage.getItem("clinicflow.session"),
  );
  expect(persisted).not.toContain("Atual123!");
});

test("sessão de outra identidade é explicada e pode ser encerrada", async ({ page }) => {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, wrongSession);
  await page.route("**/auth/v2/logout", async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.route("**/public/clinic-membership-invitations/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith(`${publicBase}/resolve`)) {
      await fulfillJson(route, {
        ...newIdentityView,
        mode: "AuthenticateExistingAccount",
      });
      return;
    }
    expect(request.headers().authorization).toBe("Bearer wrong-access");
    await fulfillJson(route, { status: "forbidden" }, 403);
  });

  await page.goto(`/convite-medico/${reference}`);
  await page.getByRole("button", { name: "Aceitar convite" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Este convite pertence a outra conta.",
  );
  await page
    .getByRole("button", { name: "Sair e usar a conta convidada" })
    .click();
  await expect(page.getByLabel("Senha atual")).toBeVisible();
  expect(
    await page.evaluate(() => window.sessionStorage.getItem("clinicflow.session")),
  ).toBeNull();
});

test("convite expirado permanece terminal e não oferece ativação", async ({ page }) => {
  await page.route("**/public/clinic-membership-invitations/resolve", async (route) => {
    await fulfillJson(route, { ...newIdentityView, mode: "Expired" });
  });

  await page.goto(`/convite-medico/${reference}`);

  await expect(
    page.getByRole("status", { name: "Este convite expirou" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Ativar|Aceitar/ })).toHaveCount(0);
});

test("layout mobile mantém formulário, alvos e conteúdo sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/public/clinic-membership-invitations/resolve", async (route) => {
    await fulfillJson(route, newIdentityView);
  });

  await page.goto(`/convite-medico/${reference}`);
  await expect(
    page.getByRole("heading", { name: "Ative seu acesso à clínica" }),
  ).toBeVisible();

  for (const target of [
    page.getByLabel("Crie sua senha"),
    page.getByLabel("Confirme sua senha"),
    page.getByRole("button", { name: "Mostrar senha" }),
    page.getByRole("button", { name: "Ativar meu acesso" }),
  ]) {
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({
    path: "/private/tmp/clinicflow-invitation-mobile.png",
    fullPage: true,
  });
});

test("teclado percorre senha, privacidade e conclusão do convite", async ({ page }) => {
  await page.route("**/public/clinic-membership-invitations/**", async (route) => {
    if (route.request().url().endsWith(`${publicBase}/resolve`)) {
      await fulfillJson(route, newIdentityView);
      return;
    }
    await fulfillJson(route, { outcome: "AlreadyAccepted", session: null });
  });

  await page.goto(`/convite-medico/${reference}`);
  const password = page.getByLabel("Crie sua senha");
  await password.focus();
  await page.keyboard.type("Senha123!");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Confirme sua senha")).toBeFocused();
  await page.keyboard.type("Senha123!");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Mostrar senha" })).toBeFocused();
  await page.keyboard.press("Tab");
  const remember = page.getByRole("checkbox", { name: "Manter minha conexão" });
  await expect(remember).toBeFocused();
  await page.keyboard.press("Space");
  await expect(remember).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Ativar meu acesso" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/entrar$/);
});
