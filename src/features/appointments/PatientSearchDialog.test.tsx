import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { AuthResponse, Patient } from "../../api/types";
import { PatientSearchDialog } from "./PatientSearchDialog";

let requestMock: unknown = vi.fn();
let authSessionMock: AuthResponse | null;
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session: authSessionMock }),
}));

function mockUseAuthRequest(request: unknown) {
  requestMock = request;
}

function createQueryClient(staleTime = 0) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime,
      },
    },
  });
}

function QueryHarness({
  children,
  client = createQueryClient(),
}: PropsWithChildren<{ client?: QueryClient }>) {
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeSession(
  userId: string,
  clinicId: string,
  roles: AuthResponse["roles"],
  accessToken: string,
): AuthResponse {
  return {
    userId,
    clinicId,
    clinicName: `Clínica ${clinicId}`,
    userClinicId: `uc-${userId}-${clinicId}`,
    clinicRole: roles.includes("Doctor") ? "Doctor" : "Secretary",
    isAdmin: roles.includes("Admin"),
    roles,
    email: `${userId}@example.test`,
    phone: "+5511999999999",
    name: userId,
    availableClinics: [{
      userClinicId: `uc-${userId}-${clinicId}`,
      clinicId,
      clinicName: `Clínica ${clinicId}`,
      role: roles.includes("Doctor") ? "Doctor" : "Secretary",
      isAdmin: roles.includes("Admin"),
    }],
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
const sessionB = makeSession(
  "user-b",
  "clinic-b",
  ["Secretary"],
  "sensitive-token-b",
);

function makePatient(
  id: string,
  name: string,
  createdAtUtc = "2026-08-01T12:00:00Z",
): Patient {
  return {
    id,
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "52998224725",
    name,
    phone: "+5511999990000",
    email: null,
    medicalRecordNumber: 48213,
    bloodType: "APositive",
    sexForClinicalUse: null,
    birthDate: "1980-03-10",
    notes: null,
    isActive: true,
    createdAtUtc,
  };
}

const patient = makePatient("p-1", "Carlos Souza");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushQueryNotifications() {
  await act(() => vi.runOnlyPendingTimersAsync());
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  authSessionMock = sessionA;
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("PatientSearchDialog", () => {
  authSessionMock = sessionA;

  test("isola a chave pelo vínculo contextual sem incluir tokens", async () => {
    const client = createQueryClient(Number.POSITIVE_INFINITY);
    const requestA = vi.fn().mockResolvedValue([
      makePatient("patient-a", "Paciente da clínica A"),
    ]);
    mockUseAuthRequest(requestA);
    const { unmount } = render(
      <QueryHarness client={client}>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    expect(await screen.findByText("Paciente da clínica A")).toBeVisible();
    const serializedKeys = JSON.stringify(
      client.getQueryCache().findAll().map((query) => query.queryKey),
    );
    expect(serializedKeys).toContain("clinic-a");
    expect(serializedKeys).toContain("user-a");
    expect(serializedKeys).toContain("uc-user-a-clinic-a");
    expect(serializedKeys).not.toContain("Admin");
    expect(serializedKeys).not.toContain("sensitive-token-a");
    unmount();

    authSessionMock = sessionB;
    const requestB = vi.fn().mockResolvedValue([
      makePatient("patient-b", "Paciente da clínica B"),
    ]);
    mockUseAuthRequest(requestB);
    render(
      <QueryHarness client={client}>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    expect(await screen.findByText("Paciente da clínica B")).toBeVisible();
    expect(screen.queryByText("Paciente da clínica A")).not.toBeInTheDocument();
    expect(requestB).toHaveBeenCalledOnce();
  });

  test("mostra somente os três pacientes mais recentes e seus metadados formatados", async () => {
    const patients = [
      makePatient("p-1", "Paciente Um", "2026-08-01T12:00:00Z"),
      makePatient("p-2", "Paciente Dois", "2026-08-04T12:00:00Z"),
      makePatient("p-3", "Paciente Três", "2026-08-03T12:00:00Z"),
      makePatient("p-4", "Paciente Quatro", "2026-08-02T12:00:00Z"),
    ];
    const request = vi.fn().mockResolvedValue(patients);
    mockUseAuthRequest(request);

    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    expect(await screen.findByText("Pacientes recentes")).toBeVisible();
    expect(request).toHaveBeenCalledWith("/patients?includeInactive=false");
    const resultButtons = screen.getAllByRole("button", {
      name: /Paciente/,
    });
    expect(resultButtons).toHaveLength(3);
    expect(resultButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("Paciente Dois"),
      expect.stringContaining("Paciente Três"),
      expect.stringContaining("Paciente Quatro"),
    ]);
    expect(screen.getAllByText("10/03/1980").length).toBeGreaterThan(0);
    expect(screen.getAllByText("529.982.247-25").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prontuário 48.213").length).toBeGreaterThan(0);
  });

  test("busca com debounce, normaliza CPF e Enter seleciona o primeiro resultado", async () => {
    vi.useFakeTimers();
    const request = vi.fn((path: string) =>
      Promise.resolve(path.includes("search=") ? [patient] : []),
    );
    mockUseAuthRequest(request);
    const onSelect = vi.fn();
    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={onSelect}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    const search = screen.getByRole("searchbox", {
      name: "Buscar paciente",
    });
    fireEvent.change(search, { target: { value: "529.982.247-25" } });
    await act(() => vi.advanceTimersByTimeAsync(249));
    expect(request).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(request).toHaveBeenLastCalledWith(
      "/patients?search=52998224725&includeInactive=false",
    );
    await flushQueryNotifications();

    expect(screen.getByText("Carlos Souza")).toBeVisible();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(patient);
  });

  test("não exibe nem seleciona resultado antigo enquanto a nova busca aguarda debounce", async () => {
    vi.useFakeTimers();
    const oldPatient = makePatient("p-old", "Resultado antigo");
    const newPatient = makePatient("p-new", "Resultado atual");
    const request = vi.fn((path: string) =>
      Promise.resolve(path.includes("search=") ? [newPatient] : [oldPatient]),
    );
    mockUseAuthRequest(request);
    const onSelect = vi.fn();
    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={onSelect}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );
    await flushQueryNotifications();
    expect(screen.getByText("Resultado antigo")).toBeVisible();

    const search = screen.getByRole("searchbox", { name: "Buscar paciente" });
    fireEvent.change(search, { target: { value: "Resultado atual" } });
    expect(screen.queryByText("Resultado antigo")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Buscando pacientes");
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(249));
    expect(request).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await flushQueryNotifications();
    expect(screen.getByText("Resultado atual")).toBeVisible();
  });

  test("normaliza prontuário, navega com setas e limita a busca a cinquenta resultados", async () => {
    vi.useFakeTimers();
    const results = Array.from({ length: 55 }, (_, index) =>
      makePatient(`p-${index + 1}`, `Paciente ${index + 1}`),
    );
    const request = vi.fn((path: string) =>
      Promise.resolve(path.includes("search=") ? results : []),
    );
    mockUseAuthRequest(request);
    const onSelect = vi.fn();
    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={onSelect}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    const search = screen.getByRole("searchbox", { name: "Buscar paciente" });
    fireEvent.change(search, { target: { value: "#48.213" } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(request).toHaveBeenLastCalledWith(
      "/patients?search=48213&includeInactive=false",
    );
    await flushQueryNotifications();
    const resultsList = screen.getByRole("list", {
      name: "Pacientes encontrados",
    });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    const resultButtons = within(resultsList).getAllByRole("button");
    expect(resultButtons).toHaveLength(50);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(resultButtons[0]).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    fireEvent.keyDown(resultButtons[0], { key: "End" });
    expect(resultButtons[49]).toHaveFocus();
    fireEvent.keyDown(resultButtons[49], { key: "Home" });
    expect(resultButtons[0]).toHaveFocus();
    for (let index = 1; index <= 12; index += 1) {
      fireEvent.keyDown(resultButtons[index - 1], { key: "ArrowDown" });
    }
    expect(resultButtons[12]).toHaveFocus();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    fireEvent.keyDown(resultButtons[12], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(results[12]);
  });

  test("ignora uma resposta antiga que termina depois da busca atual", async () => {
    vi.useFakeTimers();
    const marinaResponse = deferred<Patient[]>();
    const carlosResponse = deferred<Patient[]>();
    const marina = makePatient("p-marina", "Marina Oliveira");
    const carlos = makePatient("p-carlos", "Carlos Souza");
    const request = vi.fn((path: string) => {
      if (path.includes("search=Marina")) return marinaResponse.promise;
      if (path.includes("search=Carlos")) return carlosResponse.promise;
      return Promise.resolve([]);
    });
    mockUseAuthRequest(request);
    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    const search = screen.getByRole("searchbox", {
      name: "Buscar paciente",
    });
    fireEvent.change(search, { target: { value: "Marina" } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    fireEvent.change(search, { target: { value: "Carlos" } });
    await act(() => vi.advanceTimersByTimeAsync(250));

    await act(async () => {
      carlosResponse.resolve([carlos]);
      await carlosResponse.promise;
    });
    await flushQueryNotifications();
    expect(screen.getByText("Carlos Souza")).toBeVisible();
    await act(async () => {
      marinaResponse.resolve([marina]);
      await marinaResponse.promise;
    });
    await flushQueryNotifications();
    expect(screen.getByText("Carlos Souza")).toBeVisible();
    expect(screen.queryByText("Marina Oliveira")).not.toBeInTheDocument();
  });

  test("Esc, backdrop e botão fechar encerram, criação funciona e o foco volta ao acionador", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Selecionar paciente";
    document.body.append(trigger);
    trigger.focus();
    mockUseAuthRequest(vi.fn().mockResolvedValue([]));
    const onClose = vi.fn();
    const onCreate = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={onClose}
          onCreate={onCreate}
        />
      </QueryHarness>,
    );

    const search = await screen.findByRole("searchbox", {
      name: "Buscar paciente",
    });
    expect(search).toHaveFocus();
    expect(await screen.findByText("Nenhum paciente cadastrado")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Cadastrar novo paciente" }),
    );
    expect(onCreate).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rerender(
      <QueryHarness>
        <PatientSearchDialog
          open={false}
          selectedId={null}
          onSelect={vi.fn()}
          onClose={onClose}
          onCreate={onCreate}
        />
      </QueryHarness>,
    );
    expect(trigger).toHaveFocus();

    rerender(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={onClose}
          onCreate={onCreate}
        />
      </QueryHarness>,
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Selecionar paciente",
    });
    await user.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(
      screen.getByRole("button", { name: "Fechar seleção de paciente" }),
    );
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test("comunica carregamento, falha recuperável e busca vazia", async () => {
    const response = deferred<Patient[]>();
    const request = vi
      .fn()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce([]);
    mockUseAuthRequest(request);
    const user = userEvent.setup();
    render(
      <QueryHarness>
        <PatientSearchDialog
          open
          selectedId={null}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </QueryHarness>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carregando pacientes",
    );
    await act(async () => response.reject(new ApiError("Falha", 500)));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os pacientes",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum paciente cadastrado")).toBeVisible();
  });
});
