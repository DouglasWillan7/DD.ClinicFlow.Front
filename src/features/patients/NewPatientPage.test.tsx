import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { ApiError } from "../../api/client";
import type { Patient, PatientDocumentLookup } from "../../api/types";
import { NewPatientPage } from "./NewPatientPage";

let requestMock = vi.fn();
let navigateMock = vi.fn();
let lookupResult: PatientDocumentLookup;

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

const notFound: PatientDocumentLookup = { status: "NotFound", patientId: null, patient: null };

const existing: PatientDocumentLookup = {
  status: "Found",
  patientId: "patient-9",
  patient: {
    id: "patient-9",
    name: "Helena Prado",
    phone: "+5511988887777",
    email: "helena@example.test",
    birthDate: "1988-03-14",
    bloodType: "ABNegative",
    sexForClinicalUse: "Feminino",
    notes: "Prefere contato à tarde",
    isActive: true,
  },
};

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: null }),
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

function requestsTo(path: string) {
  return requestMock.mock.calls.filter(([calledPath]) => calledPath === path);
}

async function submitDocument(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Documento"), "52998224725");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function submitPatient(user: ReturnType<typeof userEvent.setup>) {
  await submitDocument(user);
  await user.type(await screen.findByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
  await user.type(screen.getByLabelText("E-mail"), "marina@example.test");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Salvar paciente" }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/app/pacientes/novo");
  navigateMock = vi.fn();
  lookupResult = notFound;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/patients/lookup" && init?.method === "POST") return lookupResult;
    if (path === "/patients/clinic-link" && init?.method === "POST") {
      return { id: "patient-9", name: "Helena Prado", phone: "+5511988887777", birthDate: "1988-03-14", isActive: true };
    }
    if (path === "/patients" && init?.method === "POST") return createdPatient;
    throw new Error(`Unexpected request: ${path}`);
  });
});

test("começa pelo documento e não mostra os demais campos antes da consulta", async () => {
  render(<Harness><NewPatientPage /></Harness>);

  expect(await screen.findByRole("heading", { name: "Comece pelo documento" })).toBeVisible();
  expect(screen.getByLabelText("Documento")).toBeVisible();
  expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  expect(requestMock).not.toHaveBeenCalled();
});

test("consulta o documento no corpo da requisição, nunca na URL", async () => {
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  await screen.findByLabelText("Nome completo");
  expect(requestMock).toHaveBeenCalledWith("/patients/lookup", {
    method: "POST",
    body: JSON.stringify({
      documentCountryCode: "BR",
      documentType: "CPF",
      document: "52998224725",
    }),
  });
});

test("documento sem cadastro segue o cadastro completo com o documento travado", async () => {
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  await screen.findByLabelText("Nome completo");
  expect(screen.queryByLabelText("Documento")).not.toBeInTheDocument();
  expect(screen.getByText("CPF 529.982.247-25")).toBeVisible();

  await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
  await user.type(screen.getByLabelText("E-mail"), "marina@example.test");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/app/pacientes"));
  expect(requestsTo("/patients")).toHaveLength(1);
  expect(requestMock).toHaveBeenCalledWith("/patients", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"document":"52998224725"'),
  }));
  expect(requestsTo("/patients/clinic-link")).toHaveLength(0);
});

test("alterar documento volta para a consulta", async () => {
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  await user.click(await screen.findByRole("button", { name: "Alterar documento" }));

  expect(screen.getByLabelText("Documento")).toHaveValue("52998224725");
  expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
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

test("paciente existente é confirmado em somente leitura e apenas vinculado", async () => {
  lookupResult = existing;
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  expect(
    await screen.findByRole("heading", { name: "Confirme os dados do paciente" }),
  ).toBeVisible();
  expect(screen.getByText("Cadastro existente")).toBeVisible();
  expect(screen.getByText("Helena Prado")).toBeVisible();
  expect(screen.getByText("+5511988887777")).toBeVisible();
  expect(screen.getByText("helena@example.test")).toBeVisible();
  expect(screen.getByText("14/03/1988")).toBeVisible();
  expect(screen.getByText("AB-")).toBeVisible();
  expect(screen.getByText("Feminino")).toBeVisible();
  expect(screen.getByText("Prefere contato à tarde")).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(requestsTo("/patients/clinic-link")).toHaveLength(0);

  await user.click(screen.getByRole("button", { name: "Confirmar e vincular" }));

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/app/pacientes"));
  expect(requestMock).toHaveBeenCalledWith("/patients/clinic-link", {
    method: "POST",
    body: JSON.stringify({
      documentCountryCode: "BR",
      documentType: "CPF",
      document: "52998224725",
    }),
  });
  expect(requestsTo("/patients")).toHaveLength(0);
});

test("vínculo de paciente existente devolve o paciente ao agendamento", async () => {
  window.history.replaceState(
    {},
    "",
    "/app/pacientes/novo?returnTo=%2Fapp%2Fagenda%2Fnova%3Fdate%3D2026-08-10",
  );
  lookupResult = existing;
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);
  await user.click(await screen.findByRole("button", { name: "Confirmar e vincular" }));

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(
    "/app/agenda/nova?date=2026-08-10&patientId=patient-9",
  ));
});

test("avisa que o cadastro inativo será reativado ao vincular", async () => {
  lookupResult = { ...existing, patient: { ...existing.patient!, isActive: false } };
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  expect(await screen.findByText("Inativo")).toBeVisible();
  expect(screen.getByText(/volta a ficar ativo/i)).toBeVisible();
});

test("voltar da confirmação não cria vínculo", async () => {
  lookupResult = existing;
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);
  await user.click(await screen.findByRole("button", { name: "Voltar" }));

  expect(screen.getByLabelText("Documento")).toHaveValue("52998224725");
  expect(requestsTo("/patients/clinic-link")).toHaveLength(0);
  expect(navigateMock).not.toHaveBeenCalled();
});

test("paciente que já é da clínica não é cadastrado de novo", async () => {
  lookupResult = { status: "AlreadyLinked", patientId: "patient-3", patient: null };
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  expect(await screen.findByRole("status")).toHaveTextContent(
    "já é de um paciente desta clínica",
  );
  expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Abrir cadastro" }));
  expect(navigateMock).toHaveBeenCalledWith("/app/pacientes/patient-3/editar");
  expect(requestsTo("/patients")).toHaveLength(0);
  expect(requestsTo("/patients/clinic-link")).toHaveLength(0);
});

test("apresenta a falha da consulta do documento", async () => {
  requestMock = vi.fn(async () => {
    throw new ApiError("Informe um CPF válido.", 400);
  });
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitDocument(user);

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe um CPF válido.");
  expect(screen.getByLabelText("Documento")).toBeVisible();
});

test("documento cadastrado durante o preenchimento leva à confirmação do existente", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/patients/lookup") return lookupResult;
    if (path === "/patients") {
      lookupResult = existing;
      throw new ApiError("Já existe um paciente com este documento.", 409);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitPatient(user);

  expect(
    await screen.findByRole("heading", { name: "Confirme os dados do paciente" }),
  ).toBeVisible();
  expect(requestsTo("/patients/lookup")).toHaveLength(2);
});

test("mantém o formulário e apresenta a falha do cadastro", async () => {
  requestMock = vi.fn(async (path: string) => {
    if (path === "/patients/lookup") return notFound;
    throw new ApiError("Não foi possível salvar agora.", 500);
  });
  const user = userEvent.setup();
  render(<Harness><NewPatientPage /></Harness>);
  await submitPatient(user);

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar agora.");
  expect(screen.getByLabelText("Observações")).toBeVisible();
});
