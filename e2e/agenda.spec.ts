import { expect, test, type Page } from "@playwright/test";

const session = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "ana@clinicavital.com.br",
  phone: "+5511988887777",
  clinicId: "22222222-2222-2222-2222-222222222222",
  clinicName: "Clínica Vital",
  userClinicId: "uc-secretary",
  clinicRole: "Secretary",
  isAdmin: true,
  roles: ["Admin", "Secretary"],
  name: "Ana Martins",
  availableClinics: [{
    userClinicId: "uc-secretary",
    clinicId: "22222222-2222-2222-2222-222222222222",
    clinicName: "Clínica Vital",
    role: "Secretary",
    isAdmin: true,
  }],
  tokens: {
    accessToken: "visual-test-token",
    refreshToken: "visual-test-refresh",
    accessTokenExpiresAtUtc: "2030-07-28T12:00:00Z",
  },
};

/** Projeção contextual usada pela gestão de vínculos v2. */
function toClinicMember(member: (typeof members)[number]) {
  return {
    userClinicId: member.userClinicId,
    userId: member.userId,
    clinicId: session.clinicId,
    displayName: member.displayName,
    status: "Active",
    role: "Doctor",
    isAdmin: false,
    isOwner: false,
    email: member.email,
    phone: "+5511988887770",
    emailConfirmedAtUtc: "2026-07-01T12:00:00Z",
    phoneConfirmedAtUtc: null,
    doctorProfile: {
      professionalAuthority: "CRM",
      professionalRegistrationNumber: "123456",
      professionalRegistrationRegion: "SP",
      professionalRegistrationCountryCode: "BR",
      specialty: member.specialty,
      practiceAreas: null,
      bio: null,
      defaultAppointmentDurationMinutes: 30,
    },
    defaultAppointmentDurationSource: "Configured",
    sessionVersion: 1,
    createdAtUtc: "2026-07-01T12:00:00Z",
    updatedAtUtc: "2026-07-01T12:00:00Z",
  };
}

const members = [
  {
    userClinicId: "uc-doctor-1",
    userId: "33333333-3333-3333-3333-333333333333",
    email: "helena@clinicavital.com.br",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    displayName: "Dra. Helena Costa",
    role: "Doctor" as const,
    isAdmin: false,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: 30,
  },
  {
    userClinicId: "uc-doctor-2",
    userId: "44444444-4444-4444-4444-444444444444",
    email: "rafael@clinicavital.com.br",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dr. Rafael Lima",
    displayName: "Dr. Rafael Lima",
    role: "Doctor" as const,
    isAdmin: false,
    specialty: "Clínica geral",
    defaultAppointmentDurationMinutes: 30,
  },
];

const appointments = [
  {
    id: "55555555-5555-5555-5555-555555555555",
    patientId: "66666666-6666-6666-6666-666666666666",
    patientName: "Marina Oliveira",
    doctorUserId: members[0].userId,
    startUtc: "2026-07-28T12:00:00Z",
    endUtc: "2026-07-28T12:45:00Z",
    status: "Confirmed",
    type: "InPerson",
    notes: "Retorno com exames recentes.",
    createdAtUtc: "2026-07-20T12:00:00Z",
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    patientId: "88888888-8888-8888-8888-888888888888",
    patientName: "Paulo Mendes",
    doctorUserId: members[1].userId,
    startUtc: "2026-07-28T14:30:00Z",
    endUtc: "2026-07-28T15:00:00Z",
    status: "AwaitingPatientAction",
    type: "Teleconsultation",
    notes: null,
    createdAtUtc: "2026-07-20T12:00:00Z",
  },
];

const patients = [
  {
    id: appointments[0].patientId,
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "52998224725",
    name: appointments[0].patientName,
    phone: "+5511999990000",
    email: null,
    medicalRecordNumber: 48213,
    bloodType: "APositive",
    birthDate: "1990-01-10",
    notes: null,
    isActive: true,
    createdAtUtc: "2026-07-20T12:00:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "11144477735",
    name: "Carlos Souza",
    phone: "+5511999990001",
    email: null,
    medicalRecordNumber: 46990,
    bloodType: "BNegative",
    birthDate: "1975-11-22",
    notes: null,
    isActive: true,
    createdAtUtc: "2026-07-27T12:00:00Z",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "12345678909",
    name: "Carlos Souza",
    phone: "+5511999990002",
    email: null,
    medicalRecordNumber: 50871,
    bloodType: "ANegative",
    birthDate: "1990-01-09",
    notes: null,
    isActive: true,
    createdAtUtc: "2026-07-26T12:00:00Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "39053344705",
    name: "Ana Beatriz Lima",
    phone: "+5511999990003",
    email: null,
    medicalRecordNumber: 51102,
    bloodType: "OPositive",
    birthDate: "1988-07-04",
    notes: null,
    isActive: true,
    createdAtUtc: "2026-07-25T12:00:00Z",
  },
];

const createdAppointmentId = "40000000-0000-4000-8000-000000000001";

interface MockClinicFlowOptions {
  hasDoctor?: boolean;
  roles?: Array<"Admin" | "Doctor" | "Secretary">;
  userId?: string;
  appointmentConflict?: boolean;
}

async function mockClinicFlow(
  page: Page,
  options: MockClinicFlowOptions = {},
) {
  const hasDoctor = options.hasDoctor ?? true;
  const roleUser = members.find((member) => member.userId === options.userId);
  const currentSession = {
    ...session,
    userId: options.userId ?? session.userId,
    roles: options.roles ?? session.roles,
    name: roleUser?.name ?? session.name,
    email: roleUser?.email ?? session.email,
    phone: roleUser ? "+5511988887777" : session.phone,
    userClinicId: roleUser?.userClinicId ?? session.userClinicId,
    clinicRole: roleUser ? "Doctor" : "Secretary",
    isAdmin: (options.roles ?? session.roles).includes("Admin"),
  };
  const appointmentStore = [...appointments];
  const blockStore: Array<{ id: string; date: string; reason: string | null }> = [];
  let capturedBlock: unknown;
  let capturedCreatePayload: unknown;
  let availabilityRequestCount = 0;

  await page.clock.setFixedTime(new Date("2026-07-28T10:00:00Z"));
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, currentSession);

  await page.route("http://localhost:5094/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let body: unknown;
    if (url.pathname === "/clinics/current") {
      body = {
        id: currentSession.clinicId,
        name: "Clínica Vital",
        timeZoneId: "America/Sao_Paulo",
        phone: "+551130000000",
        address: "Rua das Flores, 120",
        plan: "Clinic",
        subscriptionStatus: "Active",
        maxDoctors: null,
        createdAtUtc: "2026-07-01T12:00:00Z",
      };
    } else if (url.pathname === `/clinics/${currentSession.clinicId}/members`) {
      body = hasDoctor ? members.map(toClinicMember) : [];
    } else if (url.pathname === `/clinics/${currentSession.clinicId}/members/summary`) {
      body = hasDoctor ? members : [];
    } else if (url.pathname === "/healthcare-plans") {
      body = [{ id: "c0000000-0000-0000-0000-000000000001", name: "Particular" }];
    } else if (/^\/clinics\/[^/]+\/members\/[^/]+\/healthcare-plans$/.test(url.pathname)) {
      const userClinicId = url.pathname.split("/").at(-2)!;
      body = { userClinicId, healthcarePlanIds: [] };
    } else if (url.pathname === "/users/me") {
      body = {
        userId: currentSession.userId,
        email: currentSession.email,
        phone: currentSession.phone,
        name: currentSession.name,
        role: currentSession.clinicRole,
        isAdmin: currentSession.isAdmin,
        medicalLicense: currentSession.roles.includes("Doctor")
          ? "123456"
          : null,
        medicalLicenseState: currentSession.roles.includes("Doctor")
          ? "SP"
          : null,
        specialty: currentSession.roles.includes("Doctor")
          ? (roleUser?.specialty ?? "Cardiologia")
          : null,
      };
    } else if (url.pathname === "/appointments" && method === "POST") {
      capturedCreatePayload = route.request().postDataJSON();
      if (options.appointmentConflict) {
        return route.fulfill({
          status: 409,
          contentType: "application/problem+json",
          json: {
            title: "Conflito de horário",
            detail: "O horário acabou de ser ocupado. Escolha outro horário.",
          },
        });
      }
      const payload = capturedCreatePayload as {
        patientId: string;
        doctorUserId: string;
        startUtc: string;
        type: "InPerson" | "Teleconsultation";
        notes: null;
      };
      const patient = patients.find((item) => item.id === payload.patientId)!;
      const created = {
        id: createdAppointmentId,
        patientId: payload.patientId,
        patientName: patient.name,
        doctorUserId: payload.doctorUserId,
        startUtc: payload.startUtc,
        endUtc: "2026-08-10T12:30:00Z",
        status: "AwaitingPatientAction",
        type: payload.type,
        notes: payload.notes,
        createdAtUtc: "2026-07-28T10:00:00Z",
      };
      appointmentStore.push(created);
      return route.fulfill({ status: 200, json: created });
    } else if (url.pathname === "/appointments") {
      const from = Date.parse(url.searchParams.get("from") ?? "");
      const to = Date.parse(url.searchParams.get("to") ?? "");
      const doctorId = url.searchParams.get("doctorId");
      body = appointmentStore.filter((appointment) => {
        const start = Date.parse(appointment.startUtc);
        const insideRange = Number.isNaN(from) || Number.isNaN(to)
          ? true
          : start >= from && start < to;
        return (
          insideRange &&
          (!doctorId || appointment.doctorUserId === doctorId)
        );
      });
    } else if (url.pathname === "/patients") {
      const search = url.searchParams.get("search")?.trim().toLocaleLowerCase(
        "pt-BR",
      );
      body = search
        ? patients.filter((patient) =>
            `${patient.name} ${patient.document} ${patient.medicalRecordNumber}`
              .toLocaleLowerCase("pt-BR")
              .includes(search),
          )
        : patients;
    } else if (url.pathname.startsWith("/patients/")) {
      body = patients.find((patient) => url.pathname.endsWith(patient.id));
    } else if (
      url.pathname === `/doctors/${members[0].userId}/availability`
    ) {
      availabilityRequestCount += 1;
      const slots = [
        {
          startUtc: "2026-08-10T12:00:00Z",
          endUtc: "2026-08-10T12:30:00Z",
          label: "09:00",
        },
        {
          startUtc: "2026-08-10T12:30:00Z",
          endUtc: "2026-08-10T13:00:00Z",
          label: "09:30",
        },
      ];
      body = {
        doctorUserId: members[0].userId,
        timeZoneId: "America/Sao_Paulo",
        slotDurationMinutes: 30,
        days: [
          {
            date: "2026-08-10",
            status: "Available",
            slots:
              options.appointmentConflict && availabilityRequestCount > 1
                ? slots.slice(1)
                : slots,
          },
          { date: "2026-08-11", status: "Full", slots: [] },
          { date: "2026-08-12", status: "Blocked", slots: [] },
        ],
      };
    } else if (
      url.pathname === `/doctors/${members[1].userId}/availability`
    ) {
      body = {
        doctorUserId: members[1].userId,
        timeZoneId: "America/Sao_Paulo",
        slotDurationMinutes: 30,
        days: [{ date: "2026-07-28", status: "Available", slots: [] }],
      };
    } else if (
      /^\/doctors\/[^/]+\/schedule\/blocks$/.test(url.pathname) &&
      method === "POST"
    ) {
      const payload = route.request().postDataJSON();
      capturedBlock = payload;
      blockStore.push({
        id: "40000000-0000-4000-8000-000000000001",
        date: payload.date,
        reason: payload.reason,
      });
      body = blockStore.at(-1);
    } else if (
      /^\/doctors\/[^/]+\/schedule\/blocks\//.test(url.pathname) &&
      method === "DELETE"
    ) {
      blockStore.length = 0;
      return route.fulfill({ status: 204 });
    } else if (
      /^\/doctors\/[^/]+\/schedule$/.test(url.pathname) &&
      method === "GET"
    ) {
      body = {
        doctorUserId: url.pathname.split("/")[2],
        slotDurationMinutes: 30,
        intervals: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            dayOfWeek: "Monday",
            startLocal: "08:00:00",
            endLocal: "12:00:00",
          },
        ],
        blocks: [...blockStore],
      };
    } else if (url.pathname.startsWith("/appointments/")) {
      body = appointmentStore.find(
        (appointment) => url.pathname.endsWith(appointment.id),
      );
    } else if (url.pathname === "/onboarding/status") {
      body = {
        completed: false,
        completedCount: hasDoctor ? 3 : 2,
        totalCount: 5,
        steps: [
          {
            code: "clinic",
            label: "Completar dados da clínica",
            path: "/app/configuracoes/clinica",
            completed: true,
            blocked: false,
          },
          {
            code: "doctor",
            label: "Adicionar o primeiro médico",
            path: "/app/equipe/novo",
            completed: hasDoctor,
            blocked: false,
          },
          {
            code: "patient",
            label: "Cadastrar o primeiro paciente",
            path: "/app/pacientes/novo",
            completed: false,
            blocked: false,
          },
          {
            code: "appointment",
            label: "Agendar a primeira consulta",
            path: "/app/agenda/nova",
            completed: false,
            blocked: true,
          },
          {
            code: "whatsapp",
            label: "Conectar as confirmações por WhatsApp",
            path: "/app/configuracoes/whatsapp",
            completed: true,
            blocked: false,
          },
        ],
      };
    } else {
      return route.fulfill({ status: 404, json: { title: "Not found" } });
    }
    return route.fulfill({ status: 200, json: body });
  });

  return {
    get createPayload() {
      return capturedCreatePayload;
    },
    get blockPayload() {
      return capturedBlock;
    },
    get availabilityRequests() {
      return availabilityRequestCount;
    },
  };
}

async function selectBookingChoices(page: Page) {
  await page.getByRole("button", { name: "Dra. Helena Costa" }).click();
  await page.getByRole("button", { name: "Presencial" }).click();
  await page
    .getByRole("button", { name: /10 de agosto de 2026, disponível/ })
    .click();
  await page.getByRole("button", { name: "09:00" }).click();
}

async function expectNoGlobalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        documentFits:
          document.documentElement.scrollWidth <= window.innerWidth,
        bodyFits: document.body.scrollWidth <= window.innerWidth,
      })),
    )
    .toEqual({ documentFits: true, bodyFits: true });
}

async function expectMinimumTouchTargets(page: Page) {
  const undersized = await page.locator("main button:visible").evaluateAll(
    (buttons) =>
      buttons
        .map((button) => {
          const box = button.getBoundingClientRect();
          return {
            name: button.getAttribute("aria-label") ?? button.textContent?.trim(),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })
        .filter((button) => button.width < 44 || button.height < 44),
  );
  expect(undersized).toEqual([]);
}

test("agenda consulta completa e retorna ao detalhe criado", async ({ page }) => {
  const mock = await mockClinicFlow(page);
  await page.goto("/app/agenda?date=2026-08-10");

  await page.getByRole("button", { name: "Nova consulta" }).click();
  await page.getByRole("menuitem", { name: /Agendar consulta/ }).click();
  await expect(page).toHaveURL(
    `/app/agenda/nova?date=2026-08-10&doctorId=${members[0].userId}`,
  );

  await page.getByRole("button", { name: "Selecionar paciente" }).click();
  await page.getByRole("searchbox", { name: "Buscar paciente" }).fill("Marina");
  await page.getByRole("button", { name: /Marina Oliveira/ }).click();
  await selectBookingChoices(page);
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page).toHaveURL(
    `/app/agenda?date=2026-08-10&doctorId=${members[0].userId}&appointmentId=${createdAppointmentId}&created=true`,
  );
  expect(mock.createPayload).toEqual({
    patientId: patients[0].id,
    doctorUserId: members[0].userId,
    startUtc: "2026-08-10T12:00:00Z",
    type: "InPerson",
    notes: null,
  });
  await expect(page.getByRole("status", { name: "Agendamento aguardando paciente" }))
    .toContainText(
      "Aguardando a confirmação do paciente e o compartilhamento dos dados com o médico",
    );
  const timeline = page.getByRole("region", { name: "Dra. Helena Costa" });
  await expect(timeline.getByText("Marina Oliveira")).toBeVisible();
  await expect(timeline.getByText("09:00")).toBeVisible();
});

test("consulta rápida agenda o primeiro horário e opera o menu por teclado", async ({
  page,
}) => {
  const mock = await mockClinicFlow(page);
  await page.goto("/app/agenda?date=2026-08-10");

  const trigger = page.getByRole("button", { name: "Nova consulta" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("menu", { name: "Nova consulta" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menu", { name: "Nova consulta" }),
  ).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: /Consulta rápida/ }).click();
  await expect(page).toHaveURL(
    `/app/agenda/nova?date=2026-08-10&doctorId=${members[0].userId}&mode=quick`,
  );
  await expect(
    page.getByRole("heading", { name: "Consulta rápida" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Presencial" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table", { name: /Calendário/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "09:00" })).toHaveCount(0);

  await page.getByRole("button", { name: "Selecionar paciente" }).click();
  await page.getByRole("searchbox", { name: "Buscar paciente" }).fill("Marina");
  await page.getByRole("button", { name: /Marina Oliveira/ }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page).toHaveURL(
    `/app/agenda?date=2026-08-10&doctorId=${members[0].userId}&appointmentId=${createdAppointmentId}&created=true`,
  );
  expect(mock.createPayload).toEqual({
    patientId: patients[0].id,
    doctorUserId: members[0].userId,
    startUtc: "2026-08-10T12:00:00Z",
    type: "InPerson",
    notes: null,
  });
  await expect(page.getByRole("status", { name: "Agendamento aguardando paciente" }))
    .toContainText(
      "Aguardando a confirmação do paciente e o compartilhamento dos dados com o médico",
    );
});

test("preserva o contexto e oferece outro horário após conflito 409", async ({
  page,
}) => {
  const mock = await mockClinicFlow(page, { appointmentConflict: true });
  await page.goto(
    `/app/agenda/nova?date=2026-08-10&patientId=${patients[0].id}`,
  );
  await expect(
    page
      .getByRole("region", { name: "Paciente" })
      .getByText("Marina Oliveira", { exact: true }),
  ).toBeVisible();
  await selectBookingChoices(page);

  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "O horário acabou de ser ocupado. Escolha outro horário.",
  );
  await expect(
    page.getByRole("button", { name: "Dra. Helena Costa, selecionada" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Presencial" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", {
      name: /10 de agosto de 2026, disponível, selecionado/,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Confirmar agendamento" }),
  ).toBeDisabled();
  await expect.poll(() => mock.availabilityRequests).toBe(2);
  await expect(
    page
      .getByRole("region", { name: "Paciente" })
      .getByText("Marina Oliveira", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "09:30" })).toBeVisible();
});

test("agenda consulta completa somente com teclado", async ({ page }) => {
  await mockClinicFlow(page);
  await page.goto("/app/agenda/nova?date=2026-08-10");

  const patientTrigger = page.getByRole("button", {
    name: "Selecionar paciente",
  });
  await patientTrigger.focus();
  await page.keyboard.press("Enter");
  const search = page.getByRole("searchbox", { name: "Buscar paciente" });
  await expect(search).toBeFocused();
  await search.fill("Carlos");
  await expect(
    page.getByRole("button", { name: /Carlos Souza.*\+5511999990001/ }),
  ).toBeVisible();
  await search.focus();
  await page.keyboard.press("Enter");

  for (const control of [
    page.getByRole("button", { name: "Dra. Helena Costa" }),
    page.getByRole("button", { name: "Presencial" }),
    page.getByRole("button", {
      name: /10 de agosto de 2026, disponível/,
    }),
    page.getByRole("button", { name: "09:00" }),
    page.getByRole("button", { name: "Confirmar agendamento" }),
  ]) {
    await control.focus();
    await expect(control).toBeFocused();
    await page.keyboard.press("Enter");
  }

  await expect(page.getByRole("status", { name: "Agendamento aguardando paciente" }))
    .toContainText("Aguardando a confirmação do paciente");
});

test("exibe pacientes recentes e distingue homônimos na busca", async ({
  page,
}) => {
  await mockClinicFlow(page);
  await page.goto("/app/agenda/nova?date=2026-08-10");
  await page.getByRole("button", { name: "Selecionar paciente" }).click();

  await expect(page.getByText("Pacientes recentes")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Pacientes encontrados" }).getByRole("button"),
  ).toHaveCount(3);
  await page.screenshot({
    path: "/private/tmp/clinicflow-booking-dialog-recent.png",
  });

  await page.getByRole("searchbox", { name: "Buscar paciente" }).fill("Carlos");
  const resultList = page.getByRole("list", { name: "Pacientes encontrados" });
  await expect(resultList.getByRole("button")).toHaveCount(2);
  await expect(resultList.getByText("Carlos Souza", { exact: true })).toHaveCount(
    2,
  );
  await expect(resultList.getByText("+5511999990001")).toBeVisible();
  await expect(resultList.getByText("+5511999990002")).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-booking-dialog-carlos.png",
  });
});

test("calendário não recorta os textos de estado", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/app/agenda/nova?date=2026-08-10&patientId=${patients[0].id}`,
  );
  await selectBookingChoices(page);

  const clippedDays = await page.locator('[class*="dayCircle"]').evaluateAll(
    (days) =>
      days
        .filter(
          (day) =>
            day.scrollWidth > day.clientWidth + 1 ||
            day.scrollHeight > day.clientHeight + 1,
        )
        .map((day) => day.textContent?.trim()),
  );
  expect(clippedDays).toEqual([]);
  expect(await page.locator('[class*="dayCircle"]').count()).toBeGreaterThan(27);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 960, height: 900 },
  { name: "desktop", width: 1440, height: 1000 },
]) {
  test(`novo agendamento responde em ${viewport.name}`, async ({ page }) => {
    await mockClinicFlow(page);
    await page.setViewportSize(viewport);
    await page.goto(
      `/app/agenda/nova?date=2026-08-10&patientId=${patients[0].id}`,
    );

    await expect(
      page.getByRole("heading", { name: "Nova consulta" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Paciente" })
        .getByText("Marina Oliveira", { exact: true }),
    ).toBeVisible();
    await expectNoGlobalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/private/tmp/clinicflow-booking-${viewport.name}-initial.png`,
      fullPage: true,
    });

    await selectBookingChoices(page);
    await expect(
      page.getByRole("button", { name: "Confirmar agendamento" }),
    ).toBeEnabled();
    await expectNoGlobalOverflow(page);
    await expectMinimumTouchTargets(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/private/tmp/clinicflow-booking-${viewport.name}-selected.png`,
      fullPage: true,
    });
  });
}

test("médico mantém a identificação profissional no vínculo atual", async ({ page }) => {
  await mockClinicFlow(page, {
    roles: ["Doctor"],
    userId: members[0].userId,
  });
  await page.goto("/app/configuracoes/perfil");

  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  await expect(page.getByLabel("Registro profissional")).toHaveValue("123456");
  await expect(page.getByLabel("Especialidade")).toHaveValue("Cardiologia");
  await expect(page.getByRole("button", { name: "Salvar conta" })).toBeVisible();
  await expect(page.getByRole("group", { name: /Dias de atendimento/ })).toHaveCount(0);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`médico recebe o dashboard no Início em ${viewport.name}`, async ({ page }) => {
    await mockClinicFlow(page, {
      roles: ["Doctor"],
      userId: members[0].userId,
    });
    await page.setViewportSize(viewport);
    await page.goto("/app/inicio?date=2026-07-28");

    if (viewport.name === "desktop") {
      await expect(page.getByRole("link", { name: "Início" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("link", { name: "Agendas" })).toHaveAttribute(
        "href",
        "/app/agenda",
      );
    } else {
      await page.getByRole("button", { name: "Abrir navegação" }).click();
      await expect(page.getByRole("link", { name: "Início" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("link", { name: "Agendas" })).toHaveAttribute(
        "href",
        "/app/agenda",
      );
      await page.getByRole("button", { name: "Fechar navegação" }).click();
    }
    await expect(
      page.getByRole("heading", { name: "Bom dia, Dra. Helena" }),
    ).toBeVisible();
    await expect(page.getByText("Minha Agenda", { exact: true })).toHaveCount(0);
    const agenda = page.getByRole("region", { name: "Agenda do dia" });
    await expect(agenda.getByText("Marina Oliveira")).toBeVisible();
    await expect(agenda.getByText("09:00")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Marina Oliveira" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Pendências" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Sua semana" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Nova consulta$/ }),
    ).toBeVisible();
    if (viewport.name === "desktop") {
      await expect(
        page.getByRole("complementary").filter({
          has: page.getByRole("navigation", { name: "Navegação principal" }),
        }),
      ).toHaveCSS("width", "72px");
    }
    await expectNoGlobalOverflow(page);
    await expectMinimumTouchTargets(page);

    await page.screenshot({
      path: `/private/tmp/clinicflow-dashboard-${viewport.name}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /^Nova consulta$/ }).click();
    await expect(page).toHaveURL(
      `/app/agenda/nova?date=2026-07-28&doctorId=${members[0].userId}&origin=home`,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Navegação estrutural" })
        .getByText("Início", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Voltar para o início" }).click();
    await expect(page).toHaveURL("/app/inicio?date=2026-07-28");
  });
}

test("médico administrador separa o Início pessoal das Agendas da clínica", async ({
  page,
}) => {
  await mockClinicFlow(page, {
    roles: ["Admin", "Doctor"],
    userId: members[0].userId,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app");

  await expect(page).toHaveURL("/app/inicio");
  await expect(
    page.getByRole("link", { name: "Início" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Bom dia, Dra. Helena" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Agenda do dia" })
      .getByText("Marina Oliveira"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Agendas" }).click();
  await expect(page).toHaveURL("/app/agenda");
  await expect(
    page.getByRole("link", { name: "Agendas" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Por médico", { exact: true })).toBeVisible();
  await expect(page.getByText("Minha Agenda", { exact: true })).toHaveCount(0);

  const search = page.getByRole("combobox", { name: "Busca global" });
  await search.fill("rafael");
  await page.getByRole("option", { name: /Dr\. Rafael Lima/ }).click();
  await expect(page).toHaveURL(/doctorId=44444444-4444-4444-4444-444444444444/);
  await expect(page.getByText("Por médico", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Dr. Rafael Lima" }).getByText("Paulo Mendes"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Início" }).click();
  await expect(page).toHaveURL("/app/inicio");
  await expect(
    page.getByRole("heading", { name: "Bom dia, Dra. Helena" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Agenda do dia" })
      .getByText("Marina Oliveira"),
  ).toBeVisible();
});

test("médico sem administração acessa a agenda por médico pela hierarquia", async ({
  page,
}) => {
  await mockClinicFlow(page, {
    roles: ["Doctor"],
    userId: members[0].userId,
  });

  await page.goto("/app/agenda?date=2026-07-28");

  await expect(page).toHaveURL("/app/agenda?date=2026-07-28");
  await expect(
    page.getByRole("link", { name: "Agendas" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Por médico", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Dra. Helena Costa" })
      .getByText("Marina Oliveira"),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Nova consulta/ }).click();
  await page.getByRole("menuitem", { name: /Agendar consulta/ }).click();
  await expect(page).toHaveURL(
    `/app/agenda/nova?date=2026-07-28&doctorId=${members[0].userId}`,
  );
  await expect(
    page
      .getByRole("navigation", { name: "Navegação estrutural" })
      .getByText("Agendas", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar para a agenda" }).click();
  await expect(page).toHaveURL("/app/agenda?date=2026-07-28");
});

test("administrador abre o perfil médico contextual pela equipe", async ({
  page,
}) => {
  await mockClinicFlow(page, { roles: ["Admin", "Secretary"] });
  await page.goto("/app/equipe");

  const doctorRow = page.getByRole("button", {
    name: "Editar vínculo de Dra. Helena Costa",
  });
  await expect(doctorRow).toBeVisible();
  await doctorRow.click();
  await expect(page.getByRole("heading", { name: "Editar vínculo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfil médico nesta clínica" })).toBeVisible();
  await expect(page.getByLabel("Duração padrão da consulta")).toHaveValue("30");
});

test("secretária não configura agenda, mas pode agendar", async ({ page }) => {
  await mockClinicFlow(page, { roles: ["Secretary"] });
  await page.goto("/app/configuracoes/perfil");

  await expect(
    page.getByRole("heading", { name: "Cadastro médico" }),
  ).toHaveCount(0);
  await page.goto("/app/agenda/nova?date=2026-08-10");
  await expect(
    page.getByRole("heading", { name: "Nova consulta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Selecionar paciente" }),
  ).toBeEnabled();
});

test("mantém calendário, detalhe e onboarding no contexto em desktop", async ({
  page,
}) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/agenda");
  await expect(
    page.getByRole("heading", { name: "Dra. Helena Costa" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  const timeline = page.getByRole("region", { name: "Dra. Helena Costa" });
  await expect(timeline.getByText("Marina Oliveira")).toBeVisible();
  await expect(timeline.getByText("Retorno com exames recentes.")).toBeVisible();
  await expect(
    timeline.getByText("Cardiologia · Terça-feira, 28 de julho de 2026"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resumo do dia" }),
  ).toBeVisible();
  await expect(
    timeline.getByText(/\d+ horários? livres?/),
  ).toBeVisible();
  await expect(page.getByText("Horários livres", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-desktop.png",
    fullPage: true,
  });
});

test("troca de médico pela busca global da topbar", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/agenda");

  const timeline = page.getByRole("region", { name: "Dra. Helena Costa" });
  await expect(timeline.getByText("Marina Oliveira")).toBeVisible();

  const search = page.getByRole("combobox", { name: "Busca global" });
  await search.fill("clinica geral");

  const result = page.getByRole("option", { name: /Dr\. Rafael Lima/ });
  await expect(result).toContainText("Agenda");
  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-doctor-search.png",
  });
  await result.click();

  await expect(page).toHaveURL(/doctorId=44444444-4444-4444-4444-444444444444/);
  await expect(
    page.getByRole("region", { name: "Dr. Rafael Lima" }).getByText(
      "Paulo Mendes",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nova consulta · Dr. Rafael" }),
  ).toBeVisible();
  await expect(search).toHaveValue("");
});

test("⌘K foca a busca e o teclado escolhe o médico", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/agenda");
  await expect(
    page.getByRole("region", { name: "Dra. Helena Costa" }),
  ).toBeVisible();

  const search = page.getByRole("combobox", { name: "Busca global" });
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search).toBeFocused();

  await search.pressSequentially("rafael");
  await expect(page.getByRole("option", { name: /Dr\. Rafael Lima/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/doctorId=44444444-4444-4444-4444-444444444444/);
});

test("no mobile a busca global continua na topbar", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/agenda");

  const search = page.getByRole("combobox", { name: "Busca global" });
  await expect(search).toBeVisible();

  await search.fill("rafael");
  await page.getByRole("option", { name: /Dr\. Rafael Lima/ }).click();

  await expect(
    page.getByRole("heading", { name: "Dr. Rafael Lima" }),
  ).toBeVisible();
  await expect(search).toHaveValue("");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("adapta a agenda para uma lista cronológica no mobile", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/agenda");
  await expect(
    page.getByRole("heading", { name: "Dra. Helena Costa" }),
  ).toBeVisible();
  await expect(page.getByText("Marina Oliveira").last()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-mobile.png",
    fullPage: true,
  });
});

test("drawer mobile restaura foco depois de remover inert", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/agenda");

  const trigger = page.getByRole("button", { name: "Abrir navegação" });
  const drawer = page
    .getByRole("navigation", { name: "Navegação principal" })
    .locator("..");
  const workspace = page.getByRole("main").locator("..");

  await trigger.click();
  await expect(drawer).toBeFocused();
  await expect(workspace).toHaveAttribute("inert", "");

  await page.keyboard.press("Escape");
  await expect(workspace).not.toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();
});

test("mantém o rail oficial no limite de 960px sem recorte", async ({ page }) => {
  await mockClinicFlow(page);
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto("/app/agenda");

  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir navegação" })).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);

  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-tablet-960.png",
    fullPage: true,
  });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 900, height: 700 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`abre e cancela a página dedicada em ${viewport.name}`, async ({ page }) => {
    await mockClinicFlow(page);
    await page.setViewportSize(viewport);
    await page.goto("/app/agenda");

    const trigger = page.getByRole("button", { name: "Nova consulta" });
    await trigger.click();
    await page.getByRole("menuitem", { name: /Agendar consulta/ }).click();

    await expect(page).toHaveURL(
      /\/app\/agenda\/nova\?date=\d{4}-\d{2}-\d{2}&doctorId=[0-9a-f-]+$/,
    );
    const title = page.getByRole("heading", { name: "Nova consulta" });
    await expect(title).toBeVisible();
    await expect(title).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Selecionar paciente" }),
    ).toBeVisible();
    await page.screenshot({
      path: `/private/tmp/clinicflow-new-appointment-${viewport.name}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "Voltar para a agenda" }).click();

    await expect(page).toHaveURL(/\/app\/agenda\?date=\d{4}-\d{2}-\d{2}$/);
    await expect(title).toHaveCount(0);
  });
}

test("permite cadastrar paciente sem médico e mantém apenas a agenda dependente", async ({ page }) => {
  await mockClinicFlow(page, { hasDoctor: false });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/app/onboarding");

  await expect(
    page.getByRole("link", { name: "Adicionar o primeiro médico" }),
  ).toBeVisible();
  await expect(page.getByText("Cadastrar o primeiro paciente")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Cadastrar o primeiro paciente" }),
  ).toBeVisible();
  await expect(page.getByLabel("Etapa bloqueada")).toHaveCount(1);

  await page.screenshot({
    path: "/private/tmp/clinicflow-onboarding-doctor-required.png",
    fullPage: true,
  });

  await page.goto("/app/pacientes/novo");
  await expect(
    page.getByRole("heading", { name: "Identifique o paciente" }),
  ).toBeVisible();
});

test("recepção bloqueia o dia aberto direto na agenda", async ({ page }) => {
  const mock = await mockClinicFlow(page, { roles: ["Admin", "Secretary"] });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/agenda");

  const blocks = page.getByRole("region", { name: "Ausências" });
  await expect(blocks.getByText("Nenhuma data futura bloqueada.")).toBeVisible();

  await blocks.getByPlaceholder("Motivo (opcional)").fill("Congresso médico");
  await blocks.getByRole("button", { name: "Bloquear dia" }).click();

  await expect.poll(() => mock.blockPayload).toEqual({
    date: "2026-07-28",
    reason: "Congresso médico",
  });
  await expect(
    blocks.getByText("Congresso médico", { exact: true }),
  ).toBeVisible();
  await expect(blocks.getByText(/28\/07\/2026 está bloqueado/)).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/clinicflow-agenda-blocks.png",
    fullPage: true,
  });
});

test("secretária não bloqueia datas, mas enxerga as ausências", async ({
  page,
}) => {
  await mockClinicFlow(page, { roles: ["Secretary"] });
  await page.goto("/app/agenda");

  const blocks = page.getByRole("region", { name: "Ausências" });
  await expect(blocks).toBeVisible();
  await expect(
    blocks.getByRole("button", { name: "Bloquear dia" }),
  ).toHaveCount(0);
});
