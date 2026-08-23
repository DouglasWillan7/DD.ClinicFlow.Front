import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type {
  ClinicalExamFinding,
  ClinicalExamTrend,
  PatientClinicalSummary,
} from "../../api/types";
import { clinicalTrendKey } from "./exams/clinicalReport";
import { PatientClinicalOverview } from "./PatientClinicalOverview";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigateMock,
}));

function finding(index: number): ClinicalExamFinding {
  return {
    resultId: `result-${index}`,
    name: index === 1 ? "CPK" : `Analito ${index}`,
    valueText: index === 1 ? "562" : String(index * 10),
    unit: index === 1 ? "U/L" : "mg/dL",
    referenceText: index === 1 ? "55–170" : "até 100",
    referenceState: index % 2 === 0 ? "baixo" : "elevado",
    deltaPercent: index === 1 ? 91 : null,
  };
}

function trend(index: number): ClinicalExamTrend {
  return {
    catalogCode: `CODE-${index}`,
    name: index === 1 ? "CPK" : `Tendência ${index}`,
    unit: index === 1 ? "U/L" : "mg/dL",
    referenceState: index % 2 === 0 ? "normal" : "elevado",
    points: [
      {
        date: "2025-12-10",
        numericValue: index * 10,
        valueText: String(index * 10),
        outOfRange: false,
      },
      {
        date: "2026-07-29",
        numericValue: index * 20,
        valueText: String(index * 20),
        outOfRange: index % 2 !== 0,
      },
    ],
  };
}

function clinicalSummary(
  overrides: Partial<PatientClinicalSummary> = {},
): PatientClinicalSummary {
  const findings = Array.from({ length: 7 }, (_, index) => finding(index + 1));
  const trends = Array.from({ length: 7 }, (_, index) => trend(index + 1));

  return {
    latestReport: {
      id: "exam-1",
      patientId: "patient-1",
      name: "Exames de rotina",
      category: "Laboratório",
      clinicalOutcome: "Alterado",
      version: 1,
      metadata: {
        collectedAtLocal: "2026-07-29T08:28:00",
        issuedOn: "2026-08-03",
        validatedAtUtc: "2026-08-04T13:00:00Z",
        requesterName: "Dra. Ana Paula Souza",
        requesterRegistration: "CRM-SP 12345",
        validatorName: "Dr. João Lima",
      },
      document: null,
      findings,
      structuredFindings: [],
      results: [],
      notes: [],
      capabilities: {
        canOpenDocument: false,
        canViewHistory: true,
        canOpenCorrection: false,
      },
    },
    totalFindingCount: findings.length,
    structuredFindings: [],
    findings,
    trends,
    latestCollectionDate: "2026-07-29",
    capabilities: { canRequest: true, canAttachDocument: true },
    ...overrides,
  };
}

beforeEach(() => {
  navigateMock.mockReset();
});

test("abre o último laudo selecionado a partir de um achado", async () => {
  const user = userEvent.setup();
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={clinicalSummary()}
    />,
  );

  await user.click(
    screen.getByRole("link", { name: /CPK 562 U\/L, Elevado/i }),
  );

  expect(navigateMock).toHaveBeenCalledWith(
    "/app/pacientes/patient-1/exames?exame=exam-1",
  );
});

test("limita achados e tendências a seis itens reais", () => {
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={clinicalSummary()}
    />,
  );

  const report = screen.getByRole("region", { name: "Último exame" });
  expect(within(report).getAllByRole("link", { name: /mg\/dL|U\/L/ }))
    .toHaveLength(6);
  expect(screen.getAllByRole("img")).toHaveLength(6);
  expect(screen.queryByText("Analito 7")).not.toBeInTheDocument();
  expect(screen.queryByText("Tendência 7")).not.toBeInTheDocument();
});

test("leva achado estruturado do laudo para a visão geral sem duplicá-lo", () => {
  const base = clinicalSummary();
  const structuredFinding = {
    id: "finding-rhythm",
    key: "Ritmo",
    value: "Sinusal, sem alterações agudas",
    confidence: 0.94,
  };
  const summary = {
    ...base,
    totalFindingCount: 1,
    structuredFindings: [structuredFinding],
    findings: [],
    latestReport: {
      ...base.latestReport!,
      structuredFindings: [structuredFinding],
      findings: [],
    },
  } as PatientClinicalSummary;

  render(<PatientClinicalOverview patientId="patient-1" summary={summary} />);

  const findings = screen.getByRole("list", { name: "Principais achados" });
  expect(within(findings).getByText("Ritmo")).toBeVisible();
  expect(within(findings).getByText("Sinusal, sem alterações agudas")).toBeVisible();
  expect(screen.getAllByText("Ritmo")).toHaveLength(1);
});

test("remove achado estruturado derivado no overview e preserva valor distinto", () => {
  const base = clinicalSummary();
  const structuredFindings = [
    {
      id: "finding-cpk-derived",
      key: " cpk ",
      value: "562 U/L",
      confidence: 0.94,
    },
    {
      id: "finding-cpk-distinct",
      key: "CPK",
      value: "Macro-CPK detectada",
      confidence: 0.92,
    },
  ];
  const summary = {
    ...base,
    totalFindingCount: 3,
    structuredFindings,
    findings: [finding(1)],
    latestReport: {
      ...base.latestReport!,
      structuredFindings,
      findings: [finding(1)],
    },
  } as PatientClinicalSummary;

  render(<PatientClinicalOverview patientId="patient-1" summary={summary} />);

  expect(screen.queryByText("562 U/L", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText("Macro-CPK detectada")).toBeVisible();
  expect(screen.getByText("Alterado · 2 achados", { exact: true })).toBeVisible();
  expect(within(screen.getByRole("list", { name: "Principais achados" })).getAllByRole("listitem"))
    .toHaveLength(2);
});

test("explica quando ainda não existe laudo validado", () => {
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={clinicalSummary({
        latestReport: null,
        totalFindingCount: 0,
        findings: [],
        trends: [],
        latestCollectionDate: null,
      })}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Nenhum laudo validado" }),
  ).toBeVisible();
  expect(screen.getByText(/validação clínica/i)).toBeVisible();
});

test("explica como a evolução será formada quando não há tendências", () => {
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={clinicalSummary({ trends: [] })}
    />,
  );

  expect(screen.getByText(/duas coletas validadas/i)).toBeVisible();
});

test("mantém séries do mesmo catálogo separadas por unidade e não rotula pontos com outra unidade", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const first = trend(1);
  const second: ClinicalExamTrend = {
    ...first,
    unit: "mg/dL",
    points: first.points.map((point) => ({
      ...point,
      numericValue: point.numericValue === null ? null : point.numericValue / 10,
      valueText: point.numericValue === null ? point.valueText : String(point.numericValue / 10),
    })),
  };

  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={clinicalSummary({ trends: [first, second] })}
    />,
  );

  expect(screen.getByRole("img", { name: /CPK.*10 U\/L.*20 U\/L/i })).toBeVisible();
  expect(screen.getByRole("img", { name: /CPK.*1 mg\/dL.*2 mg\/dL/i })).toBeVisible();
  expect(consoleError.mock.calls.some((call) => call.join(" ").includes("same key"))).toBe(false);
});

test("normaliza casing e whitespace insignificante na chave de uma unidade", () => {
  const base = trend(1);

  expect(clinicalTrendKey({ ...base, unit: "mg/dL" }))
    .toBe(clinicalTrendKey({ ...base, unit: " MG / DL " }));
  expect(clinicalTrendKey({ ...base, unit: "mg/dL" }))
    .not.toBe(clinicalTrendKey({ ...base, unit: "mmol/L" }));
});

test.each([
  ["Alterado", 1, "danger"],
  ["Sem alterações", 0, "success"],
  ["Inconclusivo", 0, "neutral"],
] as const)(
  "comunica o resultado %s com o tom semântico %s",
  (clinicalOutcome, totalFindingCount, tone) => {
    const base = clinicalSummary();
    render(
      <PatientClinicalOverview
        patientId="patient-1"
        summary={clinicalSummary({
          totalFindingCount,
          findings: totalFindingCount > 0 ? [finding(1)] : [],
          latestReport: base.latestReport
            ? { ...base.latestReport, clinicalOutcome }
            : null,
        })}
      />,
    );

    expect(screen.getByText(new RegExp(`^${clinicalOutcome}`)))
      .toHaveAttribute("data-tone", tone);
  },
);

test("falha do resumo preserva retry regional", async () => {
  const user = userEvent.setup();
  const retry = vi.fn();
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={undefined}
      error
      onRetry={retry}
    />,
  );

  expect(screen.getByText("Não foi possível carregar o resumo clínico."))
    .toBeVisible();
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();
});

test("carregamento preserva a região clínica e comunica o estado", () => {
  render(
    <PatientClinicalOverview
      patientId="patient-1"
      summary={undefined}
      loading
    />,
  );

  expect(screen.getByRole("status", { name: "Carregando resumo clínico" }))
    .toBeVisible();
});
