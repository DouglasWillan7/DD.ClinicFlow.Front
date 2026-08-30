import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type {
  AuthResponse,
  ClinicMember,
  ClinicMembershipInvitationStatus,
} from "../../api/types";
import { ApiError } from "../../api/client";
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
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
  requestMock = vi.fn(async () => [invitedDoctor("Sent")]);
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
