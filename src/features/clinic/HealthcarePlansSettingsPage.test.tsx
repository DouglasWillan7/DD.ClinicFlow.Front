import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type PropsWithChildren, useState } from "react";
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
    userClinicId: "membership-4",
    userId: "user-4",
    displayName: "Dr. Rafael Souza",
    role: "Doctor",
    isAdmin: false,
    specialty: null,
    defaultAppointmentDurationMinutes: 30,
    healthcarePlanMode: "Custom",
    effectiveHealthcarePlanCount: 0,
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

let initialSearch: string;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ session, request: requestMock }),
}));

// A página guarda o item selecionado na URL; o mock mantém essa busca em estado.
vi.mock("../../app/navigation", () => ({
  useSearchParams: () => {
    const [params, setParams] = useState(() => new URLSearchParams(initialSearch));
    return [
      params,
      (next: URLSearchParams | ((current: URLSearchParams) => URLSearchParams)) =>
        setParams((current) => (typeof next === "function" ? next(current) : next)),
    ];
  },
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
    "membership-4": { mode: "Custom", ids: [] },
  };
  initialSearch = "";
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

const unimedImpact: ClinicHealthcarePlansImpact = {
  removals: [
    {
      healthcarePlanId: "plan-unimed",
      doctors: [
        { userClinicId: "membership-1", displayName: "Dra. Marina Lopes", mode: "Custom" },
      ],
    },
  ],
};

function nav() {
  return screen.findByRole("navigation", { name: "Clínica e médicos" });
}

async function openDoctor(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(within(await nav()).getByRole("button", { name }));
}

const saveButton = () => screen.getByRole("button", { name: "Salvar convênios" });

describe("HealthcarePlansSettingsPage", () => {
  test("lista a clínica e a situação de cada médico", async () => {
    renderPage();

    const list = await nav();
    expect(
      within(list).getByRole("button", { name: /Clínica.*2 aceitos · 1 padrão/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      await within(list).findByRole("button", {
        name: /Dra\. Marina Lopes.*Personalizado · 1 convênio/,
      }),
    ).toBeVisible();
    expect(
      within(list).getByRole("button", { name: /Dr\. André Costa.*Padrão da clínica/ }),
    ).toBeVisible();
    expect(
      within(list).getByRole("button", { name: /Dr\. Rafael Souza.*Só particular/ }),
    ).toBeVisible();
    // Enfermagem não atende convênios e não entra na lista.
    expect(within(list).queryByText("Enf. Beatriz Lima")).not.toBeInTheDocument();
  });

  test("visão da clínica mostra aceitos com contagem, padrão e o resto do catálogo", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Aceitos · 2 de 3" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Amil")).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Amil no padrão da clínica", pressed: true }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Unimed no padrão da clínica", pressed: false }),
    ).toBeVisible();
    // Amil: só quem segue o padrão. Unimed: só a lista própria da Dra. Marina.
    const amilRow = screen.getByLabelText("Amil").closest("li")!;
    expect(await within(amilRow).findByText("1 médico")).toBeVisible();
    const others = screen.getByRole("group", { name: "Outros do catálogo" });
    expect(within(others).getByLabelText("Bradesco Saúde")).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Bradesco Saúde no padrão da clínica" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
  });

  test("alerta quando nenhum médico atende um convênio aceito", async () => {
    clinicPlanIds = ["plan-amil", "plan-unimed", "plan-bradesco"];
    renderPage();

    const row = (await screen.findByLabelText("Bradesco Saúde")).closest("li")!;
    expect(await within(row).findByText("Nenhum médico")).toBeVisible();
  });

  test("aceitar um convênio e marcá-lo como padrão salva as duas listas", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("Bradesco Saúde"));
    await user.click(
      screen.getByRole("button", { name: "Bradesco Saúde no padrão da clínica" }),
    );

    expect(screen.getByRole("heading", { name: "Aceitos · 3 de 3" })).toBeVisible();
    expect(
      within(await nav()).getByRole("button", { name: /Clínica.*Alterações não salvas/ }),
    ).toBeVisible();
    await user.click(saveButton());

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-amil", "plan-unimed", "plan-bradesco"]);
    expect(clinicDefaultIds).toEqual(["plan-amil", "plan-bradesco"]);
    expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
  });

  test("descartar volta ao que está salvo sem chamar a API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Unimed no padrão da clínica" }),
    );
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      screen.getByRole("button", { name: "Unimed no padrão da clínica", pressed: false }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
    expect(putCalls(clinicPath)).toHaveLength(0);
  });

  test("deixar de aceitar um convênio pede confirmação com os médicos afetados", async () => {
    const user = userEvent.setup();
    impact = unimedImpact;
    renderPage();

    await user.click(await screen.findByLabelText("Unimed"));
    await user.click(saveButton());

    const dialog = await screen.findByRole("dialog", {
      name: "Deixar de aceitar Unimed?",
    });
    expect(within(dialog).getByText("Dra. Marina Lopes")).toBeVisible();
    expect(within(dialog).getByText("Personalizado")).toBeVisible();
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

    await user.click(within(dialog).getByRole("button", { name: "Deixar de aceitar" }));

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-amil"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("manter o convênio no diálogo o devolve à lista e não grava", async () => {
    const user = userEvent.setup();
    impact = unimedImpact;
    renderPage();

    await user.click(await screen.findByLabelText("Unimed"));
    await user.click(saveButton());
    await user.click(await screen.findByRole("button", { name: "Manter Unimed" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Unimed")).toBeChecked();
    expect(putCalls(clinicPath)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
  });

  test("tirar o padrão de um convênio confirma só com quem segue o padrão", async () => {
    const user = userEvent.setup();
    impact = {
      removals: [
        {
          healthcarePlanId: "plan-amil",
          doctors: [
            {
              userClinicId: "membership-2",
              displayName: "Dr. André Costa",
              mode: "ClinicDefault",
            },
          ],
        },
      ],
    };
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Amil no padrão da clínica" }),
    );
    await user.click(saveButton());

    const dialog = await screen.findByRole("dialog", { name: "Tirar Amil do padrão?" });
    expect(within(dialog).getByText("Dr. André Costa")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Tirar do padrão" }));

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(clinicPlanIds).toEqual(["plan-amil", "plan-unimed"]);
    expect(clinicDefaultIds).toEqual([]);
  });

  test("várias mudanças de uma vez viram um diálogo com um bloco por convênio", async () => {
    const user = userEvent.setup();
    impact = {
      removals: [
        {
          healthcarePlanId: "plan-amil",
          doctors: [
            {
              userClinicId: "membership-2",
              displayName: "Dr. André Costa",
              mode: "ClinicDefault",
            },
          ],
        },
        ...unimedImpact.removals,
      ],
    };
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Amil no padrão da clínica" }),
    );
    await user.click(screen.getByLabelText("Unimed"));
    await user.click(saveButton());

    const dialog = await screen.findByRole("dialog", {
      name: "Confirmar mudanças nos convênios?",
    });
    expect(within(dialog).getByRole("heading", { name: /Amil.*sai do padrão/ })).toBeVisible();
    expect(
      within(dialog).getByRole("heading", { name: /Unimed.*deixa de ser aceito/ }),
    ).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(putCalls(clinicPath)).toHaveLength(0);
    expect(saveButton()).toBeEnabled();
  });

  test("médico no padrão vê a lista da clínica travada", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dr\. André Costa/);

    expect(await screen.findByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
    expect(screen.getByText("definido pela clínica")).toBeVisible();
    const group = screen.getByRole("group", {
      name: "Convênios atendidos por Dr. André Costa",
    });
    expect(within(group).getByLabelText("Amil")).toBeChecked();
    expect(within(group).getByLabelText("Amil")).toBeDisabled();
    expect(within(group).getByLabelText("Unimed")).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Convênios atendidos · 1 de 2" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Alterar o padrão da clínica" }));

    expect(
      await screen.findByRole("heading", { name: "Convênios da clínica" }),
    ).toBeVisible();
  });

  test("personalizar parte do padrão, mostra a diferença e salva a lista própria", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dr\. André Costa/);
    await user.click(await screen.findByRole("radio", { name: /Personalizado/ }));

    const group = screen.getByRole("group", {
      name: "Convênios atendidos por Dr. André Costa",
    });
    // Começa com o padrão marcado e liberado.
    expect(within(group).getByLabelText(/Amil/)).toBeChecked();
    expect(within(group).getByLabelText(/Amil/)).toBeEnabled();
    expect(screen.queryByText("Difere do padrão:")).not.toBeInTheDocument();

    await user.click(within(group).getByLabelText(/Amil/));
    await user.click(within(group).getByLabelText("Unimed"));

    const diff = screen.getByRole("list", { name: "Diferenças para o padrão da clínica" });
    expect(within(diff).getByText("Unimed").closest("li")).toHaveTextContent("A mais: Unimed");
    expect(within(diff).getByText("Amil").closest("li")).toHaveTextContent("A menos: Amil");
    expect(
      within(await nav()).getByRole("button", {
        name: /Dr\. André Costa.*Personalizado · não salvo/,
      }),
    ).toBeVisible();

    await user.click(saveButton());

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(doctorPlans["membership-2"]).toEqual({ mode: "Custom", ids: ["plan-unimed"] });
  });

  test("aplicar padrão copia a seleção e o médico continua personalizado", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dra\. Marina Lopes/);
    await user.click(
      await screen.findByRole("button", { name: "Aplicar padrão da clínica" }),
    );

    expect(screen.getByRole("radio", { name: /Personalizado/ })).toBeChecked();
    expect(screen.queryByText("Difere do padrão:")).not.toBeInTheDocument();
    await user.click(saveButton());

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(doctorPlans["membership-1"]).toEqual({ mode: "Custom", ids: ["plan-amil"] });
  });

  test("marcar todos e copiar de outro médico preenchem a lista", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dr\. Rafael Souza/);
    await user.click(await screen.findByRole("button", { name: "Marcar todos" }));

    const group = screen.getByRole("group", {
      name: "Convênios atendidos por Dr. Rafael Souza",
    });
    expect(within(group).getByLabelText(/Amil/)).toBeChecked();
    expect(within(group).getByLabelText("Unimed")).toBeChecked();
    expect(screen.getByRole("button", { name: "Marcar todos" })).toBeDisabled();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Copiar de outro médico" }),
      "Dra. Marina Lopes",
    );

    expect(within(group).getByLabelText(/Amil/)).not.toBeChecked();
    expect(within(group).getByLabelText("Unimed")).toBeChecked();
    await user.click(saveButton());

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(doctorPlans["membership-4"]).toEqual({ mode: "Custom", ids: ["plan-unimed"] });
  });

  test("voltar ao padrão da clínica não envia lista", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dra\. Marina Lopes/);
    await user.click(await screen.findByRole("radio", { name: /Padrão da clínica/ }));
    await user.click(saveButton());

    expect(await screen.findByText("Convênios atualizados.")).toBeVisible();
    expect(doctorPlans["membership-1"]).toEqual({ mode: "ClinicDefault", ids: [] });
  });

  test("o rascunho de um médico sobrevive à troca de item", async () => {
    const user = userEvent.setup();
    renderPage();

    await openDoctor(user, /Dra\. Marina Lopes/);
    await user.click(await screen.findByLabelText(/Amil/));
    await openDoctor(user, /Dr\. André Costa/);

    expect(screen.queryByRole("button", { name: "Salvar convênios" })).not.toBeInTheDocument();
    expect(
      within(await nav()).getByRole("button", {
        name: /Dra\. Marina Lopes.*Personalizado · não salvo/,
      }),
    ).toBeVisible();

    await openDoctor(user, /Dra\. Marina Lopes/);

    expect(await screen.findByLabelText(/Amil/)).toBeChecked();
    expect(saveButton()).toBeEnabled();
  });

  test("o item da URL abre direto o médico", async () => {
    initialSearch = "item=membership-2";
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Dr. André Costa", level: 2 }),
    ).toBeVisible();
  });

  test("retirar um convênio da clínica atualiza a lista do médico", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("Unimed"));
    await user.click(saveButton());
    await screen.findByText("Convênios atualizados.");
    await openDoctor(user, /Dra\. Marina Lopes/);

    await waitFor(() => {
      const group = screen.getByRole("group", {
        name: "Convênios atendidos por Dra. Marina Lopes",
      });
      expect(within(group).queryByLabelText("Unimed")).not.toBeInTheDocument();
    });
  });

  test("médico sem administração vê só os próprios convênios", async () => {
    session = doctorSession(false);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Meus convênios" }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Convênios que você atende" }),
    ).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Clínica e médicos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Convênios da clínica" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Copiar de outro médico" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Alterar o padrão da clínica" }),
    ).not.toBeInTheDocument();
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

  test("falha ao carregar oferece tentar de novo", async () => {
    requestMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    renderPage();

    expect(
      await screen.findByText("Não foi possível carregar os convênios."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });
});
