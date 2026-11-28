import { expect, test } from "@playwright/test";

const clinicId = "22222222-2222-2222-2222-222222222222";
const doctorId = "33333333-3333-3333-3333-333333333333";
const session = {
  userId: doctorId,
  name: "Dra. Helena Costa",
  email: "helena@clinicavital.com.br",
  phone: "+5511988887777",
  clinicId,
  clinicName: "Clínica Vital",
  userClinicId: "uc-doctor-1",
  clinicRole: "Doctor",
  isAdmin: false,
  roles: ["Doctor"],
  availableClinics: [{
    userClinicId: "uc-doctor-1",
    clinicId,
    clinicName: "Clínica Vital",
    role: "Doctor",
    isAdmin: false,
  }],
  tokens: {
    accessToken: "visual-test-token",
    refreshToken: "visual-test-refresh",
    accessTokenExpiresAtUtc: "2030-08-25T12:00:00Z",
  },
};

test("o link antigo de disponibilidade leva o médico à aba de Meu perfil, também no celular", async ({ page }) => {
  let savedBody: Record<string, unknown> | undefined;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((value) => {
    window.localStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);
  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/users/me") {
      await route.fulfill({
        json: {
          userId: doctorId,
          email: session.email,
          phone: session.phone,
          name: session.name,
          role: "Doctor",
          isAdmin: false,
          medicalLicense: "12345",
          medicalLicenseState: "SP",
          specialty: "Gastroenterologia",
        },
      });
      return;
    }
    if (path === "/clinics/current") {
      await route.fulfill({
        json: {
          id: clinicId,
          name: "Clínica Vital",
          timeZoneId: "America/Sao_Paulo",
          phone: "+551130000000",
          address: "Rua das Flores, 100",
          plan: "Clinic",
          subscriptionStatus: "Active",
          maxDoctors: 10,
          createdAtUtc: "2026-08-01T12:00:00Z",
        },
      });
      return;
    }
    if (path === `/doctors/${doctorId}/schedule`) {
      if (request.method() === "PUT") {
        savedBody = request.postDataJSON();
        const body = savedBody as {
          defaultAppointmentDurationMinutes: number;
          intervals: Array<Record<string, string>>;
        };
        await route.fulfill({
          json: {
            doctorUserId: doctorId,
            slotDurationMinutes: body.defaultAppointmentDurationMinutes,
            intervals: body.intervals.map((interval, index) => ({
              id: `saved-${index}`,
              ...interval,
            })),
            blocks: [],
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          doctorUserId: doctorId,
          slotDurationMinutes: 30,
          intervals: [{
            id: "monday-morning",
            dayOfWeek: "Monday",
            startLocal: "08:00:00",
            endLocal: "12:00:00",
          }],
          blocks: [],
        },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { title: `Rota não simulada: ${path}` } });
  });

  // "Primeiros passos" ainda recebe este caminho da API.
  await page.goto("/app/configuracoes/agenda");

  await expect(page).toHaveURL(/\/app\/configuracoes\/perfil\/disponibilidade$/);
  await expect(page.getByRole("heading", { name: "Disponibilidade de atendimento" })).toBeVisible();
  await expect(page.getByLabel("Segunda-feira, período 1, início")).toHaveValue("08:00");
  await page.getByLabel("Terça-feira").check();
  await page.getByRole("button", { name: "Salvar disponibilidade" }).click();

  await expect(page.getByText("Disponibilidade atualizada.")).toBeVisible();
  expect(savedBody).toEqual({
    defaultAppointmentDurationMinutes: 30,
    intervals: [
      { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "12:00" },
    ],
  });
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({
    path: "/private/tmp/clinicflow-schedule-settings-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(rail).toBeVisible();
  // A disponibilidade não tem item próprio no menu lateral.
  await expect(rail.getByRole("link", { name: "Disponibilidade" })).toHaveCount(0);
  await page.screenshot({
    path: "/private/tmp/clinicflow-schedule-settings-desktop.png",
    fullPage: true,
  });
});

test("médico edita a própria disponibilidade na aba de Meu perfil", async ({ page }) => {
  let savedBody: Record<string, unknown> | undefined;
  await page.addInitScript((value) => {
    window.localStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);
  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/users/me") {
      await route.fulfill({
        json: {
          userId: doctorId,
          email: session.email,
          phone: session.phone,
          name: session.name,
          role: "Doctor",
          isAdmin: false,
          medicalLicense: "12345",
          medicalLicenseState: "SP",
          specialty: "Gastroenterologia",
        },
      });
      return;
    }
    if (path === "/clinics/current") {
      await route.fulfill({
        json: { id: clinicId, name: "Clínica Vital", timeZoneId: "America/Sao_Paulo" },
      });
      return;
    }
    if (path === `/doctors/${doctorId}/schedule`) {
      if (request.method() === "PUT") savedBody = request.postDataJSON();
      await route.fulfill({
        json: {
          doctorUserId: doctorId,
          slotDurationMinutes: 30,
          intervals: [
            {
              id: "monday-morning",
              dayOfWeek: "Monday",
              startLocal: "08:00:00",
              endLocal: "12:00:00",
            },
            ...(savedBody
              ? [{ id: "tuesday", dayOfWeek: "Tuesday", startLocal: "08:00:00", endLocal: "12:00:00" }]
              : []),
          ],
          blocks: [],
        },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { title: `Rota não simulada: ${path}` } });
  });

  await page.goto("/app/configuracoes/perfil");

  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Meu perfil" });
  await expect(tabs.getByRole("link", { name: "Conta" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await tabs.getByRole("link", { name: "Disponibilidade" }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/perfil\/disponibilidade$/);
  // O cabeçalho da tela não muda ao trocar de aba.
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).toBeVisible();
  await expect(page.getByLabel("Segunda-feira, período 1, início")).toHaveValue("08:00");
  await page.getByLabel("Terça-feira").check();
  await page.screenshot({
    path: "/private/tmp/clinicflow-profile-availability-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salvar disponibilidade" }).click();

  await expect(page.getByText("Disponibilidade atualizada.")).toBeVisible();
  expect(savedBody).toEqual({
    defaultAppointmentDurationMinutes: 30,
    intervals: [
      { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "12:00" },
    ],
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({
    path: "/private/tmp/clinicflow-profile-availability-mobile.png",
    fullPage: true,
  });
});
