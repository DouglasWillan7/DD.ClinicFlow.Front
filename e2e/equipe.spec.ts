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
  availableClinics: [
    {
      userClinicId: "owner-membership",
      clinicId,
      clinicName: "Clínica Centro",
      role: "Secretary",
      isAdmin: true,
    },
  ],
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

type InvitationStatus =
  | "Queued"
  | "Sent"
  | "Retrying"
  | "Failed"
  | "Expired"
  | "Cancelled"
  | "Accepted";

function invitationSummary(status: InvitationStatus) {
  return {
    status,
    destinationMasked: "he***@centro.test",
    attemptNumber: 2,
    issuedAtUtc: "2099-08-29T12:00:00Z",
    expiresAtUtc: "2099-08-30T12:00:00Z",
    retryAtUtc: status === "Retrying" ? "2099-08-29T12:05:00Z" : null,
    publicReference: "raw-invitation-secret",
    providerResponse: "provider-internal-detail",
  };
}

function pendingDoctor(status: InvitationStatus = "Sent") {
  return {
    ...doctor,
    status: "Pending",
    emailConfirmedAtUtc: null,
    invitation: invitationSummary(status),
  };
}

async function mockInvitationTeam(
  page: Page,
  initialMember = pendingDoctor(),
  options: { rateLimited?: boolean } = {},
) {
  const state = {
    member: initialMember,
    reissueRequests: 0,
    cancelRequests: 0,
    updateRequests: 0,
  };
  await page.route(`**/clinics/${clinicId}/members**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `/clinics/${clinicId}/members/summary`) {
      return route.fulfill({ status: 200, json: [owner, state.member] });
    }
    if (path === `/clinics/${clinicId}/members`) {
      return route.fulfill({ status: 200, json: [owner, state.member] });
    }
    if (path.endsWith("/invitation/reissue")) {
      state.reissueRequests += 1;
      if (options.rateLimited) {
        return route.fulfill({
          status: 429,
          headers: {
            "Access-Control-Expose-Headers": "Retry-After",
            "Retry-After": "12",
          },
          json: { status: "rate_limited" },
        });
      }
      state.member = {
        ...state.member,
        invitation: {
          ...invitationSummary("Queued"),
          attemptNumber: state.member.invitation.attemptNumber + 1,
        },
      };
      return route.fulfill({ status: 200, json: state.member.invitation });
    }
    if (path.endsWith("/invitation") && request.method() === "DELETE") {
      state.cancelRequests += 1;
      state.member = {
        ...state.member,
        status: "Pending",
        invitation: invitationSummary("Cancelled"),
      };
      return route.fulfill({ status: 204 });
    }
    if (
      path.endsWith(`/members/${doctor.userClinicId}`) &&
      request.method() === "PUT"
    ) {
      state.updateRequests += 1;
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.member = {
        ...state.member,
        email: String(payload.email),
        invitation: invitationSummary("Cancelled"),
      };
      return route.fulfill({ status: 200, json: state.member });
    }
    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });
  return state;
}

async function authenticate(page: Page) {
  await page.addInitScript((value) => {
    sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);
  await page.route(`**/clinics/${clinicId}/members/summary`, (route) =>
    route.fulfill({ status: 200, json: [owner, doctor] }),
  );
  await page.route("**/patients?includeInactive=true", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
}

test("administração cria médico por documento com contato e duração contextuais", async ({
  page,
}) => {
  await authenticate(page);
  const members: Array<Record<string, unknown>> = [owner];
  let payload: Record<string, unknown> | undefined;
  await page.route(`**/clinics/${clinicId}/members`, async (route) => {
    if (route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      members.push(pendingDoctor("Queued"));
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
  await expect(page.getByText("Envio aguardando")).toBeVisible();
  await expect(page.getByText("he***@centro.test")).toBeVisible();
  await expect(page.getByText(/convite foi enfileirado/i)).toBeVisible();
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

test("falha de entrega mantém estado seguro e não expõe detalhes internos", async ({
  page,
}) => {
  await authenticate(page);
  await mockInvitationTeam(page, pendingDoctor("Failed"));

  await page.goto("/app/equipe");

  await expect(page.getByText("Falha na entrega")).toBeVisible();
  await expect(page.getByText("he***@centro.test")).toBeVisible();
  await expect(page.getByText(/30 de agosto de 2099/)).toBeVisible();
  await expect(page.getByText("raw-invitation-secret")).toHaveCount(0);
  await expect(page.getByText("provider-internal-detail")).toHaveCount(0);
  await page.screenshot({
    path: "/private/tmp/clinicflow-team-invitation-desktop.png",
    fullPage: true,
  });
});

test("reenvia convite com falha e atualiza a tentativa na lista", async ({
  page,
}) => {
  await authenticate(page);
  const state = await mockInvitationTeam(page, pendingDoctor("Failed"));
  await page.goto("/app/equipe");

  await page.getByRole("button", { name: "Reenviar convite" }).click();

  await expect(page.getByText("Novo convite enfileirado para envio.")).toBeVisible();
  await expect(page.getByText("Envio aguardando")).toBeVisible();
  await expect(page.getByText("Tentativa 3")).toBeVisible();
  expect(state.reissueRequests).toBe(1);
});

test("cooldown usa Retry-After e impede reenvio imediato", async ({ page }) => {
  await authenticate(page);
  const state = await mockInvitationTeam(page, pendingDoctor("Sent"), {
    rateLimited: true,
  });
  await page.goto("/app/equipe");

  await page.getByRole("button", { name: "Reenviar convite" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Aguarde 12 segundos antes de reenviar.",
  );
  await expect(
    page.getByRole("button", { name: "Reenviar em 12s" }),
  ).toBeDisabled();
  expect(state.reissueRequests).toBe(1);
});

test("cancelamento exige confirmação e preserva vínculo pendente", async ({
  page,
}) => {
  await authenticate(page);
  const state = await mockInvitationTeam(page, pendingDoctor("Sent"));
  await page.goto("/app/equipe");

  await page.getByRole("button", { name: "Cancelar convite" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Cancelar convite de Dra. Helena Martins?",
  });
  await expect(confirmation).toContainText("vínculo continuará pendente");
  expect(state.cancelRequests).toBe(0);
  await confirmation
    .getByRole("button", { name: "Confirmar cancelamento" })
    .click();

  await expect(page.getByText("Convite cancelado.")).toBeVisible();
  await expect(page.getByText("Convite cancelado", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "Dra. Helena Martins" }),
  ).toContainText("Pendente");
  expect(state.cancelRequests).toBe(1);
});

test("alterar e-mail pendente invalida o convite e exige reenvio explícito", async ({
  page,
}) => {
  await authenticate(page);
  const state = await mockInvitationTeam(page, pendingDoctor("Sent"));
  await page.goto("/app/equipe");
  await page
    .getByRole("button", { name: "Editar vínculo de Dra. Helena Martins" })
    .click();

  await expect(page.getByText(/o convite atual será invalidado/i)).toBeVisible();
  await page.getByLabel("E-mail na clínica").fill("novo@centro.test");
  await page.getByRole("button", { name: "Salvar vínculo" }).click();

  await expect(page.getByText("Vínculo atualizado.")).toBeVisible();
  await expect(page.getByText("Convite cancelado", { exact: true })).toBeVisible();
  expect(state.updateRequests).toBe(1);
  expect(state.reissueRequests).toBe(0);
  await page.getByRole("button", { name: "Reenviar convite" }).click();
  await expect(page.getByText("Novo convite enfileirado para envio.")).toBeVisible();
  expect(state.reissueRequests).toBe(1);
});

test("controles de convite permanecem íntegros no mobile", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockInvitationTeam(page, pendingDoctor("Failed"));
  await page.goto("/app/equipe");

  for (const action of [
    page.getByRole("button", { name: "Reenviar convite" }),
    page.getByRole("button", { name: "Cancelar convite" }),
  ]) {
    await expect(action).toBeVisible();
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({
    path: "/private/tmp/clinicflow-team-invitation-mobile.png",
    fullPage: true,
  });
});

test("reenvio pode ser concluído somente com teclado", async ({ page }) => {
  await authenticate(page);
  const state = await mockInvitationTeam(page, pendingDoctor("Failed"));
  await page.goto("/app/equipe");

  const reissue = page.getByRole("button", { name: "Reenviar convite" });
  await reissue.focus();
  await expect(reissue).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Novo convite enfileirado para envio.")).toBeVisible();
  await expect(page.getByText("Envio aguardando")).toBeVisible();
  expect(state.reissueRequests).toBe(1);
});
