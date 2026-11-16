import { expect, test } from "@playwright/test";
import { mockHealthcarePlans } from "./convenios.fixture";

const path = "/app/configuracoes/clinica/convenios";

test("administrador vê a clínica, a situação dos médicos e salva com confirmação de impacto", async ({
  page,
}) => {
  const { writes } = await mockHealthcarePlans(page, { admin: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);

  // Convênios é uma seção da configuração da clínica; o link antigo redireciona.
  await page.goto("/app/configuracoes/convenios");
  await expect(page).toHaveURL(/\/app\/configuracoes\/clinica\/convenios$/);
  const tabs = page.getByRole("navigation", { name: "Configuração da clínica" });
  await expect(tabs.getByRole("link", { name: "Convênios" }))
    .toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Dados da clínica" }).click();
  await expect(page.getByRole("heading", { name: "Dados da clínica", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Configuração da clínica" })
    .getByRole("link", { name: "Convênios" }).click();

  const list = page.getByRole("navigation", { name: "Clínica e médicos" });
  await expect(list.getByRole("button", { name: /Clínica.*5 aceitos · 3 padrão/ }))
    .toHaveAttribute("aria-current", "true");
  await expect(list.getByRole("button", { name: /Dra\. Ana Ribeiro.*Padrão da clínica/ }))
    .toBeVisible();
  await expect(
    list.getByRole("button", { name: /Dr\. Carlos Mendes.*Personalizado · 3 convênios/ }),
  ).toBeVisible();
  await expect(list.getByRole("button", { name: /Dr\. Rafael Souza.*Só particular/ }))
    .toBeVisible();

  await expect(page.getByRole("heading", { name: "Aceitos · 5 de 9" })).toBeVisible();
  const row = (name: string) =>
    page.getByRole("listitem").filter({ has: page.getByLabel(name, { exact: true }) });
  await expect(row("Amil")).toContainText("3 médicos");
  await expect(row("Bradesco Saúde")).toContainText("1 médico");
  await expect(row("Porto Seguro Saúde")).toContainText("Nenhum médico");
  await expect(page.getByRole("button", { name: "Amil no padrão da clínica" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Outros do catálogo" }).getByRole("checkbox"))
    .toHaveCount(4);
  await expect(page.getByRole("button", { name: "Salvar convênios" })).toHaveCount(0);

  await page.getByLabel("Unimed", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Salvar convênios" }).click();

  const dialog = page.getByRole("dialog", { name: "Deixar de aceitar Unimed?" });
  await expect(dialog).toContainText("Dra. Ana Ribeiro e Dra. Beatriz Lima");
  await expect(dialog).not.toContainText("Dr. Carlos Mendes");
  expect(writes).toHaveLength(0);

  await dialog.getByRole("button", { name: "Deixar de aceitar" }).click();

  await expect(page.getByText("Convênios atualizados.")).toBeVisible();
  await expect(list.getByRole("button", { name: /Clínica.*4 aceitos · 2 padrão/ }))
    .toBeVisible();
  expect(writes).toEqual([{
    path: "/clinics/current/healthcare-plans",
    body: {
      healthcarePlanIds: ["plan-amil", "plan-bradesco", "plan-porto", "plan-sulamerica"],
      defaultHealthcarePlanIds: ["plan-amil", "plan-sulamerica"],
    },
  }]);
});

test("médico no padrão fica travado e o personalizado mostra a diferença e aplica o padrão", async ({
  page,
}) => {
  const { writes } = await mockHealthcarePlans(page, { admin: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${path}?item=uc-ana`);

  await expect(page.getByRole("heading", { name: "Dra. Ana Ribeiro", level: 2 })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Convênios atendidos · 3 de 5" }))
    .toBeVisible();
  await expect(page.getByLabel("Amil", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Amil", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Bradesco Saúde", { exact: true })).not.toBeChecked();

  const list = page.getByRole("navigation", { name: "Clínica e médicos" });
  await list.getByRole("button", { name: /Dr\. Carlos Mendes/ }).click();
  await expect(page).toHaveURL(/item=uc-carlos/);

  const diff = page.getByRole("list", { name: "Diferenças para o padrão da clínica" });
  await expect(diff).toContainText("Bradesco Saúde");
  await expect(diff).toContainText("Unimed");

  await page.getByRole("button", { name: "Aplicar padrão da clínica" }).click();

  await expect(diff).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Personalizado/ })).toBeChecked();
  await expect(
    list.getByRole("button", { name: /Dr\. Carlos Mendes.*Personalizado · não salvo/ }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Alterações não salvas" })).toBeVisible();

  await page.getByRole("button", { name: "Salvar convênios" }).click();

  await expect(page.getByText("Convênios atualizados.")).toBeVisible();
  expect(writes).toEqual([{
    path: "/clinics/22222222-2222-2222-2222-222222222222/members/uc-carlos/healthcare-plans",
    body: {
      mode: "Custom",
      healthcarePlanIds: ["plan-amil", "plan-sulamerica", "plan-unimed"],
    },
  }]);
});

test("médico sem administração não acessa os convênios da clínica", async ({ page }) => {
  await mockHealthcarePlans(page, { admin: false });
  await page.goto(path);

  await expect(page).not.toHaveURL(/configuracoes\/clinica/);
  await expect(page.getByRole("heading", { name: "Convênios", level: 1 })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /convênios/i })).toHaveCount(0);
});

test("em 390 px a lista vira seletor, sem rolagem horizontal e com alvos de 44 px", async ({
  page,
}) => {
  await mockHealthcarePlans(page, { admin: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);

  const selector = page.getByLabel("Configurar convênios de");
  await expect(selector).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Clínica e médicos" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Aceitos · 5 de 9" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  for (const target of [
    selector,
    page.getByRole("button", { name: "Amil no padrão da clínica" }),
    page.getByLabel("Amil", { exact: true }).locator("xpath=ancestor::label"),
  ]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await selector.selectOption({ label: "Dr. Carlos Mendes · Personalizado · 3 convênios" });

  await expect(page.getByRole("heading", { name: "Dr. Carlos Mendes", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Marcar todos" }).click();
  const bar = page.getByRole("region", { name: "Alterações não salvas" });
  await expect(bar).toBeVisible();
  const barBox = await bar.boundingBox();
  expect((barBox?.x ?? 0) + (barBox?.width ?? 0)).toBeLessThanOrEqual(390);
});
