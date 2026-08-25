import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { AppShell } from "./AppShell";

const { authState, logout, navigate, request, routerState, switchClinic } = vi.hoisted(() => ({
  authState: {
    clinicRole: "Doctor" as "Doctor" | "Nurse" | "Secretary",
    isAdmin: true,
    roles: ["Doctor", "Admin"] as Array<"Admin" | "Doctor" | "Nurse" | "Secretary">,
  },
  logout: vi.fn(),
  navigate: vi.fn(),
  request: vi.fn(async () => []),
  routerState: { pathname: "/app/agenda" },
  switchClinic: vi.fn(),
}));

/** Coloca o shell na rota pedida; `useSearchParams` é o real, sobre a URL. */
function renderShell(url = "/app/agenda") {
  routerState.pathname = url.split("?")[0];
  window.history.replaceState({}, "", url);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AppShell>
        <h1>Conteúdo</h1>
      </AppShell>
    </QueryClientProvider>,
  );
}

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    session: {
      userId: "u-1",
      email: "ana@example.test",
      clinicId: "c-1",
      clinicName: "Clínica Centro",
      userClinicId: "uc-1",
      clinicRole: authState.clinicRole,
      isAdmin: authState.isAdmin,
      availableClinics: [
        {
          userClinicId: "uc-1",
          clinicId: "c-1",
          clinicName: "Clínica Centro",
          role: "Doctor",
          isAdmin: true,
        },
        {
          userClinicId: "uc-2",
          clinicId: "c-2",
          clinicName: "Clínica Norte",
          role: "Secretary",
          isAdmin: false,
        },
      ],
      roles: authState.roles,
      name: "Ana Martins",
      tokens: {
        accessToken: "token",
        refreshToken: "refresh-token",
        accessTokenExpiresAtUtc: "2030-01-01T00:00:00Z",
      },
    },
    logout,
    request,
    switchClinic,
  }),
}));

vi.mock("./navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./navigation")>()),
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: routerState.pathname, state: null }),
  NavLink: ({ to, children, className, onClick }: {
    to: string;
    children: ReactNode;
    className?: string | ((state: { isActive: boolean }) => string);
    onClick?: () => void;
  }) => {
    const isActive = to === routerState.pathname;
    const resolved = typeof className === "function"
      ? className({ isActive })
      : className;
    return (
      <a
        href={to}
        className={resolved}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
      >
        {children}
      </a>
    );
  },
}));

// O localStorage do ambiente de teste não implementa os métodos padrão.
const railStore = new Map<string, string>();

beforeEach(() => {
  authState.clinicRole = "Doctor";
  authState.isAdmin = true;
  authState.roles = ["Doctor", "Admin"];
  logout.mockClear();
  navigate.mockClear();
  switchClinic.mockReset();
  railStore.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => railStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        railStore.set(key, String(value));
      },
      removeItem: (key: string) => {
        railStore.delete(key);
      },
      clear: () => railStore.clear(),
      key: (index: number) => [...railStore.keys()][index] ?? null,
      get length() {
        return railStore.size;
      },
    },
  });
});

test("rail expõe destinos e usuário sem depender de ícones", () => {
  renderShell();

  expect(
    screen.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Agendas" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: /Ana Martins/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sair" })).toBeVisible();
});

test("médico usa o Início pessoal e mantém o acesso a Agendas", () => {
  authState.isAdmin = false;
  authState.roles = ["Doctor"];
  renderShell("/app/inicio");

  expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Agendas" })).toHaveAttribute(
    "href",
    "/app/agenda",
  );
});

test("médico administrador mantém Início e também recebe Agendas", () => {
  authState.roles = ["Admin", "Doctor"];
  renderShell("/app/inicio");

  expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Agendas" })).toHaveAttribute(
    "href",
    "/app/agenda",
  );
});

test("admin de secretaria administra a clínica sem receber navegação clínica", () => {
  authState.clinicRole = "Secretary";
  authState.isAdmin = true;
  // Um array legado conflitante não pode ampliar o contexto v2.
  authState.roles = ["Doctor", "Admin"];
  renderShell("/app/agenda");

  expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Agendas" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Equipe" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Clínica" })).toBeVisible();
});

test("enfermagem herda operação sem receber prontuário ou administração", () => {
  authState.clinicRole = "Nurse";
  authState.isAdmin = false;
  authState.roles = ["Admin"];
  renderShell("/app/agenda");

  expect(screen.getByRole("link", { name: "Agendas" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Pacientes" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Equipe" })).not.toBeInTheDocument();
  expect(screen.queryByText("Configuração")).not.toBeInTheDocument();
});

// A busca em si é coberta em features/search/GlobalSearch.test.tsx; aqui só
// interessa que a topbar a ofereça igual em qualquer rota, sem tocar na URL.
test("a mesma busca global aparece em todas as telas", async () => {
  const user = userEvent.setup();
  renderShell("/app/configuracoes/perfil");

  const search = screen.getByRole("combobox", { name: "Busca global" });
  expect(search).toHaveAttribute("placeholder", "Buscar médico ou paciente…");

  await user.type(search, "marina");
  expect(window.location.search).toBe("");
  expect(navigate).not.toHaveBeenCalled();
});

test("hover expande o menu e o recolhe ao sair", async () => {
  const user = userEvent.setup();
  renderShell();

  const shell = screen.getByRole("complementary").parentElement;
  expect(shell?.className).not.toContain("shellExpanded");

  await user.hover(screen.getByRole("complementary"));
  expect(shell?.className).toContain("shellExpanded");

  await user.unhover(screen.getByRole("complementary"));
  expect(shell?.className).not.toContain("shellExpanded");
});

test("o alfinete fixa o menu aberto e guarda a preferência do usuário", async () => {
  const user = userEvent.setup();
  const { unmount } = renderShell();

  const sidebar = screen.getByRole("complementary");
  const shell = sidebar.parentElement;
  const pin = screen.getByRole("button", { name: "Fixar menu" });
  expect(pin).toHaveAttribute("aria-pressed", "false");

  await user.click(pin);

  const unpin = screen.getByRole("button", { name: "Desafixar menu" });
  expect(unpin).toHaveAttribute("aria-pressed", "true");
  // Fixado, sair com o mouse não recolhe.
  await user.unhover(sidebar);
  expect(shell?.className).toContain("shellExpanded");

  unmount();
  renderShell();
  expect(screen.getByRole("complementary").parentElement?.className).toContain(
    "shellExpanded",
  );

  await user.click(screen.getByRole("button", { name: "Desafixar menu" }));
  expect(screen.getByRole("button", { name: "Fixar menu" })).toBeVisible();
});

test("drawer mobile fecha por Esc e restaura foco", async () => {
  const user = userEvent.setup();
  renderShell();
  const trigger = screen.getByRole("button", { name: "Abrir navegação" });
  const drawer = screen.getByRole("complementary");
  const workspace = screen.getByRole("main").parentElement;

  await user.click(trigger);
  expect(drawer.className).toContain("sidebarOpen");
  await waitFor(() => expect(drawer).toHaveFocus());
  expect(workspace).toHaveAttribute("inert");

  await user.keyboard("{Escape}");
  expect(drawer.className).not.toContain("sidebarOpen");
  await waitFor(() => expect(trigger).toHaveFocus());
});

test("menu de conta exibe somente o papel e admin do contexto ativo", async () => {
  const user = userEvent.setup();
  renderShell();

  const account = screen.getByRole("button", {
    name: "Ana Martins, Clínica Centro, Médico, Administração",
  });
  await user.click(account);

  expect(screen.getByText("Contexto atual")).toBeVisible();
  expect(screen.getByText("Clínica Centro")).toBeVisible();
  expect(screen.getByText("Médico · Administração")).toBeVisible();
  expect(screen.queryByText("Médico · Secretaria")).not.toBeInTheDocument();
});

test("troca a clínica pelo menu e segue para o início permitido pelo novo contexto", async () => {
  const user = userEvent.setup();
  switchClinic.mockResolvedValue({
    userClinicId: "uc-2",
    clinicId: "c-2",
    clinicName: "Clínica Norte",
    clinicRole: "Secretary",
    isAdmin: false,
    roles: ["Secretary"],
  });
  renderShell("/app/inicio");

  await user.click(screen.getByRole("button", { name: /Ana Martins/ }));
  const north = screen.getByRole("button", { name: "Clínica Norte, Secretaria" });
  north.focus();
  await user.keyboard("{Enter}");

  expect(switchClinic).toHaveBeenCalledWith("uc-2");
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/app/agenda", { replace: true }));
});

test("mantém o contexto atual e explica quando o vínculo de destino está indisponível", async () => {
  const user = userEvent.setup();
  switchClinic.mockRejectedValue(Object.assign(new Error("Indisponível"), { status: 401 }));
  renderShell();

  await user.click(screen.getByRole("button", { name: /Ana Martins/ }));
  await user.click(screen.getByRole("button", { name: "Clínica Norte, Secretaria" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "A outra clínica não está disponível. Você continua na Clínica Centro.",
  );
  expect(screen.getByText("Clínica Centro")).toBeVisible();
});
