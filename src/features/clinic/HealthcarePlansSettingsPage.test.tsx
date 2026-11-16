import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AuthResponse,
  ClinicHealthcarePlansImpact,
  HealthcarePlan,
  HealthcarePlanMode,
  Member,
} from "../../api/types";
import { HealthcarePlansSettingsPage } from "./HealthcarePlansSettingsPage";

const clinicId = "11111111-1111-1111-1111-111111111111";
const clinicPath = "/clinics/current/healthcare-plans";
const impactPath = `${clinicPath}/impact`;
const doctorPath = (userClinicId: string) =>
  `/clinics/${clinicId}/members/${userClinicId}/healthcare-plans`;

const catalog: HealthcarePlan[] = [
  { id: "plan-amil", name: "Amil" },
  { id: "plan-bradesco", name: "Bradesco Saúde" },
  { id: "plan-unimed", name: "Unimed" },
];

const members: Member[] = [
  {
    userClinicId: "membership-1",
    userId: "user-1",
    displayName: "Dra. Marina Lopes",
    role: "Doctor",
    isAdmin: true,
    specialty: "Cardiologia",
    defaultAppointmentDurationMinutes: 30,
    healthcarePlanMode: "Custom",
    effectiveHealthcarePlanCount: 1,
  },
  {
    userClinicId: "membership-2",
    userId: "user-2",
    displayName: "Dr. André Costa",
    role: "Doctor",
    isAdmin: false,
    specialty: "Clínica médica",
    defaultAppointmentDurationMinutes: 45,
    healthcarePlanMode: "ClinicDefault",
    effectiveHealthcarePlanCount: 1,
  },
  {
    userClinicId: "membership-3",
    userId: "user-3",
    displayName: "Enf. Beatriz Lima",
    role: "Nurse",
    isAdmin: false,
    specialty: null,
    defaultAppointmentDurationMinutes: null,
  },
];

function doctorSession(isAdmin: boolean): AuthResponse {
  return {
    userId: "user-1",
    name: "Dra. Marina Lopes",
    email: "marina@example.test",
    phone: "+5511999999999",
    clinicId,
    clinicName: "Clínica Horizonte",
    userClinicId: "membership-1",
    clinicRole: "Doctor",
    isAdmin,
    roles: isAdmin ? ["Doctor", "Admin"] : ["Doctor"],
    availableClinics: [],
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresAtUtc: "2026-08-25T20:00:00Z",
    },
  };
}

let session: AuthResponse;
let requestMock = vi.fn();
let clinicPlanIds: string[];
let clinicDefaultIds: string[];
let doctorPlans: Record<string, { mode: HealthcarePlanMode; ids: string[] }>;
let impact: ClinicHealthcarePlansImpact;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ session, request: requestMock }),
}));

function Harness({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPage() {
  return render(
    <Harness>
      <HealthcarePlansSettingsPage />
    </Harness>,
  );
}

function putCalls(path: string) {
  return requestMock.mock.calls.filter(
    ([calledPath, init]) => calledPath === path && init?.method === "PUT",
  );
}

/** Lista efetiva, como o backend devolve: o padrão da clínica ou a lista própria. */
function effectiveIds(userClinicId: string) {
  const doctor = doctorPlans[userClinicId];
  return doctor.mode === "Custom" ? doctor.ids : clinicDefaultIds;
}

beforeEach(() => {
  session = doctorSession(true);
  clinicPlanIds = ["plan-amil", "plan-unimed"];
  clinicDefaultIds = ["plan-amil"];
  doctorPlans = {
    "membership-1": { mode: "Custom", ids: ["plan-unimed"] },
    "membership-2": { mode: "ClinicDefault", ids: [] },
  };
  impact = { removals: [] };
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body
      ? (JSON.parse(String(init.body)) as {
          mode?: HealthcarePlanMode;
          healthcarePlanIds: string[];
          defaultHealthcarePlanIds?: string[];
        })
      : undefined;
    if (path === "/healthcare-plans") return catalog;
    if (path === `/clinics/${clinicId}/members/summary`) return members;
    if (path === impactPath) return impact;
    if (path === clinicPath) {
      if (init?.method === "PUT") {
        clinicPlanIds = body!.healthcarePlanIds;
        clinicDefaultIds = body!.defaultHealthcarePlanIds!;
        // O backend retira das listas próprias o que a clínica deixou de aceitar.
        for (const doctor of Object.values(doctorPlans)) {
          doctor.ids = doctor.ids.filter((id) => clinicPlanIds.includes(id));
        }
      }
      return {
        healthcarePlanIds: clinicPlanIds,
        defaultHealthcarePlanIds: clinicDefaultIds,
      };
    }
    for (const userClinicId of Object.keys(doctorPlans)) {
      if (path !== doctorPath(userClinicId)) continue;
      if (init?.method === "PUT") {
        doctorPlans[userClinicId] = {
          mode: body!.mode!,
          ids: body!.mode === "Custom" ? body!.healthcarePlanIds : [],
        };
      }
      return {
        userClinicId,
        mode: doctorPlans[userClinicId].mode,
        healthcarePlanIds: effectiveIds(userClinicId),
      };
    }
    throw new Error(`Rota inesperada: ${path}`);
  });
});

describe("HealthcarePlansSettingsPage", () => {
  test("administrador marca convênios aceitos e padrão e salva as duas listas", async () => {
    const user = userEvent.setup();
    renderPage();

    const clinicGroup = await screen.findByRole("group", {
      name: "Convênios aceitos pela clínica",
    });
    expect(within(clinicGroup).getByLabelText("Amil")).toBeChecked();
    expect(within(clinicGroup).getByLabelText("Amil no padrão da clínica")).toBeChecked();
    expect(
      within(clinicGroup).getByLabelText("Unimed no padrão da clínica"),
    ).not.toBeChecked();
    // Só um convênio aceito pode entrar no padrão.
    expect(
      within(clinicGroup).getByLabelText("Bradesco Saúde no padrão da clínica"),
    ).toBeDisabled();
    const save = screen.getByRole("button", { name: "Salvar convênios da clínica" });
    expect(save).toBeDisabled();

    await user.click(within(clinicGroup).getByLabelText("Bradesco Saúde"));
    await user.click(
      within(clinicGroup).getByLabelText("Bradesco Saúde no padrão da clínica"),
    );
    await user.click(save);

    expect(await screen.findByText("Convênios da clínica atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-amil", "plan-unimed", "plan-bradesco"]);
    expect(clinicDefaultIds).toEqual(["plan-amil", "plan-bradesco"]);
  });

  test("desmarcar um convênio aceito também o tira do padrão", async () => {
    const user = userEvent.setup();
    renderPage();

    const clinicGroup = await screen.findByRole("group", {
      name: "Convênios aceitos pela clínica",
    });
    await user.click(within(clinicGroup).getByLabelText("Amil"));

    const amilDefault = within(clinicGroup).getByLabelText("Amil no padrão da clínica");
    expect(amilDefault).not.toBeChecked();
    expect(amilDefault).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Salvar convênios da clínica" }));

    expect(await screen.findByText("Convênios da clínica atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-unimed"]);
    expect(clinicDefaultIds).toEqual([]);
  });

  test("mostra quem perde cada convênio e só grava depois da confirmação", async () => {
    const user = userEvent.setup();
    impact = {
      removals: [
        {
          healthcarePlanId: "plan-unimed",
          doctors: [
            {
              userClinicId: "membership-1",
              displayName: "Dra. Marina Lopes",
              mode: "Custom",
            },
          ],
        },
      ],
    };
    renderPage();

    const clinicGroup = await screen.findByRole("group", {
      name: "Convênios aceitos pela clínica",
    });
    await user.click(within(clinicGroup).getByLabelText("Unimed"));
    await user.click(screen.getByRole("button", { name: "Salvar convênios da clínica" }));

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("Esta mudança tira convênios de médicos");
    expect(warning).toHaveTextContent("Unimed: Dra. Marina Lopes");
    expect(putCalls(clinicPath)).toHaveLength(0);
    expect(requestMock).toHaveBeenCalledWith(
      impactPath,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          healthcarePlanIds: ["plan-amil"],
          defaultHealthcarePlanIds: ["plan-amil"],
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar mesmo assim" }));

    expect(await screen.findByText("Convênios da clínica atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-amil"]);
    expect(screen.queryByText("Esta mudança tira convênios de médicos")).not.toBeInTheDocument();
  });

  test("voltar do aviso de impacto não grava nada", async () => {
    const user = userEvent.setup();
    impact = {
      removals: [
        {
          healthcarePlanId: "plan-unimed",
          doctors: [
            {
              userClinicId: "membership-1",
              displayName: "Dra. Marina Lopes",
              mode: "Custom",
            },
          ],
        },
      ],
    };
    renderPage();

    const clinicGroup = await screen.findByRole("group", {
      name: "Convênios aceitos pela clínica",
    });
    await user.click(within(clinicGroup).getByLabelText("Unimed"));
    await user.click(screen.getByRole("button", { name: "Salvar convênios da clínica" }));
    await user.click(await screen.findByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(putCalls(clinicPath)).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Salvar convênios da clínica" }),
    ).toBeEnabled();
  });

  test("médico personalizado escolhe só entre os convênios aceitos pela clínica", async () => {
    const user = userEvent.setup();
    renderPage();

    const doctorGroup = await screen.findByRole("group", {
      name: "Convênios atendidos por Dra. Marina Lopes",
    });
    expect(screen.getByRole("radio", { name: /Personalizado/ })).toBeChecked();
    expect(within(doctorGroup).getByLabelText("Unimed")).toBeChecked();
    expect(within(doctorGroup).getByLabelText("Amil")).not.toBeChecked();
    expect(within(doctorGroup).queryByLabelText("Bradesco Saúde")).not.toBeInTheDocument();

    await user.click(within(doctorGroup).getByLabelText("Amil"));
    await user.click(screen.getByRole("button", { name: "Salvar convênios do médico" }));

    expect(await screen.findByText("Convênios do médico atualizados.")).toBeVisible();
    expect(doctorPlans["membership-1"]).toEqual({
      mode: "Custom",
      ids: ["plan-unimed", "plan-amil"],
    });
  });

  test("voltar ao padrão da clínica mostra os convênios herdados e não envia lista", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("radio", { name: /Padrão da clínica/ }));

    expect(
      screen.queryByRole("group", { name: "Convênios atendidos por Dra. Marina Lopes" }),
    ).not.toBeInTheDocument();
    const inherited = screen.getByRole("heading", { name: "Convênios padrão da clínica" })
      .parentElement!;
    expect(within(inherited).getByText("Amil")).toBeVisible();
    expect(within(inherited).queryByText("Unimed")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar convênios do médico" }));

    expect(await screen.findByText("Convênios do médico atualizados.")).toBeVisible();
    expect(doctorPlans["membership-1"]).toEqual({ mode: "ClinicDefault", ids: [] });
  });

  test("administrador troca de médico e personaliza a partir da lista herdada", async () => {
    const user = userEvent.setup();
    renderPage();

    const select = await screen.findByLabelText("Médico");
    expect(
      within(select).getByRole("option", {
        name: "Dr. André Costa · Padrão da clínica (1 convênio)",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(select, "membership-2");

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Padrão da clínica/ })).toBeChecked(),
    );
    await user.click(screen.getByRole("radio", { name: /Personalizado/ }));

    const doctorGroup = screen.getByRole("group", {
      name: "Convênios atendidos por Dr. André Costa",
    });
    // Parte do que ele atendia pelo padrão.
    expect(within(doctorGroup).getByLabelText("Amil")).toBeChecked();
    expect(within(doctorGroup).getByLabelText("Unimed")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Salvar convênios do médico" }));

    expect(await screen.findByText("Convênios do médico atualizados.")).toBeVisible();
    expect(doctorPlans["membership-2"]).toEqual({ mode: "Custom", ids: ["plan-amil"] });
  });

  test("retirar um convênio da clínica atualiza a lista do médico", async () => {
    const user = userEvent.setup();
    renderPage();

    const clinicGroup = await screen.findByRole("group", {
      name: "Convênios aceitos pela clínica",
    });
    await screen.findByRole("group", {
      name: "Convênios atendidos por Dra. Marina Lopes",
    });
    await user.click(within(clinicGroup).getByLabelText("Unimed"));
    await user.click(screen.getByRole("button", { name: "Salvar convênios da clínica" }));

    await waitFor(() => {
      const doctorGroup = screen.getByRole("group", {
        name: "Convênios atendidos por Dra. Marina Lopes",
      });
      expect(within(doctorGroup).queryByLabelText("Unimed")).not.toBeInTheDocument();
    });
  });

  test("médico sem administração configura apenas os próprios convênios", async () => {
    session = doctorSession(false);
    renderPage();

    expect(
      await screen.findByRole("group", { name: "Convênios que você atende" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Meus convênios" })).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Convênios aceitos pela clínica" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Médico")).not.toBeInTheDocument();
    expect(requestMock).not.toHaveBeenCalledWith(
      `/clinics/${clinicId}/members/summary`,
    );
  });

  test("sem convênios na clínica, orienta em vez de mostrar lista vazia", async () => {
    session = doctorSession(false);
    clinicPlanIds = [];
    clinicDefaultIds = [];
    renderPage();

    expect(
      await screen.findByText(
        "A clínica ainda não aceita convênios. Peça ao administrador para configurá-los.",
      ),
    ).toBeVisible();
  });
});
