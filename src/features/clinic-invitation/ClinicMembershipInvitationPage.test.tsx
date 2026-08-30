import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import type {
  AuthResponse,
  AuthV2Authenticated,
  ClinicMembershipInvitationAcceptance,
  ClinicMembershipInvitationPublicView,
} from "../../api/types";
import { ApiError } from "../../api/client";
import { ClinicMembershipInvitationPage } from "./ClinicMembershipInvitationPage";

const {
  apiRequest,
  authState,
  logout,
  navigate,
  persistInvitationSession,
} = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authState: { session: null as AuthResponse | null },
  logout: vi.fn(),
  navigate: vi.fn(),
  persistInvitationSession: vi.fn(),
}));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiRequest,
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    session: authState.session,
    logout,
    persistInvitationSession,
  }),
}));

vi.mock("../../app/navigation", () => ({
  useNavigate: () => navigate,
}));

const reference = "opaque.invitation-reference";
const newIdentityView: ClinicMembershipInvitationPublicView = {
  clinicName: "Clínica Horizonte",
  inviteeName: "Dra. Helena Costa",
  role: "Doctor",
  emailMasked: "he***@exemplo.com",
  expiresAtUtc: "2099-08-31T12:00:00Z",
  mode: "SetInitialPassword",
};

const invitationSession: AuthV2Authenticated = {
  kind: "authenticated",
  accessToken: "invitation-access",
  refreshToken: "invitation-refresh",
  accessTokenExpiresAtUtc: "2099-09-01T12:00:00Z",
  user: { id: "user-invited", name: "Dra. Helena Costa" },
  clinicContext: {
    userClinicId: "membership-invited",
    clinicId: "clinic-horizonte",
    clinicName: "Clínica Horizonte",
    role: "Doctor",
    isAdmin: false,
    email: "helena@exemplo.com",
    phone: "+5511999990000",
  },
};

const acceptance: ClinicMembershipInvitationAcceptance = {
  outcome: "Accepted",
  session: invitationSession,
};

function currentSession(): AuthResponse {
  return {
    userId: "current-user",
    name: "Dra. Helena Costa",
    email: "helena@outra-clinica.com",
    phone: "+5511999990000",
    clinicId: "clinic-current",
    clinicName: "Clínica Atual",
    userClinicId: "membership-current",
    clinicRole: "Doctor",
    isAdmin: false,
    roles: ["Doctor"],
    availableClinics: [
      {
        userClinicId: "membership-current",
        clinicId: "clinic-current",
        clinicName: "Clínica Atual",
        role: "Doctor",
        isAdmin: false,
      },
    ],
    tokens: {
      accessToken: "current-access",
      refreshToken: "current-refresh",
      accessTokenExpiresAtUtc: "2099-09-01T12:00:00Z",
    },
  };
}

function Harness({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderPage() {
  return render(
    <Harness>
      <ClinicMembershipInvitationPage reference={reference} />
    </Harness>,
  );
}

function resolveWith(view: ClinicMembershipInvitationPublicView) {
  apiRequest.mockImplementation((path: string) => {
    if (path === "/public/clinic-membership-invitations/resolve") {
      return Promise.resolve(view);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
}

async function fillNewPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Crie sua senha"), "Senha123!");
  await user.type(screen.getByLabelText("Confirme sua senha"), "Senha123!");
}

beforeEach(() => {
  authState.session = null;
  apiRequest.mockReset();
  logout.mockReset();
  navigate.mockReset();
  persistInvitationSession.mockReset();
  persistInvitationSession.mockReturnValue({
    kind: "authenticated",
    session: currentSession(),
  });
  resolveWith(newIdentityView);
});

test("resolve o convite por POST com a referência somente no corpo", async () => {
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Ative seu acesso à clínica" }),
  ).toBeVisible();
  expect(apiRequest).toHaveBeenCalledWith(
    "/public/clinic-membership-invitations/resolve",
    {
      method: "POST",
      body: JSON.stringify({ reference }),
    },
  );
  expect(screen.queryByText(reference)).not.toBeInTheDocument();
});

test("mostra somente a identidade segura do convite e a expiração", async () => {
  renderPage();

  expect(await screen.findByText("Clínica Horizonte")).toBeVisible();
  expect(screen.getByText("Dra. Helena Costa")).toBeVisible();
  expect(screen.getByText("he***@exemplo.com")).toBeVisible();
  expect(screen.getByText("Médico")).toBeVisible();
  expect(screen.getByText(/31 de agosto de 2099/i)).toBeVisible();
  expect(screen.queryByText("helena@exemplo.com")).not.toBeInTheDocument();
});

test("pede primeira senha e confirmação para identidade nova", async () => {
  renderPage();

  expect(await screen.findByLabelText("Crie sua senha")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  expect(screen.getByLabelText("Confirme sua senha")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Manter minha conexão" })).toBeChecked();
});

test("rejeita primeira senha fora da política antes de chamar a API", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.type(await screen.findByLabelText("Crie sua senha"), "fraca");
  await user.type(screen.getByLabelText("Confirme sua senha"), "fraca");
  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.",
  );
  expect(apiRequest).toHaveBeenCalledTimes(1);
});

test("rejeita confirmação de senha diferente antes de chamar a API", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.type(await screen.findByLabelText("Crie sua senha"), "Senha123!");
  await user.type(screen.getByLabelText("Confirme sua senha"), "Outra123!");
  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "As senhas não coincidem.",
  );
  expect(apiRequest).toHaveBeenCalledTimes(1);
});

test("aceita identidade nova, persiste a sessão escolhida e abre o onboarding", async () => {
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(newIdentityView);
    if (path.endsWith("/accept-new")) return Promise.resolve(acceptance);
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  renderPage();
  await fillNewPassword(user);

  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith(
    "/app/onboarding",
    { replace: true },
  ));
  expect(apiRequest).toHaveBeenCalledWith(
    "/public/clinic-membership-invitations/accept-new",
    {
      method: "POST",
      body: JSON.stringify({ reference, password: "Senha123!" }),
    },
  );
  expect(persistInvitationSession).toHaveBeenCalledWith(acceptance, true);
});

test("replay sem a sessão original direciona ao login", async () => {
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(newIdentityView);
    if (path.endsWith("/accept-new")) {
      return Promise.resolve({ outcome: "AlreadyAccepted", session: null });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  persistInvitationSession.mockReturnValue({ kind: "login_required" });
  const user = userEvent.setup();
  renderPage();
  await fillNewPassword(user);

  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/entrar", {
    replace: true,
  }));
});

test("aceita conta existente pela sessão atual sem pedir senha", async () => {
  authState.session = currentSession();
  const existingView = {
    ...newIdentityView,
    mode: "AuthenticateExistingAccount",
  } as const;
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(existingView);
    if (path.endsWith("/accept-existing")) return Promise.resolve(acceptance);
    throw new Error(`Unexpected request: ${path}`);
  });
  const user = userEvent.setup();
  renderPage();

  expect(await screen.findByText(/conectado como Dra\. Helena Costa/i)).toBeVisible();
  expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Aceitar convite" }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
    "/public/clinic-membership-invitations/accept-existing",
    {
      method: "POST",
      body: JSON.stringify({ reference, currentPassword: null }),
    },
    "current-access",
  ));
});

test("pede a senha atual quando não há sessão para a conta existente", async () => {
  resolveWith({ ...newIdentityView, mode: "AuthenticateExistingAccount" });
  const user = userEvent.setup();
  renderPage();

  await user.type(await screen.findByLabelText("Senha atual"), "Atual123!");
  await user.click(screen.getByRole("button", { name: "Aceitar convite" }));

  expect(apiRequest).toHaveBeenCalledWith(
    "/public/clinic-membership-invitations/accept-existing",
    {
      method: "POST",
      body: JSON.stringify({ reference, currentPassword: "Atual123!" }),
    },
  );
});

test("mostra erro seguro quando a senha atual está incorreta", async () => {
  const existingView = {
    ...newIdentityView,
    mode: "AuthenticateExistingAccount",
  } as const;
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(existingView);
    return Promise.reject(new ApiError("raw identity detail", 401));
  });
  const user = userEvent.setup();
  renderPage();
  await user.type(await screen.findByLabelText("Senha atual"), "Errada123!");

  await user.click(screen.getByRole("button", { name: "Aceitar convite" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível confirmar sua senha atual.",
  );
  expect(screen.queryByText("raw identity detail")).not.toBeInTheDocument();
});

test("orienta sair quando a sessão pertence a outra identidade", async () => {
  authState.session = currentSession();
  const existingView = {
    ...newIdentityView,
    mode: "AuthenticateExistingAccount",
  } as const;
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(existingView);
    return Promise.reject(new ApiError("raw forbidden detail", 403));
  });
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Aceitar convite" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Este convite pertence a outra conta.",
  );
  await user.click(
    screen.getByRole("button", { name: "Sair e usar a conta convidada" }),
  );
  expect(logout).toHaveBeenCalledOnce();
  expect(screen.queryByText("raw forbidden detail")).not.toBeInTheDocument();
});

test("explica limite temporário sem expor o detalhe da API", async () => {
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(newIdentityView);
    return Promise.reject(new ApiError("raw rate detail", 429));
  });
  const user = userEvent.setup();
  renderPage();
  await fillNewPassword(user);

  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
  );
  expect(screen.queryByText("raw rate detail")).not.toBeInTheDocument();
});

test("mantém o formulário disponível após falha recuperável", async () => {
  let attempts = 0;
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) return Promise.resolve(newIdentityView);
    attempts += 1;
    return attempts === 1
      ? Promise.reject(new ApiError("provider internals", 500))
      : Promise.resolve(acceptance);
  });
  const user = userEvent.setup();
  renderPage();
  await fillNewPassword(user);

  const submit = screen.getByRole("button", { name: "Ativar meu acesso" });
  await user.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível ativar agora. Tente novamente.",
  );
  expect(submit).toBeEnabled();
  await user.click(submit);

  await waitFor(() => expect(navigate).toHaveBeenCalledWith(
    "/app/onboarding",
    { replace: true },
  ));
});

test("recarrega o convite quando o modo muda durante o envio", async () => {
  const existingView = {
    ...newIdentityView,
    mode: "AuthenticateExistingAccount",
  } as const;
  let resolves = 0;
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/resolve")) {
      resolves += 1;
      return Promise.resolve(resolves === 1 ? newIdentityView : existingView);
    }
    return Promise.reject(new ApiError("mode_changed", 409));
  });
  const user = userEvent.setup();
  renderPage();
  await fillNewPassword(user);

  await user.click(screen.getByRole("button", { name: "Ativar meu acesso" }));

  expect(await screen.findByLabelText("Senha atual")).toBeVisible();
  expect(screen.queryByLabelText("Crie sua senha")).not.toBeInTheDocument();
  expect(resolves).toBe(2);
});

test.each([
  ["Expired", "Este convite expirou", "Solicite um novo convite à clínica."],
  ["Cancelled", "Este convite foi cancelado", "Solicite um novo convite à clínica."],
] as const)("mostra o estado terminal %s sem formulário", async (mode, title, message) => {
  resolveWith({ ...newIdentityView, mode });
  renderPage();

  expect(await screen.findByRole("status", { name: title })).toBeVisible();
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByRole("button", { name: /Ativar|Aceitar/ })).not.toBeInTheDocument();
});

test("convite já aceito direciona para o login quando não há sessão", async () => {
  resolveWith({ ...newIdentityView, mode: "Accepted" });
  const user = userEvent.setup();
  renderPage();

  expect(
    await screen.findByRole("status", { name: "Convite já aceito" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Entrar no ClinicFlow" }));
  expect(navigate).toHaveBeenCalledWith("/entrar");
});

test("referência inválida mostra resposta genérica e nunca o detalhe bruto", async () => {
  apiRequest.mockRejectedValue(new ApiError("raw challenge detail", 404));
  renderPage();

  expect(
    await screen.findByRole("alert", { name: "Convite inválido ou indisponível" }),
  ).toBeVisible();
  expect(screen.queryByText("raw challenge detail")).not.toBeInTheDocument();
  expect(screen.queryByText(reference)).not.toBeInTheDocument();
});
