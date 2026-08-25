import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AuthResponse, ClinicMember } from "../../api/types";
import { ApiError } from "../../api/client";
import { TeamPage } from "./TeamPage";

const session: AuthResponse = {
  userId: "owner-user",
  name: "Ana Martins",
  email: "ana@centro.test",
  clinicId: "clinic-1",
  clinicName: "Clínica Centro",
  userClinicId: "owner-membership",
  clinicRole: "Doctor",
  isAdmin: true,
  roles: ["Doctor", "Admin"],
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

let requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ session, request: requestMock, refreshSession: vi.fn() }),
}));

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
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
