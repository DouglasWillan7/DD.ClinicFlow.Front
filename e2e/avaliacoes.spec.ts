import { expect, test, type Page } from "@playwright/test";

const session = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  clinicId: "22222222-2222-2222-2222-222222222222",
  roles: ["Admin"],
  name: "Ana Martins",
  tokens: {
    accessToken: "visual-test-token",
    refreshToken: "visual-test-refresh",
    accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
  },
};

const patientId = "60000000-0000-4000-8000-000000000001";
const HEIGHT_CM = 178;

const patient = {
  id: patientId,
  name: "Mohammad Jaber Abdullah",
  phone: "+5511999990000",
  cpf: "41288755601",
  medicalRecordNumber: 10001,
  bloodType: null,
  birthDate: "1984-03-12",
  notes: null,
  doctorUserId: "33333333-3333-3333-3333-333333333333",
  isActive: true,
  whatsappConsentAtUtc: null,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

// Série do handoff: nove coletas, só a primeira registrou altura — o IMC das demais
// vem do carry-forward que o backend aplica.
const dates = [
  "2025-02-10",
  "2025-04-15",
  "2025-06-20",
  "2025-08-25",
  "2025-10-30",
  "2026-01-12",
  "2026-03-18",
  "2026-05-22",
  "2026-07-28",
];
const weights = [92.4, 91.0, 89.6, 88.8, 87.5, 86.9, 85.8, 84.9, 84.1];
const fat = [28.4, 27.6, 26.5, 25.8, 24.7, 23.9, 23.1, 22.4, 21.9];
const arm = [36.5, 36.8, 37.0, 37.2, 37.4, 37.6, 37.8, 37.9, 38.0];
const waist = [96.0, 94.5, 93.0, 91.8, 90.2, 88.6, 87.1, 85.6, 84.0];

const assessments = dates
  .map((assessedOn, index) => ({
    id: `a-${index}`,
    patientId,
    assessedOn,
    createdAtUtc: `${assessedOn}T12:00:00Z`,
    measurements: [
      { type: "Peso", value: weights[index] },
      ...(index === 0 ? [{ type: "Altura", value: HEIGHT_CM }] : []),
      { type: "Gordura", value: fat[index] },
      { type: "Braco", value: arm[index] },
      { type: "Cintura", value: waist[index] },
    ],
    bmi: Number((weights[index] / (HEIGHT_CM / 100) ** 2).toFixed(1)),
  }))
  .reverse();

async function mockAvaliacoes(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-09T12:00:00Z"));
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === "/clinics/current") {
      body = {
        id: session.clinicId,
        name: "Clínica Vital",
        timeZoneId: "America/Sao_Paulo",
        phone: null,
        address: null,
        defaultAppointmentDurationMinutes: 30,
        plan: "Clinic",
        subscriptionStatus: "Active",
        maxDoctors: null,
        createdAtUtc: "2026-07-01T12:00:00Z",
      };
    } else if (url.pathname === `/patients/${patientId}`) {
      body = patient;
    } else if (url.pathname === "/patients") {
      body = [patient];
    } else if (url.pathname === `/assessments/patients/${patientId}`) {
      body = assessments;
    } else if (url.pathname === "/users/me") {
      body = {
        userId: session.userId,
        email: session.email,
        name: session.name,
        roles: session.roles,
        medicalLicense: null,
        medicalLicenseState: null,
        specialty: null,
      };
    }
    return route.fulfill({ status: 200, json: body });
  });
}

test("percorre tabela, gráfico agrupado, individual e o modal de registro", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAvaliacoes(page);
  await page.goto(`/app/pacientes/${patientId}/avaliacoes`);

  await expect(page.getByText("9 avaliações · fev 25 – jul 26")).toBeVisible();

  // Linha mais recente no topo: peso medido e IMC derivado da altura de fev/25.
  const latest = page.getByRole("row").filter({ hasText: "28/07/2026" });
  await expect(latest.getByRole("cell", { name: /^84,1/ })).toBeVisible();
  await expect(latest.getByRole("cell", { name: /^26,5/ })).toBeVisible();
  await expect(latest.getByRole("cell", { name: /−0,8 evolução favorável/ })).toBeVisible();

  await page.getByRole("button", { name: "Gráfico" }).click();
  await expect(page.getByRole("img", { name: /Evolução de Peso/ })).toBeVisible();

  await page.getByRole("button", { name: "Individual" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Peso" }).first(),
  ).toContainText("84,1");

  await page.getByRole("button", { name: "Nova avaliação" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Anterior: 84,1 kg")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

// A tabela tem dez colunas: ela pode rolar dentro do próprio card, a página não.
for (const width of [1440, 1280, 960, 640, 390]) {
  test(`a página não rola na horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAvaliacoes(page);
    await page.goto(`/app/pacientes/${patientId}/avaliacoes`);
    await expect(page.getByText("9 avaliações · fev 25 – jul 26")).toBeVisible();

    const scrollX = await page.evaluate(() => {
      window.scrollTo(2000, 0);
      const x = window.scrollX;
      window.scrollTo(0, 0);
      return x;
    });

    expect(scrollX).toBe(0);
  });
}
