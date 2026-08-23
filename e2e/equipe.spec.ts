import { expect, test, type Page } from "@playwright/test";

const adminSession = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  clinicId: "22222222-2222-2222-2222-222222222222",
  roles: ["Admin"],
  name: "Ana Martins",
  tokens: {
    accessToken: "e2e-token",
    refreshToken: "e2e-refresh",
    accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
  },
};

const createdDoctorId = "55555555-5555-5555-5555-555555555555";

const createdDoctor = {
  userId: createdDoctorId,
  email: "helena@clinicavital.com.br",
  name: "Helena Martins Sarmento",
  roles: ["Doctor"],
  isCreator: false,
  hasAccess: false,
  hasPendingInvitation: false,
  medicalLicense: "128455",
  medicalLicenseState: "SP",
  specialty: "Gastroenterologia",
  cpf: "41288732090",
  birthDate: "1985-03-22",
  phone: "11987124455",
  gender: "Feminino",
  rqe: null,
  practiceAreas: null,
  bio: null,
  slotDurationMinutes: 30,
  healthInsurancePlanIds: ["c0000000-0000-0000-0000-000000000001"],
  scheduleIntervals: [
    {
      id: "66666666-6666-6666-6666-666666666666",
      dayOfWeek: "Monday",
      startLocal: "08:00:00",
      endLocal: "18:00:00",
    },
  ],
};

interface Captured {
  createPayload?: unknown;
}

async function mockClinic(page: Page, captured: Captured) {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(session));
  }, adminSession);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === "/clinics/current") {
      return route.fulfill({
        status: 200,
        json: {
          id: adminSession.clinicId,
          name: "Clínica Vital",
          timeZoneId: "America/Sao_Paulo",
          phone: null,
          address: null,
          defaultAppointmentDurationMinutes: 30,
          plan: "Clinic",
          subscriptionStatus: "Active",
          maxDoctors: null,
          createdAtUtc: "2026-07-01T12:00:00Z",
        },
      });
    }
    if (url.pathname === "/health-insurance-plans") {
      return route.fulfill({
        status: 200,
        json: [
          { id: "c0000000-0000-0000-0000-000000000001", name: "Particular" },
          { id: "c0000000-0000-0000-0000-000000000002", name: "Unimed" },
        ],
      });
    }
    if (url.pathname === "/clinics/doctors" && method === "POST") {
      captured.createPayload = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: createdDoctor });
    }
    if (url.pathname === "/clinics/doctors") {
      return route.fulfill({
        status: 200,
        json: captured.createPayload ? [createdDoctor] : [],
      });
    }
    if (url.pathname === `/clinics/doctors/${createdDoctorId}`) {
      return route.fulfill({ status: 200, json: createdDoctor });
    }
    if (
      url.pathname === `/clinics/doctors/${createdDoctorId}/access-invite` &&
      method === "POST"
    ) {
      return route.fulfill({
        status: 200,
        json: {
          email: createdDoctor.email,
          token: "TOKEN-DE-ATIVACAO",
          expiresAtUtc: "2026-08-16T12:00:00Z",
        },
      });
    }
    if (url.pathname === "/clinics/members") {
      return route.fulfill({
        status: 200,
        json: [
          {
            userId: adminSession.userId,
            email: adminSession.email,
            roles: ["Admin"],
            isCreator: true,
            name: adminSession.name,
            specialty: null,
          },
        ],
      });
    }
    if (url.pathname === "/clinics/invitations") {
      return route.fulfill({ status: 200, json: [] });
    }
    if (url.pathname === `/doctors/${createdDoctorId}/schedule`) {
      return route.fulfill({
        status: 200,
        json: {
          doctorUserId: createdDoctorId,
          slotDurationMinutes: 30,
          intervals: createdDoctor.scheduleIntervals,
          blocks: [],
        },
      });
    }
    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });
}

async function preencher(page: Page) {
  await page.getByLabel(/Nome completo/).fill("Helena Martins Sarmento");
  await page.getByLabel(/^CPF/).fill("41288732090");
  await page.getByLabel(/Nascimento/).fill("1985-03-22");
  await page.getByLabel(/Celular/).fill("11987124455");
  await page.getByLabel(/E-mail/).fill("helena@clinicavital.com.br");
  await page.getByRole("button", { name: "Feminino" }).click();
  await page.getByLabel(/^CRM/).fill("128455");
  await page.getByLabel(/UF do CRM/).selectOption("SP");
  await page.getByLabel(/Especialidade/).selectOption("Gastroenterologia");
  await page.getByLabel(/^Início/).fill("08:00");
  await page.getByLabel(/^Fim/).fill("18:00");
  await page.getByLabel(/Duração da consulta/).selectOption("30");
  await page.getByRole("button", { name: "Particular" }).click();
}

test("recepção cadastra um médico e gera o convite de acesso", async ({
  page,
}) => {
  const captured: Captured = {};
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await mockClinic(page, captured);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto("/app/equipe");
  await expect(page.getByText(/Nenhum médico cadastrado/)).toBeVisible();
  await page.getByRole("link", { name: "Novo médico" }).click();

  await expect(page.getByText("8% completo")).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-equipe-novo-vazio.png",
    fullPage: true,
  });

  await preencher(page);
  await expect(page.getByText("100% completo")).toBeVisible();
  await expect(page.getByText("Dr(a). Helena Martins Sarmento")).toBeVisible();
  await expect(page.getByText("Gastroenterologia · CRM 128455-SP")).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-equipe-novo-preenchido.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Salvar médico" }).click();

  await expect.poll(() => captured.createPayload).toMatchObject({
    name: "Helena Martins Sarmento",
    email: "helena@clinicavital.com.br",
    cpf: "41288732090",
    medicalLicense: "128455",
    medicalLicenseState: "SP",
    specialty: "Gastroenterologia",
    slotDurationMinutes: 30,
  });
  await expect(page.getByText("Médico salvo.")).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-equipe-novo-salvo.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Enviar convite de acesso" }).click();
  await expect(page.getByText("Convite de acesso gerado")).toBeVisible();
  await expect(page.getByLabel("Link de ativação")).toHaveValue(
    /\/ativar\?email=helena%40clinicavital\.com\.br&token=TOKEN-DE-ATIVACAO/,
  );

  expect(pageErrors).toEqual([]);
});

test("cadastro de médico permanece utilizável no mobile", async ({ page }) => {
  const captured: Captured = {};
  await mockClinic(page, captured);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/app/equipe/novo");
  await expect(page.getByLabel(/Nome completo/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: "/private/tmp/clinicflow-equipe-novo-mobile.png",
    fullPage: true,
  });
});

test("link de ativação abre a definição de senha", async ({ page }) => {
  let activatePayload: unknown;
  await page.route("http://localhost:5094/**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("http://localhost:5094/auth/activate", async (route) => {
    activatePayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      json: {
        userId: createdDoctorId,
        email: createdDoctor.email,
        clinicId: adminSession.clinicId,
        roles: ["Doctor"],
        name: createdDoctor.name,
        tokens: {
          accessToken: "novo-token",
          refreshToken: "novo-refresh",
          accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
        },
      },
    });
  });

  await page.goto(
    "/ativar?email=helena%40clinicavital.com.br&token=TOKEN-DE-ATIVACAO",
  );

  await expect(page.getByRole("heading", { name: "Ative seu acesso." })).toBeVisible();
  await page.getByLabel("Nome").fill("Helena Martins Sarmento");
  await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
  await page.getByLabel("Confirmar senha").fill("senha-forte-123");
  await page.getByRole("button", { name: "Ativar acesso" }).click();

  await expect.poll(() => activatePayload).toMatchObject({
    email: "helena@clinicavital.com.br",
    token: "TOKEN-DE-ATIVACAO",
    password: "senha-forte-123",
    name: "Helena Martins Sarmento",
  });
});

test("almoço é configurado no mesmo formulário, sem segundo Salvar", async ({
  page,
}) => {
  const captured: Captured = {};
  await mockClinic(page, captured);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/app/equipe/novo");

  await preencher(page);
  await page.getByLabel(/Horários diferentes por dia/).check();
  await page
    .getByRole("button", { name: "Adicionar intervalo de segunda-feira" })
    .click();
  await page.getByLabel("Fim 1 de segunda-feira").fill("12:00");
  await page.getByLabel("Início 2 de segunda-feira").fill("14:00");
  await page.getByLabel("Fim 2 de segunda-feira").fill("18:00");

  // A agenda vive dentro do cadastro: nenhum formulário paralelo com Salvar próprio.
  await expect(page.locator("form")).toHaveCount(1);
  // Seg–Sex vêm marcados: domingo e sábado ficam livres, e ambos aparecem na lista.
  await expect(page.getByText("Sem atendimento")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Adicionar intervalo de domingo" }),
  ).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-por-dia.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Salvar médico" }).click();

  await expect
    .poll(() => (captured.createPayload as { scheduleIntervals: unknown[] })?.scheduleIntervals)
    .toContainEqual({
      dayOfWeek: "Monday",
      startLocal: "08:00",
      endLocal: "12:00",
    });
});
