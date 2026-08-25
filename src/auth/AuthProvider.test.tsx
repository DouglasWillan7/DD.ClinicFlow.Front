import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AccountRecoveryOptions,
  AuthResponse,
  AuthV2LoginOutcome,
} from "../api/types";
import { AuthProvider, useAuth } from "./AuthProvider";

const { apiBlobRequestMock, apiRequestMock } = vi.hoisted(() => ({
  apiBlobRequestMock: vi.fn(),
  apiRequestMock: vi.fn(),
}));

let latestRefreshPromise: Promise<AuthResponse> | null = null;
let latestRequestPromise: Promise<unknown> | null = null;
let latestBlobPromise: Promise<Blob> | null = null;
let latestV2LoginPromise: Promise<AuthV2LoginOutcome> | null = null;
let latestRecoveryOptionsPromise: Promise<AccountRecoveryOptions> | null = null;
let latestRecoveryChallengePromise: Promise<void> | null = null;

vi.mock("../api/client", () => ({
  apiBlobRequest: apiBlobRequestMock,
  apiRequest: apiRequestMock,
}));

function makeSession(
  userId: string,
  clinicId: string,
  roles: AuthResponse["roles"],
  accessToken: string,
): AuthResponse {
  return {
    userId,
    clinicId,
    roles,
    email: `${userId}@example.test`,
    name: userId,
    tokens: {
      accessToken,
      refreshToken: `refresh-${accessToken}`,
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    },
  };
}

const sessionA = makeSession(
  "user-a",
  "clinic-a",
  ["Secretary", "Admin"],
  "sensitive-token-a",
);
const refreshedSessionA = makeSession(
  "user-a",
  "clinic-a",
  ["Admin", "Secretary"],
  "sensitive-token-refreshed",
);
const sessionB = makeSession(
  "user-b",
  "clinic-b",
  ["Secretary"],
  "sensitive-token-b",
);

function AuthControls() {
  const {
    session,
    login,
    logout,
    refreshSession,
    request,
    requestBlob,
    updateSessionName,
  } = useAuth();
  const startRefresh = () => {
    latestRefreshPromise = refreshSession();
    void latestRefreshPromise.catch(() => undefined);
  };
  const startRequest = (path: string, init?: RequestInit) => {
    latestRequestPromise = request(path, init);
    void latestRequestPromise.catch(() => undefined);
  };
  const startBlobRequest = () => {
    latestBlobPromise = requestBlob("/exams/exam-1/document");
    void latestBlobPromise.catch(() => undefined);
  };
  return (
    <>
      <output aria-label="Sessão atual">{session?.userId ?? "sem sessão"}</output>
      <button type="button" onClick={() => void login("a@example.test", "secret")}>Entrar A</button>
      <button type="button" onClick={() => void login("b@example.test", "secret")}>Entrar B</button>
      <button type="button" onClick={startRefresh}>Atualizar token</button>
      <button type="button" onClick={() => startRequest("/patients")}>Carregar pacientes</button>
      <button type="button" onClick={() => startRequest("/appointments", { method: "POST", body: "{}" })}>Criar consulta</button>
      <button type="button" onClick={startBlobRequest}>Abrir laudo</button>
      <button type="button" onClick={() => updateSessionName("Nome atualizado")}>Atualizar nome</button>
      <button type="button" onClick={logout}>Sair</button>
    </>
  );
}

function V2AuthControls() {
  const {
    getRecoveryOptions,
    loginWithDocument,
    requestRecoveryChallenge,
    selectClinic,
    session,
  } = useAuth();

  return (
    <>
      <output aria-label="Sessão v2">{session ? JSON.stringify(session) : "sem sessão"}</output>
      <button type="button" onClick={() => {
        latestV2LoginPromise = loginWithDocument({
          countryCode: "BR",
          documentType: "CPF",
          document: "123.456.789-01",
          password: "Senha123!",
          rememberConnection: false,
        });
        void latestV2LoginPromise.catch(() => undefined);
      }}>Entrar com documento</button>
      <button type="button" onClick={() => {
        void selectClinic("selection-secret", "uc-1", false);
      }}>Selecionar clínica v2</button>
      <button type="button" onClick={() => {
        latestRecoveryOptionsPromise = getRecoveryOptions({
          countryCode: "BR",
          documentType: "CPF",
          document: "123.456.789-01",
        });
        void latestRecoveryOptionsPromise.catch(() => undefined);
      }}>Buscar recuperação</button>
      <button type="button" onClick={() => {
        latestRecoveryChallengePromise = requestRecoveryChallenge("opaque-selection");
        void latestRecoveryChallengePromise.catch(() => undefined);
      }}>Enviar recuperação</button>
    </>
  );
}

function renderAuth(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AuthControls />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function renderV2Auth(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <V2AuthControls />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function errorWithStatus(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

describe("AuthProvider query isolation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    latestRefreshPromise = null;
    latestRequestPromise = null;
    latestBlobPromise = null;
    apiBlobRequestMock.mockReset();
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/auth/login") {
        const email = JSON.parse(String(init?.body)).email as string;
        return Promise.resolve(email.startsWith("a") ? sessionA : sessionB);
      }
      if (path === "/auth/refresh") return Promise.resolve(refreshedSessionA);
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  test("remove todo cache e storage efêmero ao trocar de identidade no mesmo QueryClient", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    renderAuth(client);

    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    client.setQueryData(["patients", "sensitive"], ["Paciente da clínica A"]);
    sessionStorage.setItem("clinicflow.scoped.draft", "patient-a");

    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    expect(client.getQueryCache().findAll()).toHaveLength(0);
    expect(sessionStorage.getItem("clinicflow.scoped.draft")).toBeNull();

    client.setQueryData(["patients", "sensitive"], ["Paciente da clínica B"]);
    sessionStorage.setItem("clinicflow.scoped.draft", "patient-b");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão"));
    expect(client.getQueryCache().findAll()).toHaveLength(0);
    expect(sessionStorage.getItem("clinicflow.scoped.draft")).toBeNull();
  });

  test("preserva cache e storage em refresh de token da mesma identidade", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    renderAuth(client);

    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    client.setQueryData(["patients", "sensitive"], ["Paciente da clínica A"]);
    sessionStorage.setItem("clinicflow.scoped.draft", "patient-a");

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/auth/refresh",
        expect.any(Object),
      ),
    );
    expect(client.getQueryData(["patients", "sensitive"])).toEqual([
      "Paciente da clínica A",
    ]);
    expect(sessionStorage.getItem("clinicflow.scoped.draft")).toBe("patient-a");
  });

  test("ignora resposta de refresh que termina depois do logout", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const refreshResponse = deferred<AuthResponse>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/refresh") return refreshResponse.promise;
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith("/auth/refresh", expect.any(Object)));
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão");

    await act(async () => {
      refreshResponse.resolve(refreshedSessionA);
      await refreshResponse.promise;
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão");
    expect(sessionStorage.getItem("clinicflow.session")).toBeNull();
    expect(client.getQueryCache().findAll()).toHaveLength(0);
  });

  test("refresh antigo de A não sobrescreve B nem limpa o cache de B", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const refreshResponse = deferred<AuthResponse>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    apiRequestMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/auth/refresh") return refreshResponse.promise;
      if (path === "/auth/login") {
        const email = JSON.parse(String(init?.body)).email as string;
        return Promise.resolve(email.startsWith("b") ? sessionB : sessionA);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    client.setQueryData(["patients", "clinic-b"], ["Paciente B"]);
    sessionStorage.setItem("clinicflow.scoped.draft", "patient-b");

    await act(async () => {
      refreshResponse.resolve(refreshedSessionA);
      await refreshResponse.promise;
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    expect(client.getQueryData(["patients", "clinic-b"])).toEqual(["Paciente B"]);
    expect(sessionStorage.getItem("clinicflow.scoped.draft")).toBe("patient-b");
  });

  test("refresh pendente não atualiza o storage depois do unmount", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const refreshResponse = deferred<AuthResponse>();
    const { unmount } = renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/refresh") return refreshResponse.promise;
      throw new Error(`Unexpected request: ${path}`);
    });
    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    unmount();

    await act(async () => {
      refreshResponse.resolve(refreshedSessionA);
      await refreshResponse.promise;
    });
    const stored = JSON.parse(sessionStorage.getItem("clinicflow.session")!) as AuthResponse;
    expect(stored.tokens.accessToken).toBe("sensitive-token-a");
  });

  test("request não encerra a sessão quando seu refresh é superado por transição do mesmo usuário", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const refreshResponse = deferred<AuthResponse>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/patients") {
        return Promise.reject(Object.assign(new Error("Não autorizado"), { status: 401 }));
      }
      if (path === "/auth/refresh") return refreshResponse.promise;
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Carregar pacientes" }));
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith("/auth/refresh", expect.any(Object)));
    await user.click(screen.getByRole("button", { name: "Atualizar nome" }));
    await act(async () => {
      refreshResponse.resolve(refreshedSessionA);
      await refreshResponse.promise;
    });

    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
  });

  test("POST de A que retorna 401 depois do login B não usa refresh nem repete com B", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const postResponse = deferred<unknown>();
    let postCalls = 0;
    let refreshCalls = 0;
    const postTokens: Array<string | undefined> = [];
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiRequestMock.mockImplementation((
      path: string,
      init?: RequestInit,
      accessToken?: string,
    ) => {
      if (path === "/appointments") {
        postCalls += 1;
        postTokens.push(accessToken);
        return postResponse.promise;
      }
      if (path === "/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(sessionB);
      }
      if (path === "/auth/login") {
        const email = JSON.parse(String(init?.body)).email as string;
        return Promise.resolve(email.startsWith("b") ? sessionB : sessionA);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Criar consulta" }));
    await waitFor(() => expect(postCalls).toBe(1));
    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    client.setQueryData(["patients", "clinic-b"], ["Paciente B"]);
    sessionStorage.setItem("clinicflow.scoped.draft", "patient-b");

    await act(async () => postResponse.reject(errorWithStatus(401, "A expirou")));
    await expect(latestRequestPromise).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });
    expect(refreshCalls).toBe(0);
    expect(postCalls).toBe(1);
    expect(postTokens).toEqual(["sensitive-token-a"]);
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    expect(client.getQueryData(["patients", "clinic-b"])).toEqual(["Paciente B"]);
    expect(sessionStorage.getItem("clinicflow.scoped.draft")).toBe("patient-b");
  });

  test("resposta 200 de A é descartada quando B entrou durante a request", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const responseA = deferred<unknown>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiRequestMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/patients") return responseA.promise;
      if (path === "/auth/login") {
        const email = JSON.parse(String(init?.body)).email as string;
        return Promise.resolve(email.startsWith("b") ? sessionB : sessionA);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Carregar pacientes" }));
    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    await act(async () => responseA.resolve(["Paciente A"]));

    await expect(latestRequestPromise).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
  });

  test("rejeição de refresh antigo vira stale após transição nova do mesmo scope", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const oldRefresh = deferred<AuthResponse>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/refresh") return oldRefresh.promise;
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    const oldOperation = latestRefreshPromise;
    await user.click(screen.getByRole("button", { name: "Atualizar nome" }));
    await act(async () => oldRefresh.reject(new Error("Falha de rede antiga")));

    await expect(oldOperation).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
  });

  test("retry 500 após refresh bem-sucedido propaga erro sem encerrar a sessão", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    let patientCalls = 0;
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    client.setQueryData(["patients", "clinic-a"], ["Paciente A"]);
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/patients") {
        patientCalls += 1;
        return Promise.reject(
          errorWithStatus(patientCalls === 1 ? 401 : 500, "Falha no retry"),
        );
      }
      if (path === "/auth/refresh") return Promise.resolve(refreshedSessionA);
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Carregar pacientes" }));
    await expect(latestRequestPromise).rejects.toMatchObject({ status: 500 });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-a");
    expect(client.getQueryData(["patients", "clinic-a"])).toEqual(["Paciente A"]);
  });

  test("retry 401 tardio não encerra B quando a operação nasceu em A", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const retryResponse = deferred<unknown>();
    let patientCalls = 0;
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiRequestMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/patients") {
        patientCalls += 1;
        return patientCalls === 1
          ? Promise.reject(errorWithStatus(401, "A expirou"))
          : retryResponse.promise;
      }
      if (path === "/auth/refresh") return Promise.resolve(refreshedSessionA);
      if (path === "/auth/login") {
        const email = JSON.parse(String(init?.body)).email as string;
        return Promise.resolve(email.startsWith("b") ? sessionB : sessionA);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Carregar pacientes" }));
    await waitFor(() => expect(patientCalls).toBe(2));
    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    client.setQueryData(["patients", "clinic-b"], ["Paciente B"]);
    await act(async () => retryResponse.reject(errorWithStatus(401, "Retry A expirou")));

    await expect(latestRequestPromise).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
    expect(client.getQueryData(["patients", "clinic-b"])).toEqual(["Paciente B"]);
  });

  test("retry 401 encerra somente a sessão que ainda pertence à operação", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    client.setQueryData(["patients", "clinic-a"], ["Paciente A"]);
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/patients") {
        return Promise.reject(errorWithStatus(401, "Sessão expirada"));
      }
      if (path === "/auth/refresh") return Promise.resolve(refreshedSessionA);
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Carregar pacientes" }));
    await expect(latestRequestPromise).rejects.toMatchObject({ status: 401 });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão");
    expect(client.getQueryCache().findAll()).toHaveLength(0);
  });

  test("blob repete uma única vez após 401 com o token renovado", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const pdf = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiBlobRequestMock
      .mockRejectedValueOnce(errorWithStatus(401, "Token expirado"))
      .mockResolvedValueOnce(pdf);

    await user.click(screen.getByRole("button", { name: "Abrir laudo" }));

    await expect(latestBlobPromise).resolves.toBe(pdf);
    expect(apiBlobRequestMock).toHaveBeenCalledTimes(2);
    expect(apiBlobRequestMock.mock.calls.map((call) => call[2])).toEqual([
      "sensitive-token-a",
      "sensitive-token-refreshed",
    ]);
  });

  test("blob tardio de A é descartado quando a sessão muda para B", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const pdfResponse = deferred<Blob>();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiBlobRequestMock.mockReturnValue(pdfResponse.promise);

    await user.click(screen.getByRole("button", { name: "Abrir laudo" }));
    await user.click(screen.getByRole("button", { name: "Entrar B" }));
    await act(async () => pdfResponse.resolve(new Blob(["%PDF-1.7"])));

    await expect(latestBlobPromise).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("user-b");
  });

  test("segundo 401 do blob encerra somente a sessão de origem", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiBlobRequestMock.mockRejectedValue(errorWithStatus(401, "Sessão expirada"));

    await user.click(screen.getByRole("button", { name: "Abrir laudo" }));

    await expect(latestBlobPromise).rejects.toMatchObject({ status: 401 });
    expect(apiBlobRequestMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão");
  });

  test("finally de refresh antigo não remove refresh novo compartilhado", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    const oldRefresh = deferred<AuthResponse>();
    const newRefresh = deferred<AuthResponse>();
    let refreshCalls = 0;
    renderAuth(client);
    await user.click(screen.getByRole("button", { name: "Entrar A" }));
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/refresh") {
        refreshCalls += 1;
        return refreshCalls === 1 ? oldRefresh.promise : newRefresh.promise;
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    const oldOperation = latestRefreshPromise;
    await user.click(screen.getByRole("button", { name: "Atualizar nome" }));
    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    const newOperation = latestRefreshPromise;
    expect(refreshCalls).toBe(2);
    await act(async () => oldRefresh.reject(new Error("Refresh antigo")));
    await expect(oldOperation).rejects.toMatchObject({
      name: "StaleSessionOperationError",
    });

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    expect(refreshCalls).toBe(2);
    await act(async () => newRefresh.resolve(refreshedSessionA));
    await expect(newOperation).resolves.toMatchObject({
      tokens: { accessToken: "sensitive-token-refreshed" },
    });
  });
});

describe("AuthProvider identity v2", () => {
  const authenticatedV2 = {
    kind: "authenticated" as const,
    accessToken: "access-v2",
    refreshToken: "refresh-v2",
    accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    user: { id: "user-v2", name: "Ana" },
    clinicContext: {
      userClinicId: "uc-1",
      clinicId: "clinic-v2",
      clinicName: "Clínica Centro",
      role: "Doctor" as const,
      isAdmin: true,
      email: "a***@exemplo.com",
      phone: "+55******1234",
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    latestV2LoginPromise = null;
    latestRecoveryOptionsPromise = null;
    latestRecoveryChallengePromise = null;
    apiBlobRequestMock.mockReset();
    apiRequestMock.mockReset();
  });

  function storedV2Session(accessToken = "access-v2-old"): AuthResponse {
    return {
      userId: "user-v2",
      name: "Ana",
      email: "a***@exemplo.com",
      phone: "+55******1234",
      clinicId: "clinic-v2",
      clinicName: "Clínica Centro",
      userClinicId: "uc-1",
      clinicRole: "Doctor",
      isAdmin: true,
      roles: ["Doctor", "Admin"],
      tokens: {
        accessToken,
        refreshToken: "refresh-v2-old",
        accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
      },
    };
  }

  test("mantém seleção intermediária fora da sessão e normaliza o contexto escolhido", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/login") return Promise.resolve({
        kind: "clinic_selection_required",
        selectionToken: "selection-secret",
        expiresAtUtc: "2099-01-01T00:05:00Z",
        clinics: [{
          userClinicId: "uc-1", clinicId: "clinic-v2", clinicName: "Clínica Centro",
          role: "Doctor", isAdmin: true,
        }],
      });
      if (path === "/auth/v2/select-clinic") return Promise.resolve(authenticatedV2);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderV2Auth(client);

    await user.click(screen.getByRole("button", { name: "Entrar com documento" }));
    await expect(latestV2LoginPromise).resolves.toMatchObject({
      kind: "clinic_selection_required",
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/login", {
      method: "POST",
      body: JSON.stringify({
        countryCode: "BR", documentType: "CPF", document: "123.456.789-01",
        password: "Senha123!", rememberConnection: false,
      }),
    });
    expect(screen.getByRole("status", { name: "Sessão v2" })).toHaveTextContent("sem sessão");
    expect(sessionStorage.getItem("clinicflow.session")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Selecionar clínica v2" }));

    await waitFor(() => expect(screen.getByRole("status", { name: "Sessão v2" })).toHaveTextContent("user-v2"));
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/select-clinic", {
      method: "POST",
      body: JSON.stringify({ selectionToken: "selection-secret", userClinicId: "uc-1" }),
    });
    const stored = JSON.parse(sessionStorage.getItem("clinicflow.session")!) as AuthResponse;
    expect(stored).toMatchObject({
      userId: "user-v2",
      userClinicId: "uc-1",
      clinicId: "clinic-v2",
      clinicRole: "Doctor",
      isAdmin: true,
      roles: ["Doctor", "Admin"],
    });
    expect(JSON.stringify(stored)).not.toContain("selection-secret");
  });

  test("consulta somente destinos mascarados e envia apenas a seleção opaca", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/recovery/options") return Promise.resolve({
        destinations: [{ kind: "sms", masked: "+55 ******1234", selection: "opaque-selection" }],
        supportRequired: false,
      });
      if (path === "/auth/v2/recovery/challenges") return Promise.resolve(undefined);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderV2Auth(client);

    await user.click(screen.getByRole("button", { name: "Buscar recuperação" }));
    await expect(latestRecoveryOptionsPromise).resolves.toMatchObject({ supportRequired: false });
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/recovery/options", {
      method: "POST",
      body: JSON.stringify({
        countryCode: "BR", documentType: "CPF", document: "123.456.789-01",
      }),
    });

    await user.click(screen.getByRole("button", { name: "Enviar recuperação" }));
    await expect(latestRecoveryChallengePromise).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/recovery/challenges", {
      method: "POST",
      body: JSON.stringify({ selection: "opaque-selection" }),
    });
  });

  test("renova e encerra a sessão contextual pelos endpoints v2", async () => {
    const client = new QueryClient();
    const user = userEvent.setup();
    sessionStorage.setItem("clinicflow.session", JSON.stringify(storedV2Session()));
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/v2/refresh") return Promise.resolve({
        ...authenticatedV2,
        accessToken: "access-v2-renewed",
        refreshToken: "refresh-v2-renewed",
      });
      if (path === "/auth/v2/logout") return Promise.resolve(undefined);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderAuth(client);

    await user.click(screen.getByRole("button", { name: "Atualizar token" }));
    await expect(latestRefreshPromise).resolves.toMatchObject({
      tokens: { accessToken: "access-v2-renewed" },
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh-v2-old" }),
    });

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByRole("status", { name: "Sessão atual" })).toHaveTextContent("sem sessão");
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith("/auth/v2/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh-v2-renewed" }),
    }));
  });
});
