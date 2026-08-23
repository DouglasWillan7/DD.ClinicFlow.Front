import { expect, test, type Page } from "@playwright/test";

const adminDoctorSession = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  clinicId: "22222222-2222-2222-2222-222222222222",
  roles: ["Admin", "Doctor"],
  name: "Dra. Ana Martins",
  tokens: {
    accessToken: "visual-test-token",
    refreshToken: "visual-test-refresh",
    accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
  },
};

async function mockAdminDoctor(page: Page) {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(session),
    );
  }, adminDoctorSession);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/clinics/current") {
      return route.fulfill({
        status: 200,
        json: {
          id: adminDoctorSession.clinicId,
          name: "Consultório Ana Martins",
          timeZoneId: "America/Sao_Paulo",
          phone: "+551130000000",
          address: "Rua das Flores, 120",
          defaultAppointmentDurationMinutes: 30,
          plan: "Solo",
          subscriptionStatus: "Active",
          maxDoctors: 1,
          createdAtUtc: "2026-07-01T12:00:00Z",
        },
      });
    }
    if (url.pathname === "/clinics/members") {
      return route.fulfill({
        status: 200,
        json: [
          {
            userId: adminDoctorSession.userId,
            email: adminDoctorSession.email,
            roles: ["Admin", "Doctor"],
            isCreator: true,
            name: adminDoctorSession.name,
          },
        ],
      });
    }
    if (url.pathname === "/clinics/invitations") {
      return route.fulfill({ status: 200, json: [] });
    }
    if (url.pathname === "/clinics/doctors") {
      return route.fulfill({
        status: 200,
        json: [
          {
            userId: adminDoctorSession.userId,
            email: adminDoctorSession.email,
            name: adminDoctorSession.name,
            roles: ["Admin", "Doctor"],
            isCreator: true,
            hasAccess: true,
            hasPendingInvitation: false,
            medicalLicense: "123456",
            medicalLicenseState: "SP",
            specialty: "Clínica médica",
            cpf: null,
            birthDate: null,
            phone: null,
            gender: null,
            rqe: null,
            practiceAreas: null,
            bio: null,
            slotDurationMinutes: 30,
            healthInsurancePlanIds: [],
            scheduleIntervals: [],
          },
        ],
      });
    }
    if (url.pathname === `/clinics/doctors/${adminDoctorSession.userId}`) {
      return route.fulfill({
        status: 200,
        json: {
          userId: adminDoctorSession.userId,
          email: adminDoctorSession.email,
          name: adminDoctorSession.name,
          roles: ["Admin", "Doctor"],
          isCreator: true,
          hasAccess: true,
          hasPendingInvitation: false,
          medicalLicense: "123456",
          medicalLicenseState: "SP",
          specialty: "Clínica médica",
          cpf: null,
          birthDate: null,
          phone: null,
          gender: null,
          rqe: null,
          practiceAreas: null,
          bio: null,
          slotDurationMinutes: 30,
          healthInsurancePlanIds: [],
          scheduleIntervals: [
            {
              id: "33333333-3333-3333-3333-333333333333",
              dayOfWeek: "Monday",
              startLocal: "08:00:00",
              endLocal: "12:00:00",
            },
          ],
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
    if (url.pathname === "/users/me") {
      return route.fulfill({
        status: 200,
        json: {
          userId: adminDoctorSession.userId,
          email: adminDoctorSession.email,
          name: adminDoctorSession.name,
          roles: ["Admin", "Doctor"],
          medicalLicense: "123456",
          medicalLicenseState: "SP",
          specialty: "Clínica médica",
        },
      });
    }
    if (
      url.pathname === `/doctors/${adminDoctorSession.userId}/schedule` &&
      route.request().method() === "GET"
    ) {
      return route.fulfill({
        status: 200,
        json: {
          doctorUserId: adminDoctorSession.userId,
          slotDurationMinutes: 30,
          intervals: [
            {
              id: "33333333-3333-3333-3333-333333333333",
              dayOfWeek: "Monday",
              startLocal: "08:00:00",
              endLocal: "12:00:00",
            },
          ],
          blocks: [],
        },
      });
    }
    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });
}

test("cadastro diferencia consultório individual de clínica", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/cadastro");

  await expect(
    page.getByRole("heading", { name: "Comece do seu jeito." }),
  ).toBeVisible();
  await expect(
    page.getByText("Consultório individual", { exact: true }),
  ).toBeVisible();
  await page.getByText("Clínica com equipe", { exact: true }).click();
  await expect(
    page.getByText("Também atendo como médico", { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/clinicflow-register-plans.png",
    fullPage: true,
  });
});

test("médico do plano individual aparece na equipe e abre a própria agenda", async ({
  page,
}) => {
  await mockAdminDoctor(page);
  await page.setViewportSize({ width: 1280, height: 980 });
  await page.goto("/app/equipe");

  const doctorsPanel = page.getByRole("region", { name: "Médicos" });
  const doctorRow = doctorsPanel.getByRole("button", {
    name: new RegExp(adminDoctorSession.name),
  });
  await expect(doctorRow).toHaveCount(1);
  await expect(page.getByText("Clínica médica · CRM 123456-SP")).toBeVisible();
  await expect(page.getByText("Acesso ativo")).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/clinicflow-team-list.png",
    fullPage: true,
  });

  await doctorRow.click();
  await expect(page).toHaveURL(new RegExp(`/app/equipe/${adminDoctorSession.userId}$`));
  await expect(page.getByRole("group", { name: /Dias de atendimento/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Funções na clínica" }),
  ).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/clinicflow-team-doctor-detail.png",
    fullPage: true,
  });
});

test("fundador adiciona atuação médica sem perder administração", async ({
  page,
}) => {
  await mockAdminDoctor(page);
  await page.addInitScript((session) => {
    window.sessionStorage.setItem(
      "clinicflow.session",
      JSON.stringify(session),
    );
  }, {
    ...adminDoctorSession,
    roles: ["Admin"],
  });
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  let memberRoles = ["Admin"];
  let updatePayload: unknown;
  let sessionRefreshed = false;

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/clinics/current") {
      return route.fulfill({
        status: 200,
        json: {
          id: adminDoctorSession.clinicId,
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
    if (url.pathname === "/clinics/members") {
      return route.fulfill({
        status: 200,
        json: [
          {
            userId: adminDoctorSession.userId,
            email: adminDoctorSession.email,
            roles: memberRoles,
            isCreator: true,
            name: adminDoctorSession.name,
          },
        ],
      });
    }
    if (url.pathname === "/clinics/doctors") {
      return route.fulfill({
        status: 200,
        json: memberRoles.includes("Doctor")
          ? [
              {
                userId: adminDoctorSession.userId,
                email: adminDoctorSession.email,
                name: adminDoctorSession.name,
                roles: memberRoles,
                isCreator: true,
                hasAccess: true,
                hasPendingInvitation: false,
                medicalLicense: null,
                medicalLicenseState: null,
                specialty: null,
                cpf: null,
                birthDate: null,
                phone: null,
                gender: null,
                rqe: null,
                practiceAreas: null,
                bio: null,
                slotDurationMinutes: null,
                healthInsurancePlanIds: [],
                scheduleIntervals: [],
              },
            ]
          : [],
      });
    }
    if (
      url.pathname ===
        `/clinics/members/${adminDoctorSession.userId}/roles` &&
      route.request().method() === "PUT"
    ) {
      updatePayload = route.request().postDataJSON();
      memberRoles = (updatePayload as { roles: string[] }).roles;
      return route.fulfill({ status: 204 });
    }
    if (
      url.pathname === "/auth/refresh" &&
      route.request().method() === "POST"
    ) {
      sessionRefreshed = true;
      return route.fulfill({
        status: 200,
        json: {
          ...adminDoctorSession,
          roles: memberRoles,
        },
      });
    }
    return route.fallback();
  });

  await page.setViewportSize({ width: 1280, height: 980 });
  await page.goto("/app/equipe");
  await page
    .getByRole("button", { name: `Editar funções de ${adminDoctorSession.name}` })
    .click();

  const adminRole = page.getByRole("checkbox", {
    name: "Administração",
    exact: true,
  });
  const doctorRole = page.getByRole("checkbox", {
    name: "Médico",
    exact: true,
  });
  await expect(adminRole).toBeChecked();
  await expect(adminRole).toBeDisabled();
  await expect(doctorRole).not.toBeChecked();

  await page.screenshot({
    path: "/private/tmp/clinicflow-team-edit-founder-roles.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("button", { name: `Editar funções de ${adminDoctorSession.name}` })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/clinicflow-team-edit-founder-roles-mobile.png",
    fullPage: true,
  });
  await page
    .locator(`#member-roles-${adminDoctorSession.userId}`)
    .screenshot({
      path: "/private/tmp/clinicflow-team-edit-founder-roles-mobile-panel.png",
    });

  await doctorRole.check();
  await page.getByRole("button", { name: "Salvar funções" }).click();

  await expect(
    page.getByText(`Funções de ${adminDoctorSession.name} atualizadas.`),
  ).toBeVisible();
  expect(updatePayload).toEqual({
    roles: ["Admin", "Doctor"],
  });
  expect(sessionRefreshed).toBe(true);
  // Com a função Médico, o fundador sai da administração e passa a ocupar a lista de médicos.
  await expect(
    page
      .getByRole("region", { name: "Médicos" })
      .getByRole("button", { name: new RegExp(adminDoctorSession.name) }),
  ).toHaveCount(1);
  await expect(page.getByText("Cadastro incompleto")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("convite da administração envia somente a lista de funções", async ({
  page,
}) => {
  await mockAdminDoctor(page);
  let payload: unknown;
  await page.route("http://localhost:5094/clinics/members", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    payload = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });

  await page.goto("/app/equipe");
  await page.getByLabel("E-mail").fill("recepcao@clinicavital.com.br");
  await page.getByRole("button", { name: "Criar convite" }).click();

  await expect.poll(() => payload).toEqual({
    email: "recepcao@clinicavital.com.br",
    roles: ["Secretary"],
  });
});

test("perfil médico continua utilizável no mobile", async ({ page }) => {
  await mockAdminDoctor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/configuracoes/perfil");

  await expect(page.locator('input[name="medicalLicense"]')).toHaveValue("123456");
  await expect(page.locator('select[name="medicalLicenseState"]')).toHaveValue(
    "SP",
  );
  await expect(page.locator('select[name="specialty"]')).toHaveValue(
    "Clínica médica",
  );
  await expect(
    page.getByRole("heading", { name: "Cadastro médico" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: /Dias de atendimento/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: "/private/tmp/clinicflow-profile-mobile.png",
    fullPage: true,
  });
});
