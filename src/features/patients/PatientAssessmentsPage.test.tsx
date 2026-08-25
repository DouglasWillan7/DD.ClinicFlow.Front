import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { BodyAssessment, BodyMeasurementType, Patient } from "../../api/types";
import { PatientAssessmentsPage } from "./PatientAssessmentsPage";

const { requestMock, navigateMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

const patient: Patient = {
  id: "p-1",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  medicalRecordNumber: 48213,
  bloodType: null,
  sexForClinicalUse: null,
  name: "Rita de Cássia Alves",
  phone: "+5511988776655",
  email: null,
  birthDate: "1984-03-12",
  notes: null,
  isActive: true,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

function assessment(
  assessedOn: string,
  measurements: Array<[BodyMeasurementType, number]>,
  bmi: number | null,
): BodyAssessment {
  return {
    id: assessedOn,
    patientId: patient.id,
    assessedOn,
    createdAtUtc: `${assessedOn}T12:00:00Z`,
    measurements: measurements.map(([type, value]) => ({ type, value })),
    bmi,
  };
}

const history: BodyAssessment[] = [
  assessment(
    "2026-07-28",
    [
      ["Peso", 84.1],
      ["Altura", 178],
      ["Braco", 38],
    ],
    26.5,
  ),
  assessment(
    "2026-05-22",
    [
      ["Peso", 84.9],
      ["Braco", 37.9],
    ],
    26.8,
  ),
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PatientAssessmentsPage patientId={patient.id} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestMock.mockReset();
  navigateMock.mockReset();
  requestMock.mockImplementation((path: string) => {
    if (path === `/patients/${patient.id}`) return Promise.resolve(patient);
    if (path === `/assessments/patients/${patient.id}`) {
      return Promise.resolve(history);
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
});

test("abre na tabela, com a mais recente no topo e a variação de cada métrica", async () => {
  renderPage();

  expect(await screen.findByText("2 avaliações · mai 26 – jul 26")).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(patient.name);
  expect(screen.getByRole("heading", { level: 2, name: "Avaliações físicas" }))
    .toBeVisible();
  expect(screen.getByRole("link", { name: "Avaliações físicas" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const rows = screen.getAllByRole("row").slice(1); // pula o cabeçalho
  expect(within(rows[0]).getByText("28/07/2026")).toBeInTheDocument();
  expect(within(rows[1]).getByText("22/05/2026")).toBeInTheDocument();

  // Peso caiu 0,8 — favorável, e a direção não depende só da cor.
  const peso = within(rows[0]).getByText("−0,8");
  expect(peso).toHaveTextContent("evolução favorável");

  // IMC vem derivado do backend, não de uma medida digitada.
  expect(within(rows[0]).getByText("26,5")).toBeInTheDocument();
});

test("métrica sem medição na avaliação aparece como lacuna, sem variação inventada", async () => {
  renderPage();
  const rows = (await screen.findAllByRole("row")).slice(1);

  // Nenhuma coxa foi medida em nenhuma das duas avaliações.
  expect(within(rows[0]).getAllByText("—").length).toBeGreaterThan(0);
});

test("estado vazio descreve a própria aba sem mencionar a figura removida", async () => {
  requestMock.mockImplementation((path: string) => {
    if (path === `/patients/${patient.id}`) return Promise.resolve(patient);
    if (path === `/assessments/patients/${patient.id}`) return Promise.resolve([]);
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });

  renderPage();

  expect(await screen.findByText("A primeira avaliação aparece aqui e passa a servir de base para as variações seguintes.")).toBeVisible();
  expect(screen.queryByText(/figura/i)).not.toBeInTheDocument();
});

test("alterna para gráfico e desliga uma métrica pelos chips", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Gráfico" }));

  const peso = screen.getByRole("button", { name: "Peso" });
  expect(peso).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("img", { name: /Evolução de Peso, IMC/ }),
  ).toBeInTheDocument();

  await user.click(peso);
  expect(peso).toHaveAttribute("aria-pressed", "false");
  expect(
    screen.getByRole("img", { name: /^Evolução de IMC/ }),
  ).toBeInTheDocument();
});

test("sem nenhuma métrica ativa o gráfico explica o que fazer", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Gráfico" }));
  for (const label of [
    "Peso",
    "IMC",
    "Gordura",
    "Braço",
    "Antebraço",
    "Cintura",
    "Coxa",
    "Panturrilha",
  ]) {
    await user.click(screen.getByRole("button", { name: label }));
  }

  expect(
    screen.getByText("Selecione ao menos uma métrica acima para visualizar o gráfico."),
  ).toBeInTheDocument();
});

test("o modo individual mostra um card por métrica com último valor e variação", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Gráfico" }));
  await user.click(screen.getByRole("button", { name: "Individual" }));

  const cards = screen.getAllByRole("listitem");
  expect(within(cards[0]).getByText("Peso")).toBeInTheDocument();
  expect(within(cards[0]).getByText("84,1")).toBeInTheDocument();
  expect(within(cards[0]).getByText(/−0,8/)).toBeInTheDocument();
  expect(
    within(cards[6]).getByText("Nenhuma medição de coxa registrada."),
  ).toBeInTheDocument();
});

test("registra a avaliação com o que foi preenchido e não herda campo vazio", async () => {
  const user = userEvent.setup();
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/patients/${patient.id}`) return Promise.resolve(patient);
    if (path === `/assessments/patients/${patient.id}` && init?.method === "POST") {
      return Promise.resolve(history[0]);
    }
    if (path === `/assessments/patients/${patient.id}`) return Promise.resolve(history);
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });

  renderPage();
  await user.click(await screen.findByRole("button", { name: /Nova avaliação/ }));

  // O campo mostra a medida anterior como referência, sem preencher o input.
  const peso = screen.getByLabelText("Peso (kg)");
  expect(peso).toHaveValue("");
  expect(screen.getByText("Anterior: 84,1 kg")).toBeInTheDocument();

  await user.type(peso, "83,4");
  await user.click(screen.getByRole("button", { name: "Salvar avaliação" }));

  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith(
      `/assessments/patients/${patient.id}`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  const post = requestMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  )!;
  expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
    assessedOn: expect.any(String),
    measurements: [{ type: "Peso", value: 83.4 }],
  });
});

test("modal barra valor fora da faixa da grandeza antes de chamar a API", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: /Nova avaliação/ }));
  await user.type(screen.getByLabelText("Braço (cm)"), "380");
  await user.click(screen.getByRole("button", { name: "Salvar avaliação" }));

  expect(await screen.findByText("Informe entre 5 e 300 cm.")).toBeInTheDocument();
  expect(
    requestMock.mock.calls.some(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    ),
  ).toBe(false);
});
