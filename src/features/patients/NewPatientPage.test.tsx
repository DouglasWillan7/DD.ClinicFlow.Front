import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { ApiError } from "../../api/client";
import type { Patient } from "../../api/types";
import { NewPatientPage } from "./NewPatientPage";

let requestMock = vi.fn();
let navigateMock = vi.fn();

const createdPatient: Patient = {
  id: "patient-1",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  medicalRecordNumber: 48213,
  bloodType: null,
  sexForClinicalUse: null,
  name: "Marina Oliveira",
  phone: "+5511999990000",
  email: "marina@example.test",
  birthDate: null,
  notes: null,
  isActive: true,
  createdAtUtc: "2026-08-07T12:00:00Z",
};

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../../app/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/navigation")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function Harness({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

async function submitPatient(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
  await user.type(screen.getByLabelText("Documento"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "marina@example.test");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Salvar paciente" }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/app/pacientes/novo");
  navigateMock = vi.fn();
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/patients" && init?.method === "POST") return createdPatient;
    throw new Error(`Unexpected request: ${path}`);
  });
});

test("cadastra o paciente globalmente sem consultar médicos da clínica", async () => {
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitPatient(user);

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/app/pacientes"));
  expect(requestMock).toHaveBeenCalledTimes(1);
  expect(requestMock).toHaveBeenCalledWith("/patients", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"document":"52998224725"'),
  }));
});

test("preserva o retorno seguro para o agendamento", async () => {
  window.history.replaceState(
    {},
    "",
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitPatient(user);

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(
    "/app/agenda/nova?date=2026-08-10&patientId=patient-1",
  ));
});

test("mantém o formulário e apresenta conflito de documento", async () => {
  requestMock = vi.fn(async () => {
    throw new ApiError("Documento já cadastrado nesta clínica.", 409);
  });
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitPatient(user);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Documento já cadastrado nesta clínica.",
  );
  expect(screen.getByLabelText("Observações")).toBeVisible();
});
