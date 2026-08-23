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

const doctorUserId = "33333333-3333-3333-3333-333333333333";
const clinicalPatientId = "00000000-0000-4000-8000-000000000101";
const emptyClinicalPatientId = "00000000-0000-4000-8000-000000000102";
const clinicalExamId = "00000000-0000-4000-8000-000000000201";
const clinicalResultId = "00000000-0000-4000-8000-000000000301";

let record = 10000;
function makePatient(
  overrides: Partial<Record<string, unknown>> & { id: string; name: string },
) {
  record += 1;
  return {
    phone: "+5511999990000",
    cpf: "52998224725",
    medicalRecordNumber: record,
    bloodType: null,
    sexForClinicalUse: null,
    birthDate: "1984-03-12",
    notes: null,
    doctorUserId,
    isActive: true,
    whatsappConsentAtUtc: null,
    createdAtUtc: "2026-07-20T12:00:00Z",
    lastAppointmentUtc: "2026-08-03T14:00:00Z",
    nextAppointmentUtc: null,
    nextAppointmentType: null,
    situation: "EmAcompanhamento",
    ...overrides,
  };
}

// Elenco do handoff (situações e homônimos), com telefone no lugar de condição.
const patients = [
  makePatient({
    id: "60000000-0000-4000-8000-000000000001",
    name: "Mohammad Jaber Abdullah",
    cpf: "41288755601",
    birthDate: "1984-03-12",
    nextAppointmentUtc: "2026-08-10T17:00:00Z",
    nextAppointmentType: "Teleconsultation",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000002",
    name: "Rita de Cássia Alves",
    cpf: "31820477120",
    birthDate: "1968-09-27",
    nextAppointmentUtc: "2026-08-10T13:00:00Z",
    nextAppointmentType: "Teleconsultation",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000003",
    name: "Ana Beatriz Lima",
    cpf: "25941033688",
    birthDate: "1992-01-05",
    nextAppointmentUtc: "2026-08-11T12:00:00Z",
    nextAppointmentType: "InPerson",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000004",
    name: "Carlos Souza Filho",
    cpf: "10659948233",
    birthDate: "1975-06-19",
    situation: "ExamePendente",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000005",
    name: "Carlos Eduardo Souza",
    cpf: "74302195840",
    birthDate: "1981-11-02",
    situation: "ExamePendente",
    nextAppointmentUtc: "2026-08-12T18:00:00Z",
    nextAppointmentType: "InPerson",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000006",
    name: "Paula Ramos",
    cpf: "58133620495",
    birthDate: "1990-05-14",
    nextAppointmentUtc: "2026-08-11T12:30:00Z",
    nextAppointmentType: "InPerson",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000007",
    name: "Fernanda Costa",
    cpf: "93041266712",
    birthDate: "1987-07-30",
    situation: "NovoPaciente",
    lastAppointmentUtc: null,
    nextAppointmentUtc: "2026-08-10T11:30:00Z",
    nextAppointmentType: "InPerson",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000008",
    name: "Helena Martins",
    cpf: "27480811564",
    birthDate: "1959-12-08",
    situation: "Inativo",
    isActive: false,
    lastAppointmentUtc: "2026-06-01T14:00:00Z",
  }),
  makePatient({
    id: "60000000-0000-4000-8000-000000000009",
    name: "João Pedro Nunes",
    cpf: "66019472307",
    birthDate: "1996-04-21",
  }),
];

const clinicalPatient = makePatient({
  id: clinicalPatientId,
  name: "Paciente Exemplo",
  cpf: "00000000000",
  phone: "+5511000000000",
  medicalRecordNumber: 101,
  birthDate: "1990-01-15",
});

const emptyClinicalPatient = makePatient({
  id: emptyClinicalPatientId,
  name: "Paciente Sem Laudo",
  cpf: "00000000000",
  phone: "+5511000000000",
  medicalRecordNumber: 102,
  birthDate: "1992-02-20",
});

function clinicalSummary(patientId: string) {
  if (patientId !== clinicalPatientId) {
    return {
      latestReport: null,
      totalFindingCount: 0,
      findings: [],
      trends: [],
      latestCollectionDate: null,
      capabilities: { canRequest: true, canAttachDocument: true },
    };
  }

  const finding = {
    resultId: clinicalResultId,
    name: "CPK",
    valueText: "562",
    unit: "U/L",
    referenceText: "até 190 U/L",
    referenceState: "elevado",
    deltaPercent: 91.16,
  };
  return {
    latestReport: {
      id: clinicalExamId,
      patientId: clinicalPatientId,
      name: "Painel laboratorial sintético",
      category: "Laboratorio",
      clinicalOutcome: "Alterado",
      version: 1,
      metadata: {
        collectedAtLocal: "2026-08-08T08:30:00",
        issuedOn: "2026-08-08",
        validatedAtUtc: "2026-08-08T15:00:00Z",
        requesterName: "Profissional Exemplo",
        requesterRegistration: "CRM EX 0000",
        validatorName: "Médica Exemplo",
      },
      document: null,
      findings: [finding],
      results: [],
      notes: [],
      capabilities: {
        canOpenDocument: false,
        canViewHistory: true,
        canOpenCorrection: true,
      },
    },
    totalFindingCount: 1,
    findings: [finding],
    trends: [],
    latestCollectionDate: "2026-08-08",
    capabilities: { canRequest: true, canAttachDocument: true },
  };
}

async function mockPacientes(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-08T12:00:00Z"));
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, session);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown;
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
    } else if (url.pathname === "/patients") {
      body = patients;
    } else if (url.pathname === "/clinics/members") {
      // A busca global da topbar resolve médicos em qualquer tela.
      body = [
        {
          userId: doctorUserId,
          email: "helena@clinicavital.com.br",
          roles: ["Doctor"],
          isCreator: false,
          name: "Dra. Helena Costa",
          specialty: "Cardiologia",
        },
      ];
    } else if (url.pathname.startsWith("/patients/")) {
      body = [...patients, clinicalPatient, emptyClinicalPatient].find(
        (patient) => url.pathname.endsWith(patient.id),
      );
    } else if (
      url.pathname.startsWith("/exams/patients/") &&
      url.pathname.endsWith("/clinical-summary")
    ) {
      const patientId = url.pathname.split("/").at(-2) ?? "";
      body = clinicalSummary(patientId);
    } else if (url.pathname.endsWith("/grid")) {
      body = { dates: [], rows: [] };
    } else if (
      url.pathname.startsWith("/assessments/") ||
      url.pathname.startsWith("/exams/") ||
      url.pathname.startsWith("/appointments/")
    ) {
      body = [];
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
    } else {
      return route.fulfill({ status: 404, json: { title: "Not found" } });
    }
    return route.fulfill({ status: 200, json: body });
  });
}

test.use({ viewport: { width: 1440, height: 1020 } });

test("lista completa: 9 pacientes em ordem alfabética com resumo", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");

  await expect(page.getByText("9 de 9")).toBeVisible();
  const rows = page.getByRole("button", { name: /Abrir detalhes de/ });
  await expect(rows).toHaveCount(9);
  await expect(rows.first()).toContainText("Ana Beatriz Lima");
  await expect(rows.last()).toContainText("Rita de Cássia Alves");

  const mohammad = rows.filter({ hasText: "Mohammad Jaber Abdullah" });
  await expect(mohammad).toContainText("CPF 412.887.556-01");
  await expect(mohammad).toContainText("42 anos");
  await expect(mohammad).toContainText("03/08/2026");
  await expect(mohammad).toContainText("10/08 · 14:00");
  await expect(mohammad).toContainText("Em acompanhamento");
  await expect(mohammad.getByLabel("Teleconsulta")).toBeVisible();

  await page.screenshot({
    path: "test-results/pacientes-01-lista-completa.png",
    fullPage: false,
  });
});

test("chip Exame pendente filtra a lista e o contador", async ({ page }) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");
  await expect(page.getByText("9 de 9")).toBeVisible();

  await page.getByRole("button", { name: "Exame pendente · 2" }).click();

  await expect(page.getByText("2 de 9")).toBeVisible();
  const rows = page.getByRole("button", { name: /Abrir detalhes de/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Carlos Eduardo Souza");
  await expect(rows.last()).toContainText("Carlos Souza Filho");

  await page.screenshot({
    path: "test-results/pacientes-02-filtro-exame-pendente.png",
    fullPage: false,
  });
});

test("filtro da lista responde a cada tecla e desambigua homônimos", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");
  await expect(page.getByText("9 de 9")).toBeVisible();

  await page.getByRole("searchbox", { name: "Filtrar pacientes" }).fill("carlos");

  await expect(page.getByText("2 de 9")).toBeVisible();
  const rows = page.getByRole("button", { name: /Abrir detalhes de/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("CPF 743.021.958-40");
  await expect(rows.last()).toContainText("CPF 106.599.482-33");

  await page.screenshot({
    path: "test-results/pacientes-03-busca-carlos.png",
    fullPage: false,
  });

  await page.getByRole("searchbox", { name: "Filtrar pacientes" }).fill("");
  await expect(page.getByText("9 de 9")).toBeVisible();
});

test("busca global abre a ficha do paciente de qualquer tela", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto("/app/configuracoes/perfil");

  const search = page.getByRole("combobox", { name: "Busca global" });
  await search.fill("carlos edu");

  const result = page.getByRole("option", { name: /Carlos Eduardo Souza/ });
  await expect(result).toContainText("Ficha");
  await page.screenshot({
    path: "test-results/pacientes-06-busca-global.png",
    fullPage: false,
  });

  await result.click();
  await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]+$/);

  // O item aberto volta como recente ao focar a busca vazia.
  await search.click();
  await expect(
    page.getByRole("option", { name: /Carlos Eduardo Souza\. Paciente/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pacientes-08-busca-recentes.png",
    fullPage: false,
  });
});

test("busca global sem resultado leva ao cadastro com o nome preenchido", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");

  await page
    .getByRole("combobox", { name: "Busca global" })
    .fill("Beatriz Nogueira");

  await expect(
    page.getByText("Nenhum resultado para “Beatriz Nogueira”."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pacientes-07-busca-global-vazia.png",
    fullPage: false,
  });

  await page
    .getByRole("option", {
      name: "Cadastrar “Beatriz Nogueira” como novo paciente",
    })
    .click();

  await expect(page).toHaveURL(/\/app\/pacientes\/novo/);
  await expect(page.getByLabel("Nome completo")).toHaveValue(
    "Beatriz Nogueira",
  );
});

test("busca sem resultado mostra estado vazio com cadastro", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");
  await expect(page.getByText("9 de 9")).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Filtrar pacientes" })
    .fill("zuleide xavier");

  await expect(
    page.getByText("Nenhum paciente encontrado para “zuleide xavier”."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pacientes-04-estado-vazio.png",
    fullPage: false,
  });

  await page
    .getByRole("button", { name: "+ Cadastrar novo paciente" })
    .click();
  await expect(page).toHaveURL(/\/app\/pacientes\/novo/);
});

test("cadastro em etapas e edição enviam o sexo para referência laboratorial", async ({
  page,
}) => {
  await mockPacientes(page);

  await page.goto("/app/pacientes/novo");
  const stepper = page.getByRole("list", {
    name: "Etapas do cadastro do paciente",
  });
  await expect(stepper).toBeVisible();
  await expect(stepper).toContainText("Identificação");
  await expect(stepper).toContainText("Dados clínicos");
  await expect(stepper).toContainText("Atendimento");
  await expect(stepper.locator('[aria-current="step"]')).toContainText(
    "Identificação",
  );
  await expect(
    page.getByRole("heading", { name: "Identifique o paciente" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(1440);

  const nameField = page.getByLabel("Nome completo");
  await nameField.focus();
  expect(
    await nameField.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
  for (const control of [
    nameField,
    page.getByLabel("WhatsApp"),
    page.getByLabel("CPF"),
    page.getByRole("button", { name: "Continuar" }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await nameField.fill("Marina Oliveira");
  await page.getByLabel("WhatsApp").fill("+5511999990000");
  await page.getByLabel("CPF").fill("52998224725");
  await page.screenshot({
    path: "test-results/pacientes-09-cadastro-identificacao.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Dados clínicos" })).toBeVisible();
  await page.getByLabel("Data de nascimento").fill("1984-03-12");
  await page.getByLabel("Tipo sanguíneo").selectOption("ABNegative");
  await page
    .getByLabel("Sexo para referência laboratorial")
    .selectOption("Feminino");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Organize o atendimento" }),
  ).toBeVisible();
  await expect(stepper.locator('[aria-current="step"]')).toContainText(
    "Atendimento",
  );
  await page.getByLabel("Médico responsável").selectOption(doctorUserId);
  await page.getByLabel("Observações").fill("Retorno em 30 dias");
  await page.screenshot({
    path: "test-results/pacientes-10-cadastro-atendimento.png",
    fullPage: true,
  });
  const created = page.waitForRequest(
    (request) => request.url().endsWith("/patients") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar paciente" }).click();
  expect((await created).postDataJSON()).toEqual({
    name: "Marina Oliveira",
    phone: "+5511999990000",
    cpf: "52998224725",
    bloodType: "ABNegative",
    sexForClinicalUse: "Feminino",
    doctorUserId,
    birthDate: "1984-03-12",
    notes: "Retorno em 30 dias",
  });

  const patient = patients[0];
  await page.goto(`/app/pacientes/${patient.id}/editar`);
  await expect(page.getByLabel("Sexo para referência laboratorial")).toHaveValue("");
  await page.getByLabel("CPF").fill("52998224725");
  await page
    .getByLabel("Sexo para referência laboratorial")
    .selectOption("Masculino");
  const updated = page.waitForRequest(
    (request) =>
      request.url().endsWith(`/patients/${patient.id}`) && request.method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  expect((await updated).postDataJSON()).toMatchObject({
    sexForClinicalUse: "Masculino",
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("filtro da lista e busca global convivem no mobile", async ({
    page,
  }) => {
    await mockPacientes(page);
    await page.goto("/app/pacientes");
    await expect(page.getByText("9 de 9")).toBeVisible();
    // A busca global continua na topbar mesmo na largura menor.
    await expect(
      page.getByRole("combobox", { name: "Busca global" }),
    ).toBeVisible();

    await page
      .getByRole("searchbox", { name: "Filtrar pacientes" })
      .fill("rita");

    await expect(page.getByText("1 de 9")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir detalhes de Rita de Cássia Alves" }),
    ).toBeVisible();

    await page.screenshot({
      path: "test-results/pacientes-05-mobile.png",
      fullPage: false,
    });
  });

  test("cadastro em etapas permanece íntegro no mobile", async ({ page }) => {
    await mockPacientes(page);
    await page.goto("/app/pacientes/novo");

    const stepper = page.getByRole("list", {
      name: "Etapas do cadastro do paciente",
    });
    await expect(stepper).toContainText("Identificação");
    await expect(stepper).toContainText("Dados clínicos");
    await expect(stepper).toContainText("Atendimento");
    await expect(stepper.locator('[aria-current="step"]')).toContainText(
      "Identificação",
    );
    await expect(
      page.getByRole("heading", { name: "Identifique o paciente" }),
    ).toBeVisible();
    const form = page.locator("form");
    const formBox = await form.boundingBox();
    expect(formBox).not.toBeNull();
    expect(formBox!.x).toBeGreaterThanOrEqual(0);
    expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
    for (const control of [
      page.getByLabel("Nome completo"),
      page.getByLabel("WhatsApp"),
      page.getByLabel("CPF"),
      page.getByRole("button", { name: "Continuar" }),
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByLabel("Nome completo").fill("Marina Oliveira");
    await page.getByLabel("WhatsApp").fill("+5511999990000");
    await page.getByLabel("CPF").fill("52998224725");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Médico responsável")).toBeVisible();
    await expect(stepper.locator('[aria-current="step"]')).toContainText(
      "Atendimento",
    );

    await page.screenshot({
      path: "test-results/pacientes-11-cadastro-mobile.png",
      fullPage: true,
    });
  });
});

test("clique na linha abre os detalhes do paciente", async ({ page }) => {
  await mockPacientes(page);
  await page.goto("/app/pacientes");

  await page
    .getByRole("button", { name: "Abrir detalhes de Paula Ramos" })
    .click();

  await expect(page).toHaveURL(
    /\/app\/pacientes\/60000000-0000-4000-8000-000000000006$/,
  );
});

test("visão geral sem laudo validado orienta a próxima coleta", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto(
    `/app/pacientes/${emptyClinicalPatientId}`,
  );

  await expect(
    page.getByRole("heading", { name: "Nenhum laudo validado" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A evolução aparece após duas coletas validadas com o mesmo analito.",
    ),
  ).toBeVisible();
});

test("último laudo permanece visível quando ainda não há histórico", async ({
  page,
}) => {
  await mockPacientes(page);
  await page.goto(`/app/pacientes/${clinicalPatientId}`);

  await expect(
    page.getByRole("heading", { name: "Painel laboratorial sintético" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A evolução aparece após duas coletas validadas com o mesmo analito.",
    ),
  ).toBeVisible();
});
