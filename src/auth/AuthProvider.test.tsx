import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AccountRecoveryOptions,
  AuthResponse,
  AuthV2Authenticated,
  AuthV2LoginOutcome,
} from "../api/types";
import { AuthProvider, useAuth } from "./AuthProvider";

const { apiBlobRequestMock, apiRequestMock } = vi.hoisted(() => ({
  apiBlobRequestMock: vi.fn(),
  apiRequestMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiBlobRequest: apiBlobRequestMock,
  apiRequest: apiRequestMock,
}));

let latestLogin: Promise<AuthV2LoginOutcome> | null = null;
let latestRegistration: Promise<AuthResponse> | null = null;
let latestRefresh: Promise<AuthResponse> | null = null;
let latestRecovery: Promise<AccountRecoveryOptions> | null = null;
let latestRecoveryChallenge: Promise<void> | null = null;
let latestSwitch: Promise<AuthResponse> | null = null;
const persistentStore = new Map<string, string>();

const authenticated: AuthV2Authenticated = {
  kind: "authenticated",
  accessToken: "access-v2",
  refreshToken: "refresh-v2",
  accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  user: { id: "user-v2", name: "Ana" },
  clinicContext: {
    userClinicId: "uc-1",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    role: "Doctor",
    isAdmin: true,
    email: "ana@clinica.test",
    phone: "+5511999999999",
  },
};

function storedSession(): AuthResponse {
  return {
    userId: "user-v2",
    name: "Ana",
    email: "ana@clinica.test",
    phone: "+5511999999999",
    clinicId: "clinic-1",
    clinicName: "Clínica Centro",
    userClinicId: "uc-1",
    clinicRole: "Doctor",
    isAdmin: true,
    roles: ["Doctor", "Admin"],
    availableClinics: [
      {
        userClinicId: "uc-1",
        clinicId: "clinic-1",
        clinicName: "Clínica Centro",
        role: "Doctor",
        isAdmin: true,
      },
      {
        userClinicId: "uc-2",
        clinicId: "clinic-2",
        clinicName: "Clínica Norte",
        role: "Secretary",
        isAdmin: false,
      },
    ],
    tokens: {
      accessToken: "access-old",
      refreshToken: "refresh-old",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    },
  };
}

function Controls() {
  const auth = useAuth();
  return (
    <>
      <output aria-label="Sessão atual">
        {auth.session ? JSON.stringify(auth.session) : "sem sessão"}
      </output>
      <button
        type="button"
        onClick={() => {
          latestRegistration = auth.registerClinicOwner({
            countryCode: "BR",
            documentType: "CPF",
            document: "52998224725",
            name: "Ana",
            email: "ana@clinica.test",
            phone: "+5511999999999",
            password: "Senha123!",
            plan: "Clinic",
            clinicName: "Clínica Centro",
            clinicRegistrationCountryCode: "BR",
            clinicRegistrationType: "CNPJ",
            clinicRegistrationNumber: "11.444.777/0001-61",
            clinicAddress: null,
            professionalAuthority: "CRM",
            professionalRegistrationNumber: "123456",
            professionalRegistrationRegion: "SP",
            professionalRegistrationCountryCode: "BR",
            specialty: "Gastroenterologia",
            defaultAppointmentDurationMinutes: 30,
            termsAccepted: true,
            termsVersion: "clinicflow-terms-v1",
          });
          void latestRegistration.catch(() => undefined);
        }}
      >
        Criar conta
      </button>
      <button
        type="button"
        onClick={() => {
          latestLogin = auth.loginWithDocument({
            countryCode: "BR",
            documentType: "CPF",
            document: "12345678901",
            password: "Senha123!",
            rememberConnection: false,
          });
          void latestLogin.catch(() => undefined);
        }}
      >
        Entrar com documento
      </button>
      <button type="button" onClick={() => void auth.selectClinic("selection", "uc-1")}>
        Selecionar clínica
      </button>
      <button
        type="button"
        onClick={() => {
          latestRefresh = auth.refreshSession();
          void latestRefresh.catch(() => undefined);
        }}
      >
        Atualizar sessão
      </button>
      <button
        type="button"
        onClick={() => {
          latestRecovery = auth.getRecoveryOptions({
            countryCode: "BR",
            documentType: "CPF",
            document: "12345678901",
          });
          void latestRecovery.catch(() => undefined);
        }}
      >
        Recuperar acesso
      </button>
      <button
        type="button"
        onClick={() => {
          latestRecoveryChallenge = auth.requestRecoveryChallenge("opaque-selection");
          void latestRecoveryChallenge.catch(() => undefined);
        }}
      >
        Enviar desafio
      </button>
      <button
        type="button"
        onClick={() => {
          latestSwitch = auth.switchClinic("uc-2");
          void latestSwitch.catch(() => undefined);
        }}
      >
        Trocar clínica
      </button>
      <button type="button" onClick={auth.logout}>Sair</button>
    </>
  );
}

function renderAuth() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Controls />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider identity v2", () => {
  beforeEach(() => {
    persistentStore.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => persistentStore.get(key) ?? null,
        setItem: (key: string, value: string) => persistentStore.set(key, value),
        removeItem: (key: string) => persistentStore.delete(key),
      },
    });
    sessionStorage.clear();
    apiBlobRequestMock.mockReset();
    apiRequestMock.mockReset();
    latestLogin = null;
    latestRegistration = null;
    latestRefresh = null;
    latestRecovery = null;
    latestRecoveryChallenge = null;
    latestSwitch = null;
  });

  test("autentica exclusivamente por documento e materializa o contexto da clínica", async () => {
    apiRequestMock.mockResolvedValue(authenticated);
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Entrar com documento" }));
    await expect(latestLogin).resolves.toEqual(authenticated);

    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/login", {
      method: "POST",
      body: JSON.stringify({
        countryCode: "BR",
        documentType: "CPF",
        document: "12345678901",
        password: "Senha123!",
        rememberConnection: false,
      }),
    });
    expect(screen.getByLabelText("Sessão atual")).toHaveTextContent('"userClinicId":"uc-1"');
    expect(screen.getByLabelText("Sessão atual")).toHaveTextContent('"roles":["Doctor","Admin"]');
  });

  test("cadastra o proprietário pelo contrato v2 e materializa a sessão", async () => {
    apiRequestMock.mockResolvedValue(authenticated);
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await expect(latestRegistration).resolves.toMatchObject({
      userClinicId: "uc-1",
      clinicRole: "Doctor",
      isAdmin: true,
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/register", {
      method: "POST",
      body: expect.stringContaining('"document":"52998224725"'),
    });
    expect(screen.getByLabelText("Sessão atual")).toHaveTextContent('"userClinicId":"uc-1"');
  });

  test("mantém a seleção de clínica fora da sessão até a escolha explícita", async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/login") {
        return Promise.resolve({
          kind: "clinic_selection_required",
          selectionToken: "selection",
          expiresAtUtc: "2099-01-01T00:05:00Z",
          clinics: [{
            userClinicId: "uc-1",
            clinicId: "clinic-1",
            clinicName: "Clínica Centro",
            role: "Doctor",
            isAdmin: true,
          }],
        });
      }
      if (path === "/auth/v2/select-clinic") return Promise.resolve(authenticated);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Entrar com documento" }));
    await expect(latestLogin).resolves.toMatchObject({ kind: "clinic_selection_required" });
    expect(screen.getByLabelText("Sessão atual")).toHaveTextContent("sem sessão");

    await user.click(screen.getByRole("button", { name: "Selecionar clínica" }));
    await waitFor(() => expect(screen.getByLabelText("Sessão atual")).toHaveTextContent('"clinicId":"clinic-1"'));
  });

  test("renova somente pela rota v2 e preserva a lista de clínicas", async () => {
    sessionStorage.setItem("clinicflow.session", JSON.stringify(storedSession()));
    apiRequestMock.mockResolvedValue({ ...authenticated, accessToken: "access-new" });
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Atualizar sessão" }));
    await expect(latestRefresh).resolves.toMatchObject({
      tokens: { accessToken: "access-new" },
      availableClinics: expect.arrayContaining([expect.objectContaining({ userClinicId: "uc-2" })]),
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh-old" }),
    });
  });

  test("expõe recuperação opaca sem revelar contato fora da clínica", async () => {
    const options: AccountRecoveryOptions = {
      destinations: [{ kind: "sms", masked: "+55******9999", selection: "opaque-selection" }],
      supportRequired: false,
    };
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/recovery/options") return Promise.resolve(options);
      if (path === "/auth/v2/recovery/challenges") return Promise.resolve({ status: "accepted" });
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Recuperar acesso" }));
    await expect(latestRecovery).resolves.toEqual(options);
    await user.click(screen.getByRole("button", { name: "Enviar desafio" }));
    await expect(latestRecoveryChallenge).resolves.toBeUndefined();
  });

  test("troca o vínculo ativo pelo userClinicId e encerra pela rota v2", async () => {
    sessionStorage.setItem("clinicflow.session", JSON.stringify(storedSession()));
    const switched: AuthV2Authenticated = {
      ...authenticated,
      accessToken: "access-clinic-2",
      clinicContext: {
        ...authenticated.clinicContext,
        userClinicId: "uc-2",
        clinicId: "clinic-2",
        clinicName: "Clínica Norte",
        role: "Secretary",
        isAdmin: false,
      },
    };
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/switch-clinic") return Promise.resolve(switched);
      if (path === "/auth/v2/logout") return Promise.resolve(undefined);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "Trocar clínica" }));
    await expect(latestSwitch).resolves.toMatchObject({
      userClinicId: "uc-2",
      clinicRole: "Secretary",
      isAdmin: false,
    });

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByLabelText("Sessão atual")).toHaveTextContent("sem sessão");
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh-v2" }),
    });
  });
});
