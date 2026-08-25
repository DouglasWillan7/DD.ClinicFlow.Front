import { expect, test } from "@playwright/test";

const currentSession = {
  userId: "user-1",
  name: "Ana Martins",
  email: "a***@exemplo.com",
  phone: "+55******1234",
  clinicId: "clinic-centro",
  clinicName: "Clínica Centro",
  userClinicId: "uc-centro",
  clinicRole: "Secretary",
  isAdmin: false,
  roles: ["Secretary"],
  availableClinics: [
    {
      userClinicId: "uc-centro",
      clinicId: "clinic-centro",
      clinicName: "Clínica Centro",
      role: "Secretary",
      isAdmin: false,
    },
    {
      userClinicId: "uc-norte",
      clinicId: "clinic-norte",
      clinicName: "Clínica Norte",
      role: "Nurse",
      isAdmin: true,
    },
  ],
  tokens: {
    accessToken: "access-centro",
    refreshToken: "refresh-centro",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};

test("troca o contexto pelo menu da conta sem vazar o estado anterior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(session));
    window.sessionStorage.setItem("clinicflow.scoped.draft", "clinic-centro-draft");
  }, currentSession);

  await page.route("**/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: "user-1",
        name: "Ana Martins",
        email: "a***@exemplo.com",
        roles: ["Secretary"],
        medicalLicense: null,
        medicalLicenseState: null,
        specialty: null,
      }),
    });
  });
  await page.route("**/auth/v2/switch-clinic", async (route) => {
    expect(await route.request().postDataJSON()).toEqual({
      refreshToken: "refresh-centro",
      userClinicId: "uc-norte",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "authenticated",
        accessToken: "access-norte",
        refreshToken: "refresh-norte",
        accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
        user: { id: "user-1", name: "Ana Martins" },
        clinicContext: {
          userClinicId: "uc-norte",
          clinicId: "clinic-norte",
          clinicName: "Clínica Norte",
          role: "Nurse",
          isAdmin: true,
          email: "a***@norte.test",
          phone: "+55******5678",
        },
      }),
    });
  });

  await page.goto("/app/configuracoes/perfil");
  await expect(page.getByLabel("E-mail nesta clínica")).toBeVisible();
  await expect(page.getByText("O acesso usa seu documento.", { exact: false })).toBeVisible();
  await expect(page.getByText(/e-mail é a credencial/i)).toHaveCount(0);
  const account = page.getByRole("button", {
    name: "Ana Martins, Clínica Centro, Secretaria",
  });
  await expect(account).toBeVisible();
  await account.click();

  const target = page.getByRole("button", {
    name: "Clínica Norte, Enfermagem, Administração",
  });
  await expect(target).toBeFocused();
  expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: "/private/tmp/clinicflow-context-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/app\/agenda$/);
  await expect(page.getByRole("button", {
    name: "Ana Martins, Clínica Norte, Enfermagem, Administração",
  })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("clinicflow.scoped.draft"))).toBeNull();
  const stored = await page.evaluate(() => sessionStorage.getItem("clinicflow.session"));
  expect(stored).toContain("refresh-norte");
  expect(stored).not.toContain("refresh-centro");
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
