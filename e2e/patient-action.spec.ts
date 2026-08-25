import { expect, test, type Page } from "@playwright/test";

const clinicId = "10000000-0000-4000-8000-000000000001";
const userClinicId = "10000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000003";
const doctorId = "20000000-0000-4000-8000-000000000001";
const patientId = "30000000-0000-4000-8000-000000000001";
const appointmentId = "40000000-0000-4000-8000-000000000001";
const actionId = "50000000-0000-4000-8000-000000000001";
const challengeId = "60000000-0000-4000-8000-000000000001";
const reference = "opaque-e2e-reference";

async function mockCriticalFlow(page: Page, failCompletion = false) {
  let appointmentStatus = "AwaitingPatientAction";
  let actionStatus = "Pending";
  let challengeStatus = "Sent";
  let hasAccess = false;
  let accessReads = 0;

  const clinic = {
    id: clinicId,
    name: "Clínica Horizonte",
    timeZoneId: "America/Sao_Paulo",
    phone: "+551130000000",
    address: "Rua Horizonte, 10",
    defaultAppointmentDurationMinutes: 30,
    plan: "Clinic",
    subscriptionStatus: "Active",
    maxDoctors: null,
    createdAtUtc: "2026-08-01T12:00:00Z",
  };
  const doctor = {
    userId: doctorId,
    email: "helena@horizonte.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    specialty: "Cardiologia",
  };
  const appointment = () => ({
    id: appointmentId,
    patientId,
    patientName: "Marina Oliveira",
    doctorUserId: doctorId,
    startUtc: "2026-08-27T12:00:00Z",
    endUtc: "2026-08-27T12:30:00Z",
    type: "InPerson",
    status: appointmentStatus,
    notes: null,
    createdAtUtc: "2026-08-25T12:00:00Z",
  });
  const action = () => ({
    actionId,
    actionType: "AppointmentWithDataSharing",
    status: actionStatus,
    requestedAtUtc: "2026-08-25T12:00:00Z",
    expiresAtUtc: "2026-08-27T12:00:00Z",
    completedAtUtc: actionStatus === "Completed" ? "2026-08-25T12:05:00Z" : null,
    completionMethod: actionStatus === "Completed" ? "PatientLink" : null,
    latestChallenge: {
      challengeId,
      type: "Link",
      channel: "WhatsApp",
      status: challengeStatus,
      attemptNumber: 1,
      expiresAtUtc: "2026-08-27T12:00:00Z",
      retryAtUtc: null,
    },
  });

  await page.clock.setFixedTime(new Date("2026-08-25T13:00:00Z"));
  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let body: unknown;

    if (url.pathname === "/auth/v2/login" && method === "POST") {
      expect(route.request().postDataJSON()).toMatchObject({
        countryCode: "BR",
        documentType: "CPF",
        document: "123.456.789-01",
      });
      body = {
        kind: "clinic_selection_required",
        selectionToken: "selection-token",
        expiresAtUtc: "2026-08-25T13:05:00Z",
        clinics: [
          {
            userClinicId: "other-membership",
            clinicId: "other-clinic",
            clinicName: "Clínica Norte",
            role: "Secretary",
            isAdmin: false,
          },
          {
            userClinicId,
            clinicId,
            clinicName: "Clínica Horizonte",
            role: "Secretary",
            isAdmin: true,
          },
        ],
      };
    } else if (url.pathname === "/auth/v2/select-clinic" && method === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        selectionToken: "selection-token",
        userClinicId,
      });
      body = {
        kind: "authenticated",
        accessToken: "access-horizonte",
        refreshToken: "refresh-horizonte",
        accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
        user: { id: userId, name: "Ana Martins" },
        clinicContext: {
          userClinicId,
          clinicId,
          clinicName: "Clínica Horizonte",
          role: "Secretary",
          isAdmin: true,
          email: "ana@horizonte.test",
          phone: "+5511988887777",
        },
      };
    } else if (url.pathname === "/clinics/current") {
      body = clinic;
    } else if (url.pathname === "/clinics/members") {
      body = [doctor];
    } else if (url.pathname === "/users/me") {
      body = {
        userId,
        name: "Ana Martins",
        email: "ana@horizonte.test",
        roles: ["Secretary", "Admin"],
        medicalLicense: null,
        medicalLicenseState: null,
        specialty: null,
      };
    } else if (url.pathname === "/onboarding/status") {
      body = { completed: true, steps: [] };
    } else if (url.pathname === "/appointments") {
      body = [appointment()];
    } else if (url.pathname === `/appointments/${appointmentId}`) {
      body = appointment();
    } else if (url.pathname === `/doctors/${doctorId}/availability`) {
      body = {
        doctorUserId: doctorId,
        timeZoneId: "America/Sao_Paulo",
        slotDurationMinutes: 30,
        days: [
          {
            date: "2026-08-27",
            status: "Available",
            slots: [],
          },
        ],
      };
    } else if (url.pathname === `/doctors/${doctorId}/schedule`) {
      body = {
        doctorUserId: doctorId,
        slotDurationMinutes: 30,
        intervals: [],
        blocks: [],
      };
    } else if (url.pathname === `/patient-actions/appointments/${appointmentId}`) {
      body = action();
    } else if (url.pathname === `/public/patient-actions/${reference}`) {
      body = {
        actionType: "AppointmentWithDataSharing",
        status: actionStatus,
        termsVersion: "appointment-with-data-sharing-v1",
        snapshot: {
          action: "appointment_with_data_sharing",
          clinicName: "Clínica Horizonte",
          doctorName: "Dra. Helena Costa",
          scheduledStartUtc: "2026-08-27T12:00:00Z",
          timeZoneId: "America/Sao_Paulo",
          dataSharing: "O médico terá acesso aos dados necessários ao atendimento.",
        },
        requestedAtUtc: "2026-08-25T12:00:00Z",
        expiresAtUtc: "2026-08-27T12:00:00Z",
        challengeStatus,
      };
    } else if (
      url.pathname === `/public/patient-actions/${reference}/complete` &&
      method === "POST"
    ) {
      if (failCompletion) {
        return route.fulfill({
          status: 500,
          contentType: "application/problem+json",
          json: { title: "Falha transacional simulada" },
        });
      }
      appointmentStatus = "Confirmed";
      actionStatus = "Completed";
      challengeStatus = "Used";
      hasAccess = true;
      body = { status: "completed" };
    } else if (url.pathname === `/patients/${patientId}`) {
      body = {
        id: patientId,
        cpf: "52998224725",
        medicalRecordNumber: 48213,
        bloodType: "APositive",
        sexForClinicalUse: "Feminino",
        name: "Marina Oliveira",
        phone: "+5511999990000",
        birthDate: "1990-01-10",
        notes: null,
        doctorUserId: doctorId,
        isActive: true,
        whatsappConsentAtUtc: null,
        createdAtUtc: "2026-08-01T12:00:00Z",
      };
    } else if (url.pathname === "/patient-actions/doctor-access") {
      accessReads += 1;
      const revoked = hasAccess && accessReads > 1;
      body = [
        {
          doctorUserId: doctorId,
          doctorName: "Dra. Helena Costa",
          hasActiveAccess: hasAccess && !revoked,
          latestAction: actionStatus === "Pending" ? action() : {
            ...action(),
            status: "Completed",
            latestChallenge: { ...action().latestChallenge, status: "Used" },
          },
        },
      ];
    } else {
      return route.fulfill({ status: 404, json: { title: "Not mocked" } });
    }

    await route.fulfill({ status: 200, contentType: "application/json", json: body });
  });
}

async function loginAndSelectClinic(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("Documento", { exact: true }).fill("123.456.789-01");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Escolha onde entrar" })).toBeVisible();
  const clinic = page.getByRole("button", { name: /Clínica Horizonte/ });
  await clinic.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/agenda$/);
}

test("confirma agenda e compartilhamento juntos e reflete revogação", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCriticalFlow(page);
  await loginAndSelectClinic(page);

  await page.goto(`/app/agenda?date=2026-08-27&doctorId=${doctorId}`);
  await expect(
    page.getByRole("button", { name: "Confirmar ação de Marina Oliveira" }),
  ).toBeVisible();

  await page.goto(`/acao-paciente/${reference}`);
  await expect(page.getByRole("heading", { name: "Confirme sua consulta" })).toBeVisible();
  const confirm = page.getByRole("button", {
    name: "Confirmar consulta e compartilhar dados",
  });
  expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: "/private/tmp/clinicflow-patient-action-mobile.png",
    fullPage: true,
  });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status", { name: "Consulta confirmada e dados compartilhados" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);

  await page.goto(`/app/agenda?date=2026-08-27&doctorId=${doctorId}`);
  await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar ação de Marina Oliveira" }),
  ).toHaveCount(0);

  await page.goto(`/app/pacientes/${patientId}/editar`);
  await expect(page.getByText("Acesso ativo")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Acesso revogado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Solicitar novamente/ })).toBeVisible();
});

test("falha atômica mantém consulta pendente e não concede acesso", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCriticalFlow(page, true);

  await page.goto(`/acao-paciente/${reference}`);
  await page.getByRole("button", {
    name: "Confirmar consulta e compartilhar dados",
  }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível concluir agora",
  );

  await loginAndSelectClinic(page);
  await page.goto(`/app/agenda?date=2026-08-27&doctorId=${doctorId}`);
  await expect(
    page.getByRole("button", { name: "Confirmar ação de Marina Oliveira" }),
  ).toBeVisible();

  await page.goto(`/app/pacientes/${patientId}/editar`);
  await expect(page.getByText("Aguardando paciente")).toBeVisible();
  await expect(page.getByText("Acesso ativo")).toHaveCount(0);
});
