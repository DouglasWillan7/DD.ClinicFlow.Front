import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ClinicalExamReport } from "../../../api/types";
import { ValidatedExamReport } from "./ValidatedExamReport";

const report: ClinicalExamReport = {
  id: "exam-validated-1",
  patientId: "patient-1",
  name: "Exames de rotina",
  category: "Laboratório",
  clinicalOutcome: "Alterado",
  version: 2,
  metadata: {
    collectedAtLocal: "2026-07-29T08:28:00",
    issuedOn: "2026-08-03",
    validatedAtUtc: "2026-08-03T14:30:00Z",
    requesterName: "Dr. Mario W. F. Kloss",
    requesterRegistration: "CRM-SP 21341",
    validatorName: "Dra. Ana Paula Souza",
  },
  document: {
    fileName: "laudo-laboratorial-completo.pdf",
    sizeBytes: 714_650,
    source: "Clínica",
    pageCount: 13,
  },
  findings: [
    {
      resultId: "result-cpk",
      name: "CPK",
      valueText: "562",
      unit: "U/L",
      referenceText: "até 190 U/L",
      referenceState: "elevado",
      deltaPercent: 91,
    },
    {
      resultId: "result-hdl",
      name: "HDL-colesterol",
      valueText: "36",
      unit: "mg/dL",
      referenceText: "acima de 40 mg/dL",
      referenceState: "baixo",
      deltaPercent: -5.26,
    },
  ],
  structuredFindings: [],
  results: [
    {
      id: "result-cpk",
      catalogCode: "CPK",
      name: "CPK",
      subtitle: "Creatinofosfoquinase",
      numericValue: 562,
      valueText: "562",
      unit: "U/L",
      referenceText: "até 190 U/L",
      detailedReferenceText: null,
      referenceState: "elevado",
      confidence: 0.96,
      deltaPercent: 91,
      history: [
        { date: "2025-12-10", numericValue: 281, valueText: "281", outOfRange: true },
        { date: "2026-03-23", numericValue: 294, valueText: "294", outOfRange: true },
        { date: "2026-07-29", numericValue: 562, valueText: "562", outOfRange: true },
      ],
    },
    {
      id: "result-hdl",
      catalogCode: "HDL",
      name: "HDL-colesterol",
      subtitle: null,
      numericValue: 36,
      valueText: "36",
      unit: "mg/dL",
      referenceText: "acima de 40 mg/dL",
      detailedReferenceText: null,
      referenceState: "baixo",
      confidence: 0.94,
      deltaPercent: -5.26,
      history: [],
    },
    {
      id: "result-vitamin-d",
      catalogCode: "VITD",
      name: "Vitamina D",
      subtitle: "25-OH vitamina D",
      numericValue: 23.2,
      valueText: "23,2",
      unit: "ng/mL",
      referenceText: "20 a 60 ng/mL",
      detailedReferenceText: "Metas individualizadas devem considerar idade, risco de queda e orientação clínica.",
      referenceState: "limítrofe",
      confidence: 0.95,
      deltaPercent: null,
      history: [],
    },
  ],
  notes: [
    { id: "note-dht", title: "DHT", text: "Resultado confirmado em nova leitura da amostra.", confidence: 0.97 },
    { id: "note-vitamin-d", title: "Vitamina D", text: "Interpretar conforme o contexto clínico do paciente.", confidence: 0.94 },
  ],
  capabilities: {
    canOpenDocument: true,
    canViewHistory: true,
    canOpenCorrection: true,
  },
};

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("move o foco do achado para o resultado, destaca temporariamente e limpa o timer", () => {
  vi.useFakeTimers();
  const setTimeoutSpy = vi.spyOn(window, "setTimeout");
  const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
  const { unmount } = render(<ValidatedExamReport report={report} />);

  fireEvent.click(screen.getByRole("button", { name: /CPK.*Elevado/i }));

  const row = screen.getByRole("row", { name: /CPK.*562 U\/L/i });
  expect(row).toHaveFocus();
  expect(row).toHaveAttribute("data-highlighted", "true");
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1_800);

  act(() => vi.advanceTimersByTime(1_800));
  expect(row).not.toHaveAttribute("data-highlighted");

  fireEvent.click(screen.getByRole("button", { name: /CPK.*Elevado/i }));
  const lastHighlightTimerIndex = setTimeoutSpy.mock.calls.map((call) => call[1]).lastIndexOf(1_800);
  const lastHighlightTimer = setTimeoutSpy.mock.results[lastHighlightTimerIndex]?.value;
  unmount();
  expect(clearTimeoutSpy).toHaveBeenCalledWith(lastHighlightTimer);
});

test("mostra uma única nota quando toda confiança está ausente e não cria coluna", () => {
  const withoutConfidence: ClinicalExamReport = {
    ...report,
    results: report.results.map((result) => ({ ...result, confidence: null })),
  };
  render(<ValidatedExamReport report={withoutConfidence} />);

  expect(screen.getAllByText(/processamento não informou confiança/i)).toHaveLength(1);
  expect(screen.queryByRole("columnheader", { name: /confiança/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/confiança não informada/i)).not.toBeInTheDocument();
});

test("comunica resultados elevados, baixos e limítrofes com texto além da cor", () => {
  render(<ValidatedExamReport report={report} />);
  expect(screen.getByRole("row", { name: /CPK.*562 U\/L.*Elevado/i })).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /HDL-colesterol.*36 mg\/dL.*Baixo/i })).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /Vitamina D.*23,2 ng\/mL.*Limítrofe/i })).toBeInTheDocument();
  expect(screen.getByText(/Vitamina D 23,2 ng\/mL/i)).toBeInTheDocument();
  expect(screen.getByText("confiança 96%")).toBeInTheDocument();
});

test.each([
  ["normal", "Normal", "lucide-circle-check"],
  ["indeterminado", "Indeterminado", "lucide-circle-question-mark"],
  ["elevado", "Elevado", "lucide-arrow-up"],
  ["baixo", "Baixo", "lucide-arrow-down"],
  ["limítrofe", "Limítrofe", "lucide-arrow-right"],
] as const)("exibe o estado %s com texto, ícone, tom e nome acessível", (referenceState, label, iconClass) => {
  render(
    <ValidatedExamReport
      report={{
        ...report,
        findings: [],
        results: [{ ...report.results[0], name: `Resultado ${label}`, referenceState }],
        notes: [],
      }}
    />,
  );

  const row = screen.getByRole("row", { name: new RegExp(`Resultado ${label}.*${label}`, "i") });
  const state = within(row).getByText(label);
  expect(state).toHaveAttribute("data-state", referenceState);
  expect(state.querySelector(`svg.${iconClass}`)).not.toBeNull();
});

test("traduz o desfecho do contrato sem expor o enum bruto", () => {
  render(
    <ValidatedExamReport
      report={{
        ...report,
        category: "Laboratorio",
        clinicalOutcome: "SemAlteracoes",
      }}
    />,
  );

  expect(screen.getByText("Laboratório")).toBeVisible();
  expect(screen.getByText("Sem alterações")).toBeVisible();
  expect(screen.queryByText("Laboratorio")).not.toBeInTheDocument();
  expect(screen.queryByText("SemAlteracoes")).not.toBeInTheDocument();
});

test("mantém achado limítrofe somente na faixa âmbar, sem duplicar no grid", () => {
  const borderlineFinding = {
    ...report.results[2],
    resultId: report.results[2].id,
    referenceState: "limítrofe" as const,
  };
  render(
    <ValidatedExamReport
      report={{ ...report, findings: [...report.findings, borderlineFinding] }}
    />,
  );

  expect(screen.getByRole("complementary", { name: "Resultados no limite da referência" })).toHaveTextContent("Vitamina D 23,2 ng/mL");
  expect(screen.queryByRole("button", { name: /Vitamina D.*no limite/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Achados 2" })).toBeInTheDocument();
});

test("renderiza achados estruturados uma única vez mesmo sem resultados", () => {
  const findingOnlyReport = {
    ...report,
    findings: [],
    structuredFindings: [
      {
        id: "finding-rhythm",
        key: "Ritmo",
        value: "Sinusal, sem alterações agudas",
        confidence: 0.94,
      },
    ],
    results: [],
    notes: [],
  } as ClinicalExamReport;

  render(<ValidatedExamReport report={findingOnlyReport} />);

  const findings = screen.getByRole("region", { name: "Achados" });
  expect(within(findings).getByText("Ritmo")).toBeVisible();
  expect(within(findings).getByText("Sinusal, sem alterações agudas")).toBeVisible();
  expect(screen.getAllByText("Ritmo")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Achados 1" })).toBeInTheDocument();
  expect(screen.getByText("Este laudo não possui resultados estruturados.")).toBeVisible();
  expect(screen.getByText("Alterado", { exact: true })).toBeVisible();
  expect(screen.queryByText(/0 de 0 resultados fora da referência/i)).not.toBeInTheDocument();
});

test("remove achado estruturado derivado sem ocultar valor clínico distinto", () => {
  const combinedReport = {
    ...report,
    structuredFindings: [
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
    ],
  } as ClinicalExamReport;

  render(<ValidatedExamReport report={combinedReport} />);

  expect(screen.queryByText("562 U/L", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText("Macro-CPK detectada")).toBeVisible();
  expect(screen.getByRole("button", { name: "Achados 3" })).toBeInTheDocument();
});

test("expande uma referência longa com estado anunciado", async () => {
  const user = userEvent.setup();
  render(<ValidatedExamReport report={report} />);
  const trigger = screen.getByRole("button", { name: "Ver metas por risco de Vitamina D" });

  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/Metas individualizadas/)).not.toBeInTheDocument();
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/Metas individualizadas/)).toBeVisible();
});

test("mantém notas independentes e omite a seção quando não há notas", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<ValidatedExamReport report={report} />);
  const first = screen.getByRole("button", { name: "DHT" });
  const second = screen.getByRole("button", { name: "Vitamina D" });

  expect(first).toHaveAttribute("aria-expanded", "false");
  expect(second).toHaveAttribute("aria-expanded", "false");
  await user.click(first);
  expect(first).toHaveAttribute("aria-expanded", "true");
  expect(second).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText(/nova leitura da amostra/i)).toBeVisible();
  expect(screen.getByText(/contexto clínico/i)).not.toBeVisible();

  rerender(<ValidatedExamReport report={{ ...report, notes: [] }} />);
  expect(screen.queryByRole("heading", { name: "Notas do laboratório" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Notas do laboratório/i })).not.toBeInTheDocument();
});

test("mantém o conteúdo das notas recolhidas no documento para impressão completa", () => {
  render(<ValidatedExamReport report={report} />);

  const body = screen.getByText(/nova leitura da amostra/i).closest("div");
  expect(body).toHaveAttribute("hidden");
  expect(screen.getByRole("button", { name: "DHT" })).toHaveAttribute("aria-expanded", "false");
});

test("fecha a aba provisória e mantém o relatório utilizável quando o documento falha", async () => {
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  const loadDocument = vi.fn().mockRejectedValue(new Error("storage key missing"));
  render(<ValidatedExamReport report={report} loadDocument={loadDocument} />);

  fireEvent.click(screen.getByRole("button", { name: /Abrir laudo original em nova aba/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent("O laudo original está indisponível no momento.");
  expect(tab.close).toHaveBeenCalledOnce();
  expect(screen.getByRole("heading", { name: "Exames de rotina" })).toBeInTheDocument();
  expect(screen.queryByText("storage key missing")).not.toBeInTheDocument();
});

test("informa popup bloqueado sem buscar o documento nem tentar abrir outra aba", async () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const loadDocument = vi.fn().mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
  render(<ValidatedExamReport report={report} loadDocument={loadDocument} />);

  const trigger = screen.getByRole("button", { name: /Abrir laudo original em nova aba/i });
  fireEvent.click(trigger);

  expect(await screen.findByRole("alert")).toHaveTextContent("O laudo original está indisponível no momento.");
  expect(loadDocument).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(trigger).not.toBeDisabled();
  expect(screen.getByRole("heading", { name: "Exames de rotina" })).toBeInTheDocument();
});

test("abre o blob autenticado pela aba provisória retornável e revoga a URL", async () => {
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:clinical-report");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  let revokeCallback = () => undefined;
  const realSetTimeout = window.setTimeout.bind(window);
  vi.spyOn(window, "setTimeout").mockImplementation((handler, timeout, ...args) => {
    if (timeout === 60_000 && typeof handler === "function") {
      revokeCallback = () => handler();
      return 1;
    }
    return realSetTimeout(handler, timeout, ...args);
  });
  const loadDocument = vi.fn().mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
  render(<ValidatedExamReport report={report} loadDocument={loadDocument} />);

  fireEvent.click(screen.getByRole("button", { name: /Abrir laudo original em nova aba/i }));

  await waitFor(() => expect(tab.location.href).toBe("blob:clinical-report"));
  expect(open).toHaveBeenNthCalledWith(1, "about:blank", "_blank");
  expect(tab.opener).toBeNull();
  revokeCallback();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:clinical-report");
});

test("preserva callbacks de histórico, correção e continuação da edição", async () => {
  const user = userEvent.setup();
  const onShowHistory = vi.fn();
  const onOpenCorrection = vi.fn();
  const onEditRevision = vi.fn();
  render(
    <ValidatedExamReport
      report={report}
      onShowHistory={onShowHistory}
      onOpenCorrection={onOpenCorrection}
      onEditRevision={onEditRevision}
    />,
  );

  const actions = screen.getByRole("region", { name: "Ações do laudo" });
  await user.click(within(actions).getByRole("button", { name: "Ver histórico de versões" }));
  await user.click(within(actions).getByRole("button", { name: "Continuar correção" }));
  await user.click(within(actions).getByRole("button", { name: "Corrigir valores" }));
  expect([onShowHistory.mock.calls.length, onEditRevision.mock.calls.length, onOpenCorrection.mock.calls.length]).toEqual([1, 1, 1]);
});

test("usa rolagem instantânea quando a pessoa prefere movimento reduzido", () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  render(<ValidatedExamReport report={report} />);

  fireEvent.click(screen.getByRole("button", { name: /CPK.*Elevado/i }));

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });

  scrollIntoView.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Todos os resultados 3" }));
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
});

test("expõe metadados e composição semântica do laudo", () => {
  render(<ValidatedExamReport report={report} />);
  expect(screen.getByRole("article", { name: "Exames de rotina" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Seções do laudo" })).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Todos os resultados" })).toBeInTheDocument();
  expect(screen.getByText("Coleta").nextElementSibling).toHaveTextContent("29/07/2026 às 08:28");
  expect(screen.getByText("Emissão").nextElementSibling).toHaveTextContent("03/08/2026");
  expect(screen.getByText("Versão").nextElementSibling).toHaveTextContent("2");

  const findingsNav = screen.getByRole("button", { name: "Achados 2" });
  const resultsNav = screen.getByRole("button", { name: "Todos os resultados 3" });
  expect(findingsNav).toHaveAttribute("aria-current", "true");
  expect(resultsNav).not.toHaveAttribute("aria-current");
  fireEvent.click(resultsNav);
  expect(resultsNav).toHaveAttribute("aria-current", "true");
  expect(findingsNav).not.toHaveAttribute("aria-current");
});

test("acompanha o scroll natural na navegação local com aria-current", () => {
  let callback: IntersectionObserverCallback = () => undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  class IntersectionObserverMock {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);

    constructor(nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
    }
  }
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });

  const { unmount } = render(<ValidatedExamReport report={report} />);
  const resultsSection = screen.getByRole("region", { name: "Todos os resultados" });
  act(() => callback([
    {
      target: resultsSection,
      isIntersecting: true,
      intersectionRatio: 0.8,
      boundingClientRect: { top: 120 },
    } as unknown as IntersectionObserverEntry,
  ], {} as IntersectionObserver));

  expect(screen.getByRole("button", { name: "Todos os resultados 3" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "Achados 2" })).not.toHaveAttribute("aria-current");
  expect(observe).toHaveBeenCalledWith(resultsSection);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  Reflect.deleteProperty(window, "IntersectionObserver");
});
