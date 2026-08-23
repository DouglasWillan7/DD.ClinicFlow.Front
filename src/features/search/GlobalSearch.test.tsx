import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AuthResponse, Member, PatientListItem } from "../../api/types";
import { GlobalSearch } from "./GlobalSearch";

const { navigate, requestMock } = vi.hoisted(() => ({
  navigate: vi.fn(),
  requestMock: vi.fn(),
}));

const session: AuthResponse = {
  userId: "u-1",
  email: "recepcao@example.test",
  clinicId: "c-1",
  roles: ["Secretary"],
  name: "Camila Duarte",
  tokens: {
    accessToken: "token",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session }),
}));

vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigate,
}));

function patient(
  overrides: Partial<PatientListItem> & Pick<PatientListItem, "id" | "name">,
): PatientListItem {
  return {
    cpf: "12345678901",
    medicalRecordNumber: 1024,
    bloodType: null,
    sexForClinicalUse: null,
    phone: "+5511988887777",
    birthDate: "1990-03-10",
    notes: null,
    doctorUserId: "d1",
    isActive: true,
    whatsappConsentAtUtc: null,
    createdAtUtc: "2026-01-01T12:00:00Z",
    lastAppointmentUtc: null,
    nextAppointmentUtc: null,
    nextAppointmentType: null,
    situation: "EmAcompanhamento",
    ...overrides,
  };
}

const patients: PatientListItem[] = [
  patient({ id: "p1", name: "Mariana Souza Almeida" }),
  patient({ id: "p2", name: "Marcos Vinícius Teles", medicalRecordNumber: 88 }),
];
const members: Member[] = [
  {
    userId: "d1",
    email: "helena@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    specialty: "Cardiologia",
  },
];

const store = new Map<string, string>();

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderSearch() {
  render(
    <Harness>
      <GlobalSearch />
    </Harness>,
  );
  return screen.getByRole("combobox", { name: "Busca global" });
}

beforeEach(() => {
  navigate.mockClear();
  store.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
  requestMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/patients")) return patients;
    if (path === "/clinics/members") return members;
    throw new Error(`Unexpected request: ${path}`);
  });
});

test("agrupa pacientes e médicos e destaca o trecho digitado", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "ma");

  const patientOption = await screen.findByRole("option", {
    name: /Paciente Mariana Souza Almeida/,
  });
  expect(patientOption).toHaveTextContent("36 anos");
  expect(patientOption).toHaveTextContent("Ficha");
  expect(screen.getByText("Pacientes")).toBeVisible();

  await user.clear(search);
  await user.type(search, "cardio");
  const doctorOption = await screen.findByRole("option", {
    name: /Médico Dra\. Helena Costa/,
  });
  expect(doctorOption).toHaveTextContent("Agenda");
  expect(screen.getByText("Médicos")).toBeVisible();
});

test("abre a ficha do paciente e passa a oferecê-lo em Recentes", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "mariana");
  await user.click(
    await screen.findByRole("option", { name: /Mariana Souza Almeida/ }),
  );

  expect(navigate).toHaveBeenCalledWith("/app/pacientes/p1");
  expect(search).toHaveValue("");

  await user.click(search);
  const recent = await screen.findByRole("option", {
    name: /Mariana Souza Almeida\. Paciente · aberto hoje/,
  });
  expect(recent).toBeVisible();
  expect(screen.getByText("Recentes")).toBeVisible();
});

test("escolher o médico abre a agenda dele", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "helena");
  await user.click(await screen.findByRole("option", { name: /Helena Costa/ }));

  expect(navigate).toHaveBeenCalledWith("/app/agenda?doctorId=d1");
});

test("sem paciente correspondente, oferece o cadastro com o nome preenchido", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "Beatriz Nogueira");

  expect(
    await screen.findByText("Nenhum resultado para “Beatriz Nogueira”."),
  ).toBeVisible();
  await user.click(
    screen.getByRole("option", {
      name: 'Cadastrar “Beatriz Nogueira” como novo paciente',
    }),
  );

  expect(navigate).toHaveBeenCalledWith(
    "/app/pacientes/novo?nome=Beatriz%20Nogueira",
  );
});

test("teclado percorre os resultados e o Enter abre o destacado", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "ma");
  await screen.findByRole("option", { name: /Marcos Vinícius Teles/ });

  // Sem navegar, o Enter abre o primeiro; a seta desce para o segundo.
  await user.keyboard("{ArrowDown}{ArrowDown}");
  const [first, second] = screen.getAllByRole("option");
  expect(first).toHaveAttribute("aria-selected", "false");
  expect(second).toHaveAttribute("aria-selected", "true");
  expect(search).toHaveAttribute(
    "aria-activedescendant",
    second.getAttribute("id"),
  );

  await user.keyboard("{Enter}");
  expect(navigate).toHaveBeenCalledWith("/app/pacientes/p1");
});

test("Esc fecha o dropdown sem apagar o termo", async () => {
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "ma");
  expect(await screen.findByRole("listbox")).toBeVisible();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(search).toHaveValue("ma");
});

test("⌘K traz o foco para a busca de qualquer lugar da tela", async () => {
  const user = userEvent.setup();
  const search = renderSearch();
  expect(search).not.toHaveFocus();

  await user.keyboard("{Meta>}k{/Meta}");
  expect(search).toHaveFocus();
});

test("enquanto o índice carrega não oferece cadastrar duplicado", async () => {
  let releasePatients: (value: PatientListItem[]) => void = () => undefined;
  requestMock.mockImplementation(async (path: string) => {
    if (path === "/clinics/members") return members;
    return new Promise<PatientListItem[]>((resolve) => {
      releasePatients = resolve;
    });
  });
  const user = userEvent.setup();
  const search = renderSearch();

  await user.type(search, "mariana");
  expect(
    await screen.findByText("Carregando pacientes e médicos…"),
  ).toBeVisible();
  expect(screen.queryByRole("option")).not.toBeInTheDocument();

  releasePatients(patients);
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: /Mariana Souza Almeida/ }),
    ).toBeVisible(),
  );
});
