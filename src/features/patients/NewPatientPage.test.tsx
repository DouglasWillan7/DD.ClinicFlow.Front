import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { ApiError } from "../../api/client";
import type { Member, Patient } from "../../api/types";
import { NewPatientPage } from "./NewPatientPage";

let requestMock = vi.fn();
let navigateMock = vi.fn();

const doctorId = "20000000-0000-4000-8000-000000000001";
const patientId = "30000000-0000-4000-8000-000000000001";
const doctor: Member = {
  userId: doctorId,
  email: "helena@example.test",
  roles: ["Doctor"],
  isCreator: false,
  name: "Dra. Helena Costa",
  specialty: "Cardiologia",
};
const createdPatient: Patient = {
  id: patientId,
  name: "Marina Oliveira",
  phone: "+5511999990000",
  cpf: "52998224725",
  medicalRecordNumber: 48213,
  bloodType: null,
  sexForClinicalUse: null,
  birthDate: null,
  notes: null,
  doctorUserId: doctorId,
  isActive: true,
  whatsappConsentAtUtc: null,
  createdAtUtc: "2026-08-07T12:00:00Z",
};

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../../app/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/navigation")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function QueryHarness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/app/pacientes/novo");
  navigateMock = vi.fn();
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/members") return [doctor];
    if (path === "/patients" && init?.method === "POST") return createdPatient;
    throw new Error(`Unexpected request: ${path}`);
  });
});

test("adiciona patientId ao retorno sem apagar a data existente", async () => {
  window.history.replaceState(
    {},
    "",
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewPatientPage />
    </QueryHarness>,
  );

  await user.type(await screen.findByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "+5511999990000");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.selectOptions(screen.getByLabelText("Médico responsável"), doctorId);
  await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

  await waitFor(() =>
    expect(navigateMock).toHaveBeenCalledWith(
      `/app/agenda/nova?date=2026-08-10&patientId=${patientId}`,
    ),
  );
});

test("cancelar retorna ao agendamento e mantém o rascunho", async () => {
  window.history.replaceState(
    {},
    "",
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
  sessionStorage.setItem("booking-draft-test", "preservar");
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewPatientPage />
    </QueryHarness>,
  );

  await user.click(await screen.findByRole("button", { name: "Cancelar" }));

  expect(navigateMock).toHaveBeenCalledWith(
    "/app/agenda/nova?date=2026-08-10",
  );
  expect(sessionStorage.getItem("booking-draft-test")).toBe("preservar");
});

test.each([
  ["ausente", "/app/pacientes/novo"],
  [
    "externo",
    "/app/pacientes/novo?returnTo=https%3A%2F%2Fevil.example%2Fcapture",
  ],
])("cancelar usa pacientes quando o retorno é %s", async (_case, location) => {
  window.history.replaceState({}, "", location);
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewPatientPage />
    </QueryHarness>,
  );

  await user.click(await screen.findByRole("button", { name: "Cancelar" }));

  expect(navigateMock).toHaveBeenCalledWith("/app/pacientes");
});

test("orienta a adicionar um médico quando não há responsável ativo", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/members") return [];
    throw new Error(`Unexpected request: ${path}`);
  });

  render(
    <QueryHarness>
      <NewPatientPage />
    </QueryHarness>,
  );

  expect(
    await screen.findByRole("heading", {
      name: "Adicione um médico antes do paciente",
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("list", { name: "Etapas do cadastro do paciente" }),
  ).not.toBeInTheDocument();
});

test("preserva o cadastro quando a API recusa o CPF", async () => {
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/clinics/members") return [doctor];
    if (path === "/patients" && init?.method === "POST") {
      throw new ApiError("CPF já cadastrado nesta clínica.", 409);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewPatientPage />
    </QueryHarness>,
  );

  await user.type(await screen.findByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "+5511999990000");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.selectOptions(screen.getByLabelText("Médico responsável"), doctorId);
  await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "CPF já cadastrado nesta clínica.",
  );
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Oliveira");
  expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
});
