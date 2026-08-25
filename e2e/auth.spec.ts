import { expect, test } from "@playwright/test";

test("mantém o acesso íntegro em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/entrar");

  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("Documento", { exact: true })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveCount(0);

  const documentInput = page.getByLabel("Documento", { exact: true });
  const loginButton = page.getByRole("button", { name: "Entrar" });
  const inputBox = await documentInput.boundingBox();
  const buttonBox = await loginButton.boundingBox();
  expect(inputBox!.height).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

  await documentInput.focus();
  expect(await documentInput.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");

  const recoveryButton = page.getByRole("button", { name: "Esqueci minha senha" });
  await recoveryButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Recuperar acesso" })).toBeVisible();
  await expect(page.getByLabel("Documento", { exact: true })).toBeFocused();

  const formBox = await page.locator("form").boundingBox();
  expect(formBox).not.toBeNull();
  expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);

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
