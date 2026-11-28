import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type {
  AuthResponse,
  ClinicMember,
  ClinicMembershipInvitationStatus,
  DoctorSchedule,
  UserClinicHealthcarePlans,
} from "../../api/types";
import { ApiError } from "../../api/client";
import { UnsavedChangesProvider } from "../../app/unsavedChanges";
import { TeamPage } from "./TeamPage";

const session: AuthResponse = {
  userId: "owner-user",
  name: "Ana Martins",
  email: "ana@centro.test",
  phone: "+5511988887777",
  clinicId: "clinic-1",
  clinicName: "Clínica Centro",
  userClinicId: "owner-membership",
  clinicRole: "Doctor",
  isAdmin: true,
  roles: ["Doctor", "Admin"],
  availableClinics: [{
    userClinicId: "owner-membership",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    role: "Doctor",
    isAdmin: true,
  }],
  tokens: {
    accessToken: "access",
    refreshToken: "refresh",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  },
};

const members: ClinicMember[] = [
  {
    userClinicId: "owner-membership",
    userId: "owner-user",
    clinicId: "clinic-1",
    displayName: "Ana Martins",
    status: "Active",
    role: "Doctor",
    isAdmin: true,
    isOwner: true,
    email: "ana@centro.test",
    phone: "+5511988887777",
    emailConfirmedAtUtc: "2026-08-01T10:00:00Z",
    phoneConfirmedAtUtc: null,
    doctorProfile: {
      professionalAuthority: "CRM",
      professionalRegistrationNumber: "123",
      professionalRegistrationRegion: "SP",
      professionalRegistrationCountryCode: "BR",
      specialty: "Clínica médica",
      practiceAreas: null,
      bio: null,
      defaultAppointmentDurationMinutes: 30,
    },
    defaultAppointmentDurationSource: "Configured",
    sessionVersion: 1,
    createdAtUtc: "2026-08-01T10:00:00Z",
    updatedAtUtc: "2026-08-01T10:00:00Z",
  },
  {
    userClinicId: "nurse-membership",
    userId: "nurse-user",
    clinicId: "clinic-1",
    displayName: "Beatriz Lima",
    status: "Active",
    role: "Nurse",
    isAdmin: false,
    isOwner: false,
    email: "bia@centro.test",
    phone: "+5511977776666",
    emailConfirmedAtUtc: null,
    phoneConfirmedAtUtc: "2026-08-02T10:00:00Z",
    doctorProfile: null,
    defaultAppointmentDurationSource: null,
    sessionVersion: 1,
    createdAtUtc: "2026-08-02T10:00:00Z",
    updatedAtUtc: "2026-08-02T10:00:00Z",
  },
];

const statusCases: Array<
  [ClinicMembershipInvitationStatus, string, string]
> = [
  ["Queued", "Envio aguardando", "Expira em"],
  ["Sent", "Convite enviado", "Expira em"],
  ["Retrying", "Nova tentativa agendada", "Expira em"],
  ["Failed", "Falha na entrega", "Expira em"],
  ["Expired", "Convite expirado", "Expirou em"],
  ["Cancelled", "Convite cancelado", "Validade até"],
  ["Accepted", "Convite aceito", "Validade até"],
];

function invitedDoctor(
  invitationStatus: ClinicMembershipInvitationStatus = "Queued",
  overrides: Partial<ClinicMember> = {},
): ClinicMember {
  return {
    ...members[1],
    userClinicId: "doctor-membership",
    userId: "doctor-user",
    displayName: "Dra. Helena Martins",
    status: "Pending",
    role: "Doctor",
    phone: "+5511999998888",
    email: "helena@centro.test",
    emailConfirmedAtUtc: null,
    phoneConfirmedAtUtc: null,
    invitation: {
      status: invitationStatus,
      destinationMasked: "he***@centro.test",
      attemptNumber: 2,
      issuedAtUtc: "2026-08-29T12:00:00Z",
      expiresAtUtc: "2026-08-30T12:00:00Z",
      retryAtUtc:
        invitationStatus === "Retrying" ? "2026-08-29T12:05:00Z" : null,
      publicReference: "raw-secret-reference",
      providerResponse: "provider-internal-message",
    } as ClinicMember["invitation"],
    ...overrides,
  };
}

let requestMock = vi.fn();
let currentSession = session;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    session: currentSession,
    request: requestMock,
    refreshSession: vi.fn(),
  }),
}));

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // O editor mora na URL; cada teste começa na listagem.
  window.history.replaceState({}, "", "/app/equipe");
  currentSession = session;
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/clinic-1/members") return members;
    throw new Error(`Rota inesperada: ${path}`);
  });
});

test("lista vínculos com um papel, administração, status e confirmação de contatos", async () => {
  render(<Harness><TeamPage /></Harness>);

  expect(await screen.findByRole("heading", { name: "Equipe" })).toBeVisible();
  const ownerRow = screen.getByRole("listitem", { name: /Ana Martins/ });
  expect(within(ownerRow).getByText("Médico")).toBeVisible();
  expect(within(ownerRow).getByText("Administração")).toBeVisible();
  expect(within(ownerRow).getByText("Proprietária")).toBeVisible();
  expect(within(ownerRow).getByText("Ativo")).toBeVisible();
  expect(within(ownerRow).getByText("E-mail confirmado")).toBeVisible();

  const nurseRow = screen.getByRole("listitem", { name: /Beatriz Lima/ });
  expect(within(nurseRow).getByText("Enfermagem")).toBeVisible();
  expect(within(nurseRow).queryByText("Administração")).not.toBeInTheDocument();
  expect(within(nurseRow).getByText("Telefone confirmado")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith("/clinics/clinic-1/members");
});

test("bloqueia suspensão e remoção administrativa do proprietário", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Ana Martins" }));

  expect(screen.getByRole("checkbox", { name: /Administrador da clínica/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Suspender vínculo" })).toBeDisabled();
  expect(screen.getByText(/O proprietário precisa permanecer ativo e administrador/i)).toBeVisible();
});

test("envia atualização e transição de status pelos endpoints do membership", async () => {
  const user = userEvent.setup();
  const calls: Array<{ path: string; body?: unknown }> = [];
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (!init) return members;
    calls.push({ path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return path.endsWith("/status")
      ? { ...members[1], status: "Suspended" }
      : { ...members[1], isAdmin: true };
  });
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Beatriz Lima" }));
  await user.click(screen.getByRole("checkbox", { name: /Administrador da clínica/ }));
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));

  await waitFor(() => expect(calls[0]?.path).toBe("/clinics/clinic-1/members/nurse-membership"));
  expect(calls[0].body).toMatchObject({ role: "Nurse", isAdmin: true });
  expect(calls[0].body).not.toHaveProperty("roles");

  await user.click(screen.getByRole("button", { name: "Suspender vínculo" }));
  await waitFor(() => expect(calls[1]).toEqual({
    path: "/clinics/clinic-1/members/nurse-membership/status",
    body: { status: "Suspended", reason: "Suspensão administrativa pela gestão de equipe" },
  }));
});

test("mostra o erro seguro da API sem descartar o formulário", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async (_path: string, init?: RequestInit) => {
    if (!init) return members;
    throw new ApiError("A alteração deve preservar ao menos um contato confirmado no vínculo ativo.", 400);
  });
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Beatriz Lima" }));
  await user.click(screen.getByRole("checkbox", { name: /Administrador da clínica/ }));
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/preservar ao menos um contato confirmado/i);
  expect(screen.getByRole("heading", { name: "Editar vínculo" })).toBeVisible();
});

test.each(statusCases)(
  "mostra o estado seguro %s com destino mascarado e validade",
  async (status, label, timingLabel) => {
    const member = invitedDoctor(status, {
      status: status === "Accepted" ? "Active" : "Pending",
    });
    requestMock = vi.fn(async () => [member]);

    render(<Harness><TeamPage /></Harness>);

    const row = await screen.findByRole("listitem", {
      name: "Dra. Helena Martins",
    });
    expect(within(row).getByText(label)).toBeVisible();
    expect(within(row).getByText("he***@centro.test")).toBeVisible();
    expect(within(row).getByText(new RegExp(timingLabel))).toHaveTextContent(
      "30 de agosto de 2026",
    );
    expect(screen.queryByText("raw-secret-reference")).not.toBeInTheDocument();
    expect(
      screen.queryByText("provider-internal-message"),
    ).not.toBeInTheDocument();
  },
);

test("reenvia o convite pelo endpoint e atualiza a projeção da lista", async () => {
  const user = userEvent.setup();
  let member = invitedDoctor("Failed");
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith("/invitation/reissue")) {
      expect(init?.method).toBe("POST");
      member = invitedDoctor("Queued", {
        invitation: {
          ...member.invitation!,
          status: "Queued",
          attemptNumber: 3,
        },
      });
      return member.invitation;
    }
    return [member];
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Reenviar convite" }),
  );

  expect(
    await screen.findByText("Novo convite enfileirado para envio."),
  ).toBeVisible();
  expect(await screen.findByText("Envio aguardando")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith(
    "/clinics/clinic-1/members/doctor-membership/invitation/reissue",
    { method: "POST" },
  );
  await waitFor(() =>
    expect(
      requestMock.mock.calls.filter(
        ([path]) => path === "/clinics/clinic-1/members",
      ),
    ).toHaveLength(2),
  );
});

test("respeita Retry-After e bloqueia novo reenvio durante o cooldown", async () => {
  const user = userEvent.setup();
  const member = invitedDoctor("Sent");
  requestMock = vi.fn(async (path: string) => {
    if (path.endsWith("/invitation/reissue")) {
      throw new ApiError("rate_limited", 429, undefined, 12);
    }
    return [member];
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Reenviar convite" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Aguarde 12 segundos antes de reenviar.",
  );
  expect(
    screen.getByRole("button", { name: "Reenviar em 12s" }),
  ).toBeDisabled();
  expect(screen.queryByText("rate_limited")).not.toBeInTheDocument();
});

test("exige confirmação para cancelar e mantém o vínculo pendente", async () => {
  const user = userEvent.setup();
  let member = invitedDoctor("Sent");
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith("/invitation") && init?.method === "DELETE") {
      member = invitedDoctor("Cancelled");
      return undefined;
    }
    return [member];
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Cancelar convite" }),
  );
  const confirmation = screen.getByRole("alertdialog", {
    name: "Cancelar convite de Dra. Helena Martins?",
  });
  expect(within(confirmation).getByText(/vínculo continuará pendente/i)).toBeVisible();
  expect(
    requestMock.mock.calls.some(([, init]) => init?.method === "DELETE"),
  ).toBe(false);

  await user.click(
    within(confirmation).getByRole("button", {
      name: "Confirmar cancelamento",
    }),
  );

  expect(await screen.findByText("Convite cancelado.")).toBeVisible();
  const row = screen.getByRole("listitem", { name: "Dra. Helena Martins" });
  expect(within(row).getByText("Pendente")).toBeVisible();
  expect(within(row).getByText("Convite cancelado")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith(
    "/clinics/clinic-1/members/doctor-membership/invitation",
    { method: "DELETE" },
  );
});

test("permite desistir do cancelamento sem chamar a API", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async () => [invitedDoctor("Sent")]);
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Cancelar convite" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Manter convite" }),
  );

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    requestMock.mock.calls.some(([, init]) => init?.method === "DELETE"),
  ).toBe(false);
});

test("explica a invalidação e o reenvio explícito ao editar e-mail pendente", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async (path: string) => {
    if (path === "/clinics/clinic-1/members") return [invitedDoctor("Sent")];
    throw new Error(`Rota inesperada: ${path}`);
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", {
      name: "Editar vínculo de Dra. Helena Martins",
    }),
  );

  expect(
    screen.getByText(/o convite atual será invalidado/i),
  ).toHaveTextContent(/depois de salvar, use Reenviar convite/i);
});

test("oculta ações de convite de usuário sem capacidade administrativa", async () => {
  currentSession = { ...session, isAdmin: false, roles: ["Doctor"] };
  requestMock = vi.fn(async () => [invitedDoctor("Sent")]);
  render(<Harness><TeamPage /></Harness>);

  await screen.findByRole("listitem", { name: "Dra. Helena Martins" });
  expect(
    screen.queryByRole("button", { name: "Reenviar convite" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancelar convite" }),
  ).not.toBeInTheDocument();
});

test("oculta ações de convite para proprietário mesmo quando pendente", async () => {
  requestMock = vi.fn(async () => [
    invitedDoctor("Sent", { isOwner: true }),
  ]);
  render(<Harness><TeamPage /></Harness>);

  await screen.findByRole("listitem", { name: "Dra. Helena Martins" });
  expect(
    screen.queryByRole("button", { name: "Reenviar convite" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancelar convite" }),
  ).not.toBeInTheDocument();
});

test("oculta ações de convite para vínculo não pendente", async () => {
  requestMock = vi.fn(async () => [
    invitedDoctor("Accepted", { status: "Active" }),
  ]);
  render(<Harness><TeamPage /></Harness>);

  expect(await screen.findByText("Convite aceito")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reenviar convite" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancelar convite" }),
  ).not.toBeInTheDocument();
});

test("mostra erro seguro de reenvio e preserva as ações", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async (path: string) => {
    if (path.endsWith("/invitation/reissue")) {
      throw new ApiError("resend-api-key=secret", 500);
    }
    return [invitedDoctor("Failed")];
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Reenviar convite" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível reenviar o convite.",
  );
  expect(screen.queryByText(/resend-api-key/i)).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reenviar convite" }),
  ).toBeEnabled();
});

test("mostra erro seguro quando o cancelamento falha", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith("/invitation") && init?.method === "DELETE") {
      throw new ApiError("challenge-id=secret", 500);
    }
    return [invitedDoctor("Sent")];
  });
  render(<Harness><TeamPage /></Harness>);

  await user.click(
    await screen.findByRole("button", { name: "Cancelar convite" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirmar cancelamento" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível cancelar o convite.",
  );
  expect(screen.queryByText(/challenge-id/i)).not.toBeInTheDocument();
  expect(screen.getByRole("alertdialog")).toBeVisible();
});

test("cadastro ocupa a tela sozinho, sem listagem nem botão de novo integrante", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));

  expect(screen.getByRole("heading", { name: "Adicionar integrante" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Novo integrante" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pessoas da clínica" })).not.toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: /Ana Martins/ })).not.toBeInTheDocument();
  expect(window.location.search).toBe("?vinculo=novo");
});

test("link Equipe devolve a listagem durante um cadastro sem alterações", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));
  await user.click(screen.getByRole("link", { name: "Equipe" }));

  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Adicionar integrante" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("cancelar sem alterações volta direto para a listagem", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Beatriz Lima" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
});

test("cancelar com dados preenchidos pede confirmação antes de descartar", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));
  await user.type(screen.getByLabelText("Nome completo"), "Joana Ribeiro");
  await user.click(screen.getByRole("button", { name: "Cancelar" }));

  const dialog = screen.getByRole("dialog", { name: "Descartar alterações?" });
  await user.click(within(dialog).getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Nome completo")).toHaveValue("Joana Ribeiro");

  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Descartar alterações" }),
  );
  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("sair pelo link com dados preenchidos também pede confirmação", async () => {
  const user = userEvent.setup();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));
  await user.type(screen.getByLabelText("Nome completo"), "Joana Ribeiro");
  await user.click(screen.getByRole("link", { name: "Equipe" }));

  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Adicionar integrante" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
});

test("depois de salvar, o formulário deixa de pedir confirmação", async () => {
  const user = userEvent.setup();
  requestMock = vi.fn(async (_path: string, init?: RequestInit) =>
    init ? { ...members[1], isAdmin: true } : members,
  );
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Beatriz Lima" }));
  await user.click(screen.getByRole("checkbox", { name: /Administrador da clínica/ }));
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  expect(await screen.findByText("Vínculo atualizado.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
});

const ownerSchedule: DoctorSchedule = {
  doctorUserId: "owner-user",
  slotDurationMinutes: 30,
  blocks: [],
  intervals: [
    { id: "interval-1", dayOfWeek: "Monday", startLocal: "08:00:00", endLocal: "12:00:00" },
  ],
};

const planCatalog = [
  { id: "plan-unimed", name: "Unimed" },
  { id: "plan-amil", name: "Amil" },
];
const ownerPlans: UserClinicHealthcarePlans = {
  userClinicId: "owner-membership",
  mode: "ClinicDefault",
  healthcarePlanIds: ["plan-unimed"],
};

/**
 * API da equipe com a agenda e os convênios da médica proprietária; guarda as gravações
 * na ordem. A clínica aceita Unimed e Amil, e só Unimed é padrão.
 */
function mockTeamWithSchedule(
  options: {
    scheduleSave?: () => DoctorSchedule;
    plansSave?: () => UserClinicHealthcarePlans;
  } = {},
) {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (!init) {
      if (path === "/clinics/clinic-1/members") return members;
      if (path === "/doctors/owner-user/schedule") return ownerSchedule;
      if (path === "/healthcare-plans") return planCatalog;
      if (path === "/clinics/current/healthcare-plans") {
        return {
          healthcarePlanIds: ["plan-unimed", "plan-amil"],
          defaultHealthcarePlanIds: ["plan-unimed"],
        };
      }
      if (path === "/clinics/clinic-1/members/owner-membership/healthcare-plans") {
        return ownerPlans;
      }
      throw new Error(`Rota inesperada: ${path}`);
    }
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    writes.push({ method: init.method ?? "GET", path, body });
    if (path === "/clinics/clinic-1/members") {
      return { userId: "new-user", userClinicId: "new-membership" };
    }
    if (path.endsWith("/schedule")) {
      return options.scheduleSave
        ? options.scheduleSave()
        : { ...ownerSchedule, intervals: [] };
    }
    if (path.endsWith("/healthcare-plans")) {
      return options.plansSave
        ? options.plansSave()
        : {
            userClinicId: path.split("/")[4],
            mode: body.mode,
            healthcarePlanIds: body.healthcarePlanIds,
          };
    }
    return members[0];
  });
  return writes;
}

test("cadastra o médico e grava a disponibilidade no usuário recém-criado", async () => {
  const user = userEvent.setup();
  const writes = mockTeamWithSchedule();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));

  await user.type(screen.getByLabelText("Nome completo"), "Rui Antunes");
  await user.type(screen.getByLabelText("Documento"), "12345678901");
  await user.type(screen.getByLabelText("E-mail na clínica"), "rui@centro.test");
  await user.type(screen.getByLabelText("Telefone"), "11999998888");
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "40");
  expect(
    screen.getByText(/Os horários passam a ser oferecidos na agenda quando o convite for aceito/i),
  ).toBeVisible();
  await user.click(screen.getByRole("checkbox", { name: /Quarta-feira/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));

  expect(await screen.findByText(/convite foi enfileirado/i)).toBeVisible();
  expect(writes.map((write) => `${write.method} ${write.path}`)).toEqual([
    "POST /clinics/clinic-1/members",
    "PUT /doctors/new-user/schedule",
  ]);
  expect(writes[1].body).toEqual({
    defaultAppointmentDurationMinutes: 40,
    intervals: [{ dayOfWeek: "Wednesday", startLocal: "08:00", endLocal: "12:00" }],
  });
});

test("cadastra o médico e grava os convênios no vínculo recém-criado", async () => {
  const user = userEvent.setup();
  const writes = mockTeamWithSchedule();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));

  await user.type(screen.getByLabelText("Nome completo"), "Rui Antunes");
  await user.type(screen.getByLabelText("Documento"), "12345678901");
  await user.type(screen.getByLabelText("E-mail na clínica"), "rui@centro.test");
  await user.type(screen.getByLabelText("Telefone"), "11999998888");
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "30");
  await user.click(await screen.findByRole("radio", { name: /Personalizado/ }));
  // Em personalizado o rótulo do convênio padrão ganha "(padrão da clínica)".
  await user.click(screen.getByRole("checkbox", { name: /Unimed/ }));
  await user.click(screen.getByRole("checkbox", { name: "Amil" }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));

  expect(await screen.findByText(/convite foi enfileirado/i)).toBeVisible();
  expect(writes.map((write) => `${write.method} ${write.path}`)).toEqual([
    "POST /clinics/clinic-1/members",
    "PUT /clinics/clinic-1/members/new-membership/healthcare-plans",
  ]);
  // Personalizar parte do padrão (Unimed); a escolha final ficou só com Amil.
  expect(writes[1].body).toEqual({ mode: "Custom", healthcarePlanIds: ["plan-amil"] });
});

test("perfil do médico abre com a identidade no cabeçalho e uma aba por rota", async () => {
  const user = userEvent.setup();
  mockTeamWithSchedule();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Ana Martins" }));

  expect(window.location.pathname).toBe("/app/equipe/owner-membership");
  expect(screen.getByRole("heading", { level: 1, name: "Ana Martins" })).toBeVisible();
  expect(screen.getByText("ana@centro.test · +5511988887777")).toBeVisible();
  const tabs = within(screen.getByRole("navigation", { name: "Seções do perfil" }));
  expect(tabs.getByRole("link", { name: "Vínculo" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: "Editar vínculo" })).toBeVisible();
  // A semana e os convênios saíram do formulário do vínculo.
  expect(
    screen.queryByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).not.toBeInTheDocument();

  await user.click(tabs.getByRole("link", { name: "Disponibilidade" }));
  expect(window.location.pathname).toBe("/app/equipe/owner-membership/disponibilidade");
  expect(
    await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Editar vínculo" })).not.toBeInTheDocument();

  await user.click(tabs.getByRole("link", { name: "Convênios" }));
  expect(window.location.pathname).toBe("/app/equipe/owner-membership/convenios");
  expect(await screen.findByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
});

test("aba Disponibilidade salva só a semana e a aba Vínculo grava a duração nova", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/app/equipe/owner-membership/disponibilidade");
  const writes = mockTeamWithSchedule({
    scheduleSave: () => ({ ...ownerSchedule, slotDurationMinutes: 45 }),
  });
  render(<Harness><TeamPage /></Harness>);

  expect(await screen.findByLabelText("Segunda-feira, período 1, início")).toHaveValue("08:00");
  await user.click(screen.getByRole("checkbox", { name: /Terça-feira/ }));
  await user.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

  expect(await screen.findByText("Disponibilidade atualizada.")).toBeVisible();
  expect(writes.map((write) => `${write.method} ${write.path}`)).toEqual([
    "PUT /doctors/owner-user/schedule",
  ]);
  expect(writes[0].body).toEqual({
    defaultAppointmentDurationMinutes: 30,
    intervals: [
      { dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" },
      { dayOfWeek: "Tuesday", startLocal: "08:00", endLocal: "12:00" },
    ],
  });

  // A duração salva com a semana é a do vínculo: salvar o vínculo não volta a 30.
  const tabs = within(screen.getByRole("navigation", { name: "Seções do perfil" }));
  await user.click(tabs.getByRole("link", { name: "Vínculo" }));
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  expect(await screen.findByText("Vínculo atualizado.")).toBeVisible();
  expect(writes[1].path).toBe("/clinics/clinic-1/members/owner-membership");
  expect(writes[1].body).toMatchObject({
    doctorProfile: { defaultAppointmentDurationMinutes: 45 },
  });
});

test("aba Convênios salva só os convênios do médico", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/app/equipe/owner-membership/convenios");
  const writes = mockTeamWithSchedule();
  render(<Harness><TeamPage /></Harness>);

  expect(await screen.findByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
  const group = screen.getByRole("group", { name: "Convênios atendidos por Ana Martins" });
  expect(within(group).getByRole("checkbox", { name: "Unimed" })).toBeChecked();

  await user.click(screen.getByRole("radio", { name: /Personalizado/ }));
  await user.click(screen.getByRole("checkbox", { name: "Amil" }));
  await user.click(screen.getByRole("button", { name: "Salvar convênios" }));

  expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
  expect(writes.map((write) => `${write.method} ${write.path}`)).toEqual([
    "PUT /clinics/clinic-1/members/owner-membership/healthcare-plans",
  ]);
  expect(writes[0].body).toEqual({
    mode: "Custom",
    healthcarePlanIds: ["plan-unimed", "plan-amil"],
  });
});

test("trocar de aba com o vínculo alterado pede confirmação antes de descartar", async () => {
  const user = userEvent.setup();
  mockTeamWithSchedule();
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Ana Martins" }));
  await user.type(screen.getByLabelText("Áreas de atuação"), "Endoscopia");

  const tabs = within(screen.getByRole("navigation", { name: "Seções do perfil" }));
  await user.click(tabs.getByRole("link", { name: "Disponibilidade" }));

  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeVisible();
  expect(window.location.pathname).toBe("/app/equipe/owner-membership");
  await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByLabelText("Áreas de atuação")).toHaveValue("Endoscopia");
});

test("quem não é médico não tem abas e volta ao vínculo ao abrir a disponibilidade", async () => {
  window.history.replaceState({}, "", "/app/equipe/nurse-membership/disponibilidade");
  render(<Harness><TeamPage /></Harness>);

  expect(await screen.findByRole("heading", { name: "Editar vínculo" })).toBeVisible();
  expect(window.location.pathname).toBe("/app/equipe/nurse-membership");
  expect(screen.getByRole("heading", { level: 1, name: "Beatriz Lima" })).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Seções do perfil" })).not.toBeInTheDocument();
  expect(
    requestMock.mock.calls.some(([path]) => String(path).includes("/schedule")),
  ).toBe(false);
});

test("o link antigo do editor leva ao perfil e um vínculo inexistente volta à lista", async () => {
  window.history.replaceState({}, "", "/app/equipe?vinculo=owner-membership");
  const { unmount } = render(<Harness><TeamPage /></Harness>);
  await waitFor(() =>
    expect(window.location.pathname).toBe("/app/equipe/owner-membership"),
  );
  expect(window.location.search).toBe("");
  expect(await screen.findByRole("heading", { level: 1, name: "Ana Martins" })).toBeVisible();
  unmount();

  window.history.replaceState({}, "", "/app/equipe/vinculo-de-outra-clinica");
  render(<Harness><TeamPage /></Harness>);
  expect(await screen.findByRole("heading", { name: "Pessoas da clínica" })).toBeVisible();
  expect(window.location.pathname).toBe("/app/equipe");
});

test("promover a médico avisa que disponibilidade e convênios ficam nas abas", async () => {
  const user = userEvent.setup();
  const promoted: ClinicMember = {
    ...members[1],
    role: "Doctor",
    doctorProfile: { ...members[0].doctorProfile!, defaultAppointmentDurationMinutes: 40 },
  };
  // Depois de salvar, a lista que volta da API já traz o vínculo de médico.
  let saved = false;
  requestMock = vi.fn(async (_path: string, init?: RequestInit) => {
    if (!init) return saved ? [members[0], promoted] : members;
    saved = true;
    return promoted;
  });
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Editar vínculo de Beatriz Lima" }));
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "40");
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));

  expect(
    await screen.findByText(
      "Vínculo atualizado. Defina a disponibilidade e os convênios nas abas do perfil.",
    ),
  ).toBeVisible();
  const tabs = within(screen.getByRole("navigation", { name: "Seções do perfil" }));
  expect(tabs.getByRole("link", { name: "Disponibilidade" })).toHaveAttribute(
    "href",
    "/app/equipe/nurse-membership/disponibilidade",
  );
});

test("cadastro com horários que falham abre a aba Disponibilidade do novo médico", async () => {
  const user = userEvent.setup();
  const created: ClinicMember = {
    ...invitedDoctor("Queued"),
    userClinicId: "new-membership",
    userId: "new-user",
    displayName: "Rui Antunes",
  };
  let createdYet = false;
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (!init) {
      if (path === "/clinics/clinic-1/members") {
        return createdYet ? [...members, created] : members;
      }
      if (path === "/doctors/new-user/schedule") {
        return { ...ownerSchedule, doctorUserId: "new-user", intervals: [] };
      }
      if (path === "/healthcare-plans") return planCatalog;
      if (path === "/clinics/current/healthcare-plans") {
        return { healthcarePlanIds: ["plan-unimed"], defaultHealthcarePlanIds: ["plan-unimed"] };
      }
      throw new Error(`Rota inesperada: ${path}`);
    }
    if (path === "/clinics/clinic-1/members") {
      createdYet = true;
      return { userId: "new-user", userClinicId: "new-membership" };
    }
    throw new ApiError("Os intervalos de um mesmo dia não podem se sobrepor.", 400);
  });
  render(<Harness><TeamPage /></Harness>);
  await user.click(await screen.findByRole("button", { name: "Novo integrante" }));

  await user.type(screen.getByLabelText("Nome completo"), "Rui Antunes");
  await user.type(screen.getByLabelText("Documento"), "12345678901");
  await user.type(screen.getByLabelText("E-mail na clínica"), "rui@centro.test");
  await user.type(screen.getByLabelText("Telefone"), "11999998888");
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "30");
  await user.click(screen.getByRole("checkbox", { name: /Quarta-feira/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));

  await waitFor(() =>
    expect(window.location.pathname).toBe("/app/equipe/new-membership/disponibilidade"),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Integrante adicionado e convite enfileirado, mas os horários não foram salvos. Os intervalos de um mesmo dia não podem se sobrepor. Defina a disponibilidade nas abas do perfil e salve novamente.",
  );
  expect(screen.getByRole("heading", { level: 1, name: "Rui Antunes" })).toBeVisible();
  expect(
    await screen.findByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).toBeVisible();
});
