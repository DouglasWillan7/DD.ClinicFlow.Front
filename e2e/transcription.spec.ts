import { expect, test, type Page } from "@playwright/test";

const appointmentId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";
const pointId = "66666666-6666-4666-8666-666666666666";

interface PointFixture {
  id: string;
  category: string;
  generatedText: string;
  reviewedText: string | null;
  displayText: string;
  status: string;
  version: number;
  firstEvidenceStartTimeMs: number;
  evidence: Array<{
    segmentId: string;
    quote: string;
    quoteStart: number;
    quoteLength: number;
    startTimeMs: number;
  }>;
}

function point(overrides: Partial<PointFixture> = {}): PointFixture {
  return {
    id: pointId,
    category: "Symptom",
    generatedText: "Paciente relata dor durante a consulta.",
    reviewedText: null,
    displayText: "Paciente relata dor durante a consulta.",
    status: "Draft",
    version: 1,
    firstEvidenceStartTimeMs: 2_000,
    evidence: [{
      segmentId: "segment-patient",
      quote: "dor",
      quoteStart: 14,
      quoteLength: 3,
      startTimeMs: 2_000,
    }],
    ...overrides,
  };
}

async function openConsultation(page: Page, options: {
  width: number;
  height?: number;
  roles?: Array<"Doctor" | "Secretary" | "Admin">;
  processingStatus?: "Available" | "Unavailable";
  initialPoints?: PointFixture[];
  expectAccess?: boolean;
}) {
  const roles = options.roles ?? ["Doctor"];
  const state = {
    points: options.initialPoints ?? [point()],
    processingStatus: options.processingStatus ?? "Available",
  };
  await page.setViewportSize({ width: options.width, height: options.height ?? 900 });
  await page.addInitScript((session) => {
    sessionStorage.setItem("clinicflow.session", JSON.stringify(session));
  }, {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "medica@example.test",
    phone: "+5511988887777",
    clinicId: "22222222-2222-4222-8222-222222222222",
    clinicName: "Clínica Vital",
    userClinicId: roles.includes("Doctor") ? "uc-doctor" : "uc-secretary",
    clinicRole: roles.includes("Doctor") ? "Doctor" : "Secretary",
    isAdmin: roles.includes("Admin"),
    roles,
    name: roles.includes("Doctor") ? "Dra. Ana Martins" : "Paula Souza",
    availableClinics: [{
      userClinicId: roles.includes("Doctor") ? "uc-doctor" : "uc-secretary",
      clinicId: "22222222-2222-4222-8222-222222222222",
      clinicName: "Clínica Vital",
      role: roles.includes("Doctor") ? "Doctor" : "Secretary",
      isAdmin: roles.includes("Admin"),
    }],
    tokens: {
      accessToken: "test-token",
      refreshToken: "refresh",
      accessTokenExpiresAtUtc: "2030-01-01T00:00:00Z",
    },
  });

  await page.route("http://localhost:5094/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/appointments/${appointmentId}`) return route.fulfill({ json: {
      id: appointmentId,
      patientId: "33333333-3333-4333-8333-333333333333",
      patientName: "Marina Oliveira",
      doctorUserId: "11111111-1111-4111-8111-111111111111",
      startUtc: "2026-08-12T12:00:00Z",
      endUtc: "2026-08-12T13:00:00Z",
      type: "InPerson",
      status: "Completed",
      notes: null,
      createdAtUtc: "2026-08-10T12:00:00Z",
    } });
    if (path === `/consultations/${appointmentId}/transcription`) return route.fulfill({ json: {
      session: {
        id: sessionId,
        appointmentId,
        startedAtUtc: "2026-08-12T12:00:00Z",
        endedAtUtc: "2026-08-12T12:42:13Z",
        status: "Completed",
        lastAudioSequence: 25_000,
        isDegraded: false,
      },
      segments: [
        {
          id: "segment-doctor",
          sequence: 1,
          providerStreamNumber: 1,
          providerSpeakerTag: 0,
          speakerRole: "Doctor",
          startTimeMs: 0,
          endTimeMs: 1_000,
          text: "Como você está se sentindo?",
        },
        {
          id: "segment-patient",
          sequence: 2,
          providerStreamNumber: 1,
          providerSpeakerTag: 1,
          speakerRole: "Patient",
          startTimeMs: 2_000,
          endTimeMs: 3_000,
          text: "Sentiu alguma dor?",
        },
      ],
    } });
    if (path === `/consultations/${appointmentId}/important-points` && route.request().method() === "GET") {
      return route.fulfill({ json: {
        sessionId,
        processingStatus: state.processingStatus,
        waitingForSpeakerCount: 0,
        updatedAtUtc: "2026-08-13T12:00:00Z",
        points: state.points,
      } });
    }
    if (path.startsWith("/consultation-important-points/") && path.endsWith("/review")) {
      const body = route.request().postDataJSON() as { action: string; text: string | null };
      state.points = state.points.map((current) => current.id === pointId ? {
        ...current,
        status: body.action === "Accept" ? "Accepted" : body.action === "Reject" ? "Rejected" : "Draft",
        reviewedText: body.action === "Edit" ? body.text : current.reviewedText,
        displayText: body.action === "Edit" && body.text ? body.text : current.displayText,
        version: current.version + 1,
      } : current);
      return route.fulfill({ json: state.points.find((current) => current.id === pointId) });
    }
    if (path === `/consultations/${appointmentId}/important-points/save`) {
      const accepted = state.points.filter((current) => current.status === "Accepted");
      if (accepted.length === 0) return route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        body: JSON.stringify({ detail: "Aceite ao menos um ponto antes de salvar." }),
      });
      const acceptedIds = new Set(accepted.map((current) => current.id));
      state.points = state.points.map((current) => acceptedIds.has(current.id) ? {
        ...current,
        status: "Saved",
        version: current.version + 1,
      } : current);
      return route.fulfill({ json: state.points.filter((current) => acceptedIds.has(current.id)) });
    }
    return route.fulfill({ status: 200, json: [] });
  });

  await page.goto(`/app/consultas/${appointmentId}`);
  if (options.expectAccess === false) {
    await expect(page).toHaveURL("/app/agenda");
  } else {
    await expect(page.getByRole("heading", { name: "Transcrição da consulta" })).toBeVisible();
  }
  return state;
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test("mobile 390 mantém ordem de leitura e não cria overflow", async ({ page }) => {
  await openConsultation(page, { width: 390, height: 844 });
  const headings = page.locator("aside h2");
  await expect(headings).toHaveText(["Pontos importantes", "Identificação das vozes", "Dados da consulta"]);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/consultation-points/390.png", fullPage: true });
});

test("tablet 960 mantém Pontos em largura integral e sem overflow", async ({ page }) => {
  await openConsultation(page, { width: 960 });
  await expect(page.getByRole("heading", { name: "Pontos importantes" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/consultation-points/960.png", fullPage: true });
});

test("desktop 1440 posiciona painel ao lado da transcrição", async ({ page }) => {
  await openConsultation(page, { width: 1440 });
  const transcript = await page.getByRole("region", { name: "Falas transcritas" }).boundingBox();
  const points = await page.getByRole("heading", { name: "Pontos importantes" }).locator("..", { hasText: "Pontos importantes" }).boundingBox();
  expect(transcript).not.toBeNull();
  expect(points).not.toBeNull();
  expect(points!.x).toBeGreaterThan(transcript!.x);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/consultation-points/1440.png", fullPage: true });
});

test("teclado leva foco à evidência literal e respeita movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openConsultation(page, { width: 960 });
  const evidence = page.getByRole("button", { name: /Ir ao trecho de Sintoma/ });
  await evidence.focus();
  await page.keyboard.press("Enter");

  const segment = page.locator('article[data-segment-id="segment-patient"]');
  await expect(segment).toBeFocused();
  await expect(segment.locator("mark")).toHaveText("dor");
  await expect(segment).toContainText("Sentiu alguma dor?");
  await expect(segment.locator("mark")).toHaveCount(0, { timeout: 1_800 });
});

test("aceita, salva e reconstrói Saved após recarregar", async ({ page }) => {
  await openConsultation(page, { width: 960 });
  await page.getByRole("button", { name: "Aceitar ponto" }).click();
  await expect(page.getByText("Aceito", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar pontos no prontuário" }).click();
  await expect(page.getByText("Pontos salvos no prontuário do paciente.")).toBeVisible();
  await page.reload();

  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar ponto" })).toHaveCount(0);
  await expect(page.getByText("Paciente relata dor durante a consulta.")).toBeVisible();
});

test("Secretary não vê painel nem controles clínicos", async ({ page }) => {
  await openConsultation(page, {
    width: 960,
    roles: ["Secretary"],
    expectAccess: false,
  });
  await expect(page.getByRole("heading", { name: "Pontos importantes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Salvar pontos no prontuário" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Identificação das vozes" })).toHaveCount(0);
});

test("provider indisponível preserva transcript e controles de voz", async ({ page }) => {
  await openConsultation(page, { width: 960, processingStatus: "Unavailable" });
  await expect(page.getByRole("alert").filter({ hasText: "temporariamente indisponíveis" })).toContainText("temporariamente indisponíveis");
  await expect(page.getByRole("region", { name: "Falas transcritas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Identificação das vozes" })).toBeVisible();
});
