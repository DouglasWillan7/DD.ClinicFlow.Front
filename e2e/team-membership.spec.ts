import { expect, test } from "@playwright/test";

const session = {
  userId: "owner-user",
  name: "Ana Martins",
  email: "ana@centro.test",
  phone: "+5511988887777",
  clinicId: "clinic-1",
  clinicName: "Clínica Centro",
  userClinicId: "owner-membership",
  clinicRole: "Secretary",
  isAdmin: true,
  roles: ["Secretary", "Admin"],
  availableClinics: [
    {
      userClinicId: "owner-membership",
      clinicId: "clinic-1",
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

const members = [
  {
    userClinicId: "owner-membership",
    userId: "owner-user",
    clinicId: "clinic-1",
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
  },
  {
    userClinicId: "nurse-membership",
    userId: "nurse-user",
    clinicId: "clinic-1",
    displayName: "Beatriz Lima",
    status: "Active",
    role: "Nurse",
    isAdmin: false,
    isOwner: false,
    email: "bia@centro.test",
    phone: "+5511977776666",
    emailConfirmedAtUtc: null,
    phoneConfirmedAtUtc: "2026-08-02T10:00:00Z",
    doctorProfile: null,
    defaultAppointmentDurationSource: null,
    sessionVersion: 1,
    createdAtUtc: "2026-08-02T10:00:00Z",
    updatedAtUtc: "2026-08-02T10:00:00Z",
  },
];

test("gestão de equipe usa membership único com teclado e layout mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);
  await page.route("**/clinics/clinic-1/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(members),
    });
  });
  await page.route("**/clinics/clinic-1/members/summary", (route) =>
    route.fulfill({ status: 200, json: members }),
  );
  await page.route("**/patients?includeInactive=true", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );

  await page.goto("/app/equipe");
  await expect(page.getByRole("heading", { name: "Equipe", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Beatriz Lima" })).toContainText("Enfermagem");
  await expect(page.getByText(/convite por e-mail/i)).toHaveCount(0);

  const add = page.getByRole("button", { name: "Novo integrante" });
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await add.click();

  const nurse = page.getByRole("radio", { name: /Enfermagem/ });
  await nurse.focus();
  await page.keyboard.press("Space");
  await expect(nurse).toBeChecked();
  const roleTargetHeight = await nurse.evaluate(
    (input) => input.closest("label")?.getBoundingClientRect().height ?? 0,
  );
  expect(roleTargetHeight).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("checkbox", { name: /Administrador da clínica/ })).not.toBeChecked();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);

  await page.screenshot({
    path: "/private/tmp/clinicflow-team-membership-mobile.png",
    fullPage: true,
  });
});
