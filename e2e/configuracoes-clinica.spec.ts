import { expect, test, type Page } from "@playwright/test";

const session = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  clinicId: "22222222-2222-2222-2222-222222222222",
  roles: ["Admin", "Secretary"],
  name: "Ana Martins",
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
  defaultAppointmentDurationMinutes: 30,
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: 10,
  createdAtUtc: "2026-07-01T12:00:00Z",
};

async function mockClinicSettings(page: Page) {
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

    if (url.pathname === "/patients" || url.pathname === "/clinics/members") {
      return route.fulfill({ status: 200, json: [] });
    }

    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });
}

test("telefone da clínica usa DDI, máscara e permanece responsivo", async ({
  page,
}) => {
  await mockClinicSettings(page);
  await page.goto("/app/configuracoes/clinica");

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
