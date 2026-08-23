import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Doctor, HealthInsurancePlan } from "../../api/types";
import { NewDoctorPage } from "./NewDoctorPage";

let requestMock = vi.fn();
let navigateMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));
vi.mock("../../app/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/navigation")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const plans: HealthInsurancePlan[] = [
  { id: "plano-particular", name: "Particular" },
  { id: "plano-unimed", name: "Unimed" },
];

const created: Doctor = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "helena@clinica.com.br",
  name: "Helena Martins Sarmento",
  roles: ["Doctor"],
  isCreator: false,
  hasAccess: false,
  hasPendingInvitation: false,
  medicalLicense: "128455",
  medicalLicenseState: "SP",
  specialty: "Gastroenterologia",
  cpf: "41288732090",
  birthDate: "1985-03-22",
  phone: "11987124455",
  gender: "Feminino",
  rqe: null,
  practiceAreas: null,
  bio: null,
  slotDurationMinutes: 30,
  healthInsurancePlanIds: ["plano-particular"],
  scheduleIntervals: [
    { id: "i1", dayOfWeek: "Monday", startLocal: "08:00:00", endLocal: "18:00:00" },
  ],
};

function setTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function QueryHarness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let postedBody: unknown;

beforeEach(() => {
  window.history.replaceState({}, "", "/app/equipe/novo");
  navigateMock = vi.fn();
  postedBody = undefined;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/health-insurance-plans") return plans;
    if (path === "/clinics/doctors" && init?.method === "POST") {
      postedBody = JSON.parse(String(init.body));
      return created;
    }
    throw new Error(`Rota inesperada: ${path}`);
  });
});

async function preencherFormulario(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText(/Nome completo/),
    "Helena Martins Sarmento",
  );
  await user.type(screen.getByLabelText(/^CPF/), "41288732090");
  await user.type(screen.getByLabelText(/Celular/), "11987124455");
  await user.type(screen.getByLabelText(/E-mail/), "helena@clinica.com.br");
  await user.type(screen.getByLabelText(/^CRM/), "128455");
  await user.selectOptions(screen.getByLabelText(/UF do CRM/), "SP");
  await user.selectOptions(
    screen.getByLabelText(/Especialidade/),
    "Gastroenterologia",
  );
  await user.type(screen.getByLabelText(/^Início \*/), "08:00");
  await user.type(screen.getByLabelText(/^Fim \*/), "18:00");
  await user.selectOptions(screen.getByLabelText(/Duração da consulta/), "30");
}

test("começa com Seg–Sex marcados e 8% de progresso", async () => {
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  expect(await screen.findByText("8% completo")).toBeVisible();
  expect(screen.getByRole("button", { name: "segunda-feira" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "sábado" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const summary = screen.getByRole("complementary", {
    name: "Resumo do cadastro",
  });
  expect(within(summary).getByText("Novo médico")).toBeVisible();
  expect(within(summary).getByText("Preencha os dados ao lado")).toBeVisible();
  expect(within(summary).getByText("?")).toBeVisible();
});

test("o resumo acompanha o preenchimento", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await user.type(
    await screen.findByLabelText(/Nome completo/),
    "Helena Martins Sarmento",
  );
  await user.type(screen.getByLabelText(/^CRM/), "128455");
  await user.selectOptions(screen.getByLabelText(/UF do CRM/), "SP");

  expect(screen.getByText("Dr(a). Helena Martins Sarmento")).toBeVisible();
  expect(screen.getByText("CRM 128455-SP")).toBeVisible();
  expect(screen.getByText("HS")).toBeVisible();
});

test("Descartar limpa inclusive os dias pré-marcados", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await user.type(await screen.findByLabelText(/Nome completo/), "Helena");
  await user.click(screen.getByRole("button", { name: "Descartar" }));

  expect(screen.getByLabelText(/Nome completo/)).toHaveValue("");
  expect(screen.getByRole("button", { name: "segunda-feira" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await screen.findByText("0% completo")).toBeVisible();
});

test("salva o médico e mostra o banner de confirmação", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await preencherFormulario(user);
  await user.click(screen.getByRole("button", { name: "Particular" }));
  await user.click(screen.getByRole("button", { name: "Salvar médico" }));

  await waitFor(() => expect(postedBody).toBeDefined());
  expect(postedBody).toMatchObject({
    name: "Helena Martins Sarmento",
    email: "helena@clinica.com.br",
    cpf: "41288732090",
    phone: "11987124455",
    medicalLicense: "128455",
    medicalLicenseState: "SP",
    specialty: "Gastroenterologia",
    slotDurationMinutes: 30,
    healthInsurancePlanIds: ["plano-particular"],
  });
  expect(
    (postedBody as { scheduleIntervals: unknown[] }).scheduleIntervals,
  ).toHaveLength(5);

  const banner = await screen.findByRole("status");
  expect(within(banner).getByText(/Médico salvo/)).toBeVisible();
  expect(within(banner).getByRole("link", { name: "Abrir perfil" })).toBeVisible();
});

test("Salvar e ver na agenda leva à agenda do médico", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await preencherFormulario(user);
  await user.click(
    screen.getByRole("button", { name: "Salvar e ver na agenda" }),
  );

  await waitFor(() =>
    expect(navigateMock).toHaveBeenCalledWith(
      `/app/agenda?doctorId=${created.userId}`,
    ),
  );
});

test("o detalhe por dia substitui o horário único e mantém um só Salvar", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await preencherFormulario(user);
  await user.click(
    await screen.findByLabelText(/Horários diferentes por dia/),
  );

  // O horário único some; cada dia passa a ter a própria linha.
  expect(screen.queryByLabelText(/^Início \*/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Início 1 de segunda-feira")).toHaveValue("08:00");

  await user.click(
    screen.getByRole("button", { name: "Adicionar intervalo de segunda-feira" }),
  );
  // fireEvent em input[type=time]: digitar segmento a segundo é instável no jsdom.
  setTime("Fim 1 de segunda-feira", "12:00");
  setTime("Início 2 de segunda-feira", "14:00");
  setTime("Fim 2 de segunda-feira", "18:00");

  // A agenda vive dentro do formulário do cadastro: um form só, sem "Salvar agenda semanal".
  expect(document.querySelectorAll("form")).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: /agenda semanal/i }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Salvar médico" }));

  await waitFor(() => expect(postedBody).toBeDefined());
  const intervals = (postedBody as { scheduleIntervals: unknown[] })
    .scheduleIntervals;
  expect(intervals).toContainEqual({
    dayOfWeek: "Monday",
    startLocal: "08:00",
    endLocal: "12:00",
  });
  expect(intervals).toContainEqual({
    dayOfWeek: "Monday",
    startLocal: "14:00",
    endLocal: "18:00",
  });
});

test("não envia com CRM inválido", async () => {
  const user = userEvent.setup();
  render(
    <QueryHarness>
      <NewDoctorPage />
    </QueryHarness>,
  );

  await preencherFormulario(user);
  await user.clear(screen.getByLabelText(/^CRM/));
  await user.type(screen.getByLabelText(/^CRM/), "12A455");
  await user.click(screen.getByRole("button", { name: "Salvar médico" }));

  expect(
    await screen.findByText("O CRM deve conter apenas números."),
  ).toBeVisible();
  expect(postedBody).toBeUndefined();
});
