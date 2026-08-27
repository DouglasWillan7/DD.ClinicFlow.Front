import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "../../api/client";
import type {
  Appointment,
  Clinic,
  PatientClinicalSummary,
  PatientDemographic,
} from "../../api/types";
import { PatientDetailPage } from "./PatientDetailPage";

const { requestMock, navigateMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../patient-actions/ClinicalAccessEmailAction", () => ({
  ClinicalAccessEmailAction: ({ patientId }: { patientId: string }) => (
    <button type="button">Enviar autorização de {patientId}</button>
  ),
}));

vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigateMock,
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const patient: PatientDemographic = {
  id: "patient-1",
  name: "Maria Eduarda de Albuquerque Vasconcelos e Nascimento",
  phone: "+5511988776655",
  birthDate: "1984-03-12",
  isActive: true,
};

const clinic: Clinic = {
  id: "clinic-1",
  name: "Clínica",
  timeZoneId: "America/Sao_Paulo",
  phone: null,
  address: null,
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: null,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

const summary: PatientClinicalSummary = {
  latestReport: null,
  totalFindingCount: 0,
  structuredFindings: [],
  findings: [],
  trends: [],
  latestCollectionDate: null,
  capabilities: { canRequest: false, canAttachDocument: true },
};

function defaultRequest(path: string): Promise<unknown> {
  if (path === `/patients/${patient.id}`) return Promise.resolve(patient);
  if (path === "/clinics/current") return Promise.resolve(clinic);
  if (path === `/appointments/patients/${patient.id}`) {
    return Promise.resolve([] satisfies Appointment[]);
  }
  if (path === `/exams/patients/${patient.id}/clinical-summary`) {
    return Promise.resolve(summary);
  }
  return Promise.reject(new Error(`rota inesperada: ${path}`));
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PatientDetailPage patientId={patient.id} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestMock.mockReset();
  navigateMock.mockReset();
  requestMock.mockImplementation(defaultRequest);
});

test("substitui a anatomia antiga por cabeçalho compartilhado e resumo clínico", async () => {
  renderPage();

  expect(
    await screen.findByRole("heading", { name: patient.name }),
  ).toBeVisible();
  expect(screen.getAllByText(patient.phone).length).toBeGreaterThan(0);
  expect(screen.queryByText(/NaN|undefined/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Visão geral" }))
    .toHaveAttribute("aria-current", "page");
  expect(screen.queryByText("Circunferências")).not.toBeInTheDocument();
  expect(screen.queryByText("Seguimento de exames")).not.toBeInTheDocument();

  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith(
      `/exams/patients/${patient.id}/clinical-summary`,
    );
  });
  const requestedPaths = requestMock.mock.calls.map(([path]) => path);
  expect(requestedPaths).not.toContain(`/assessments/patients/${patient.id}`);
  expect(requestedPaths).not.toContain(`/exams/patients/${patient.id}/grid`);
  expect(requestedPaths).not.toContain("/clinics/members");
});

test("oculta ação de solicitação sem capacidade e mantém anexo permitido", async () => {
  renderPage();

  expect(await screen.findByRole("link", { name: "Anexar laudo" }))
    .toHaveAttribute(
      "href",
      `/app/pacientes/${patient.id}/exames?acao=anexar`,
    );
  expect(screen.queryByRole("link", { name: "Solicitar exame" }))
    .not.toBeInTheDocument();
});

test("estado vazio da próxima consulta agenda o paciente atual", async () => {
  const user = userEvent.setup();
  renderPage();

  expect(await screen.findByText("Nenhuma consulta futura agendada."))
    .toBeVisible();
  await user.click(screen.getByRole("button", { name: "Agendar consulta" }));
  expect(navigateMock).toHaveBeenCalledWith(
    `/app/agenda/nova?patientId=${patient.id}`,
  );
});

test("erro do resumo mantém contexto e permite tentar novamente", async () => {
  const user = userEvent.setup();
  let summaryAttempts = 0;
  requestMock.mockImplementation((path: string) => {
    if (path === `/exams/patients/${patient.id}/clinical-summary`) {
      summaryAttempts += 1;
      return summaryAttempts === 1
        ? Promise.reject(new Error("summary offline"))
        : Promise.resolve(summary);
    }
    return defaultRequest(path);
  });
  renderPage();

  expect(await screen.findByText("Não foi possível carregar o resumo clínico."))
    .toBeVisible();
  expect(screen.getByRole("heading", { name: patient.name })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

  expect(await screen.findByRole("heading", { name: "Nenhum laudo validado" }))
    .toBeVisible();
  expect(summaryAttempts).toBe(2);
});

test("autorização clínica pendente é um estado esperado, não um erro", async () => {
  const user = userEvent.setup();
  let summaryAttempts = 0;
  requestMock.mockImplementation((path: string) => {
    if (path === `/exams/patients/${patient.id}/clinical-summary`) {
      summaryAttempts += 1;
      return Promise.reject(
        new ApiError("Usuário sem acesso clínico ao paciente.", 403),
      );
    }
    return defaultRequest(path);
  });

  renderPage();

  expect(await screen.findByRole("heading", { name: "Acesso clínico pendente" }))
    .toBeVisible();
  expect(screen.getByRole("button", { name: `Enviar autorização de ${patient.id}` }))
    .toBeVisible();
  expect(screen.queryByText("Algo saiu do fluxo")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Verificar novamente" }));
  expect(summaryAttempts).toBe(2);
});
