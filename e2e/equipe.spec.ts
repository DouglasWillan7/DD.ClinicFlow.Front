import { expect, test, type Page } from "@playwright/test";

const clinicId = "clinic-1";
const session = {
  userId: "owner-user",
  name: "Ana Martins",
  email: "ana@centro.test",
  phone: "+5511988887777",
  clinicId,
  clinicName: "Clínica Centro",
  userClinicId: "owner-membership",
  clinicRole: "Secretary",
  isAdmin: true,
  roles: ["Secretary", "Admin"],
  tokens: {
    accessToken: "access",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};

const owner = {
  userClinicId: "owner-membership",
  userId: "owner-user",
  clinicId,
  displayName: "Ana Martins",
  status: "Active",
  role: "Secretary",
  isAdmin: true,
  isOwner: true,
  email: "ana@centro.test",
  phone: "+5511988887777",
  emailConfirmedAtUtc: "2026-08-01T10:00:00Z",
  phoneConfirmedAtUtc: null,
  doctorProfile: null,
  defaultAppointmentDurationSource: null,
  sessionVersion: 1,
  createdAtUtc: "2026-08-01T10:00:00Z",
  updatedAtUtc: "2026-08-01T10:00:00Z",
};

const doctor = {
  userClinicId: "doctor-membership",
  userId: "doctor-user",
  clinicId,
  displayName: "Dra. Helena Martins",
  status: "Active",
  role: "Doctor",
  isAdmin: false,
  isOwner: false,
  email: "helena@centro.test",
  phone: "+5511999998888",
  emailConfirmedAtUtc: "2026-08-20T10:00:00Z",
  phoneConfirmedAtUtc: null,
  doctorProfile: {
    professionalAuthority: "CRM",
    professionalRegistrationNumber: "12345",
    professionalRegistrationRegion: "SP",
    professionalRegistrationCountryCode: "BR",
    specialty: "Gastroenterologia",
    practiceAreas: "Endoscopia",
    bio: "Atendimento clínico.",
    defaultAppointmentDurationMinutes: 30,
  },
  defaultAppointmentDurationSource: "Configured",
  sessionVersion: 2,
  createdAtUtc: "2026-08-01T10:00:00Z",
  updatedAtUtc: "2026-08-20T10:00:00Z",
};

async function authenticate(page: Page) {
  await page.addInitScript((value) => {
    sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);
}

test("administração cria médico por documento com contato e duração contextuais", async ({
  page,
}) => {
  await authenticate(page);
  const members: Array<typeof owner | typeof doctor> = [owner];
  let payload: Record<string, unknown> | undefined;
  await page.route(`**/clinics/${clinicId}/members`, async (route) => {
    if (route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      members.push({ ...doctor, status: "Pending", emailConfirmedAtUtc: null });
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 200, json: members });
  });

  await page.goto("/app/equipe");
  await expect(
    page.getByRole("listitem", { name: "Ana Martins" }),
  ).toBeVisible();
  const createMember = page.getByRole("button", { name: "Novo integrante" });
  await expect(createMember).toBeVisible();
  await createMember.click();
  await page.getByLabel("Nome completo").fill("Dra. Helena Martins");
  await page.getByRole("textbox", { name: "Documento", exact: true }).fill("41288732090");
  await page.getByLabel("E-mail na clínica").fill("helena@centro.test");
  await page.getByRole("textbox", { name: "Telefone", exact: true }).fill("11999998888");
  await page.getByRole("radio", { name: /Médico/ }).check();
  await page.getByLabel("Conselho profissional").fill("CRM");
  await page.getByLabel("Número do registro").fill("12345");
  await page.getByLabel("Região do registro").fill("SP");
  await page.getByLabel("Especialidade").fill("Gastroenterologia");
  await page.getByLabel("Duração padrão da consulta").selectOption("30");
  await page.getByRole("button", { name: "Adicionar integrante" }).click();

  await expect.poll(() => payload).toMatchObject({
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "41288732090",
    name: "Dra. Helena Martins",
    email: "helena@centro.test",
    phone: "+5511999998888",
    role: "Doctor",
    isAdmin: false,
    doctorProfile: {
      specialty: "Gastroenterologia",
      defaultAppointmentDurationMinutes: 30,
    },
  });
  expect(payload).not.toHaveProperty("roles");
  await expect(page.getByRole("listitem", { name: "Dra. Helena Martins" })).toContainText(
    "Pendente",
  );
});

test("troca de médico para secretaria exige confirmação e remove o perfil", async ({
  page,
}) => {
  await authenticate(page);
  let payload: Record<string, unknown> | undefined;
  await page.route(`**/clinics/${clinicId}/members`, (route) =>
    route.fulfill({ status: 200, json: [owner, doctor] }),
  );
  await page.route(`**/clinics/${clinicId}/members/${doctor.userClinicId}`, async (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      json: { ...doctor, ...payload, doctorProfile: null, role: "Secretary" },
    });
  });

  await page.goto("/app/equipe");
  await page.getByRole("button", { name: "Editar vínculo de Dra. Helena Martins" }).click();
  await page.getByRole("radio", { name: /Secretaria/ }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Remover dados médicos?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Alterar e remover" }).click();
  await expect(page.getByLabel("Especialidade")).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar vínculo" }).click();

  await expect.poll(() => payload).toMatchObject({
    role: "Secretary",
    isAdmin: false,
    doctorProfile: null,
    reason: "Atualização pela gestão de equipe",
  });
});
