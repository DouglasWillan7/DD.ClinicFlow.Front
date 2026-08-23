import { expect, test } from "@playwright/test";

test("mantém o acesso íntegro em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/entrar");

  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();

  const formBox = await page.locator("form").boundingBox();
  expect(formBox).not.toBeNull();
  expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(390);

  await page.screenshot({
    path: "/private/tmp/clinicflow-login-mobile.png",
    fullPage: true,
  });
});

test("mantém o cadastro íntegro em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cadastro");

  await expect(
    page.getByRole("heading", { name: "Comece pela sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();

  const cardBox = await page.locator("section").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
