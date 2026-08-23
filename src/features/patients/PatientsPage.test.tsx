import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Clinic, PatientListItem } from "../../api/types";
import { PatientsPage } from "./PatientsPage";

const { requestMock, navigateMock, routerState } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  navigateMock: vi.fn(),
  routerState: { search: "" },
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [
    new URLSearchParams(routerState.search),
    vi.fn(),
  ],
}));

const clinic: Clinic = {
  id: "c-1",
  name: "Clínica Teste",
  timeZoneId: "America/Sao_Paulo",
  phone: null,
  address: null,
  defaultAppointmentDurationMinutes: 30,
  plan: "Clinic",
  subscriptionStatus: "Active",
  maxDoctors: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
};

function makePatient(overrides: Partial<PatientListItem>): PatientListItem {
  return {
    id: crypto.randomUUID(),
    name: "Paciente Teste",
    phone: "+5511999990000",
    cpf: "52998224725",
    medicalRecordNumber: 48213,
    bloodType: null,
    sexForClinicalUse: null,
    birthDate: "1984-03-12",
    notes: null,
    doctorUserId: "d-1",
    isActive: true,
    whatsappConsentAtUtc: null,
    createdAtUtc: "2026-08-01T12:00:00Z",
    lastAppointmentUtc: "2026-08-03T14:00:00Z",
    nextAppointmentUtc: "2026-08-20T17:00:00Z",
    nextAppointmentType: "Teleconsultation",
    situation: "EmAcompanhamento",
    ...overrides,
  };
}

const patients: PatientListItem[] = [
  makePatient({ name: "Mohammad Jaber", cpf: "41288755601" }),
  makePatient({
    name: "Fernanda Costa",
    cpf: "11144477735",
    situation: "NovoPaciente",
    lastAppointmentUtc: null,
    nextAppointmentUtc: null,
    nextAppointmentType: null,
  }),
  makePatient({
    name: "Helena Martins",
    cpf: "93541134780",
    situation: "Inativo",
    isActive: false,
    nextAppointmentUtc: null,
    nextAppointmentType: null,
  }),
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PatientsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestMock.mockReset();
  navigateMock.mockReset();
  routerState.search = "";
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/clinics/current")) return Promise.resolve(clinic);
    if (path.startsWith("/patients")) return Promise.resolve(patients);
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
});

test("lista pacientes com resumo, contador e badges de situação", async () => {
  renderPage();

  expect(
    await screen.findByRole("button", {
      name: "Abrir detalhes de Mohammad Jaber",
    }),
  ).toBeVisible();

  // Ordenação alfabética pt-BR.
  const rows = screen.getAllByRole("button", { name: /Abrir detalhes de/ });
  expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
    "Abrir detalhes de Fernanda Costa",
    "Abrir detalhes de Helena Martins",
    "Abrir detalhes de Mohammad Jaber",
  ]);

  expect(screen.getByText("3 de 3")).toBeVisible();

  const mohammad = rows[2];
  expect(within(mohammad).getByText(/Pront\. 48\.213/)).toBeVisible();
  expect(within(mohammad).getByText(/CPF 412\.887\.556-01/)).toBeVisible();
  // 14:00 UTC → 11:00 em São Paulo.
  expect(within(mohammad).getByText("03/08/2026")).toBeVisible();
  expect(within(mohammad).getByText("20/08 · 14:00")).toBeVisible();
  expect(within(mohammad).getByLabelText("Teleconsulta")).toBeInTheDocument();
  expect(within(mohammad).getByText("Em acompanhamento")).toBeVisible();

  expect(within(rows[0]).getByText("Novo paciente")).toBeVisible();
  expect(within(rows[1]).getByText("Inativo")).toBeVisible();
});

test("chips filtram por situação e atualizam o contador", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("3 de 3");

  await user.click(screen.getByRole("button", { name: "Novos · 1" }));

  expect(screen.getByText("1 de 3")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Abrir detalhes de Fernanda Costa" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Abrir detalhes de Helena Martins" }),
  ).not.toBeInTheDocument();
});

test("termo da URL filtra a lista e o vazio oferece cadastro", async () => {
  routerState.search = "search=ninguém";
  const user = userEvent.setup();
  renderPage();

  expect(
    await screen.findByText("Nenhum paciente encontrado para “ninguém”."),
  ).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: "+ Cadastrar novo paciente" }),
  );
  expect(navigateMock).toHaveBeenCalledWith("/app/pacientes/novo");
});

test("clique na linha abre os detalhes do paciente", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(
    await screen.findByRole("button", {
      name: "Abrir detalhes de Fernanda Costa",
    }),
  );

  const fernanda = patients[1];
  expect(navigateMock).toHaveBeenCalledWith(`/app/pacientes/${fernanda.id}`);
});

test("erro na listagem oferece tentar novamente", async () => {
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/clinics/current")) return Promise.resolve(clinic);
    return Promise.reject(new Error("falhou"));
  });
  renderPage();

  await waitFor(() =>
    expect(
      screen.getByText("Não foi possível carregar os pacientes."),
    ).toBeVisible(),
  );
  expect(
    screen.getByRole("button", { name: /Tentar novamente/ }),
  ).toBeVisible();
});
