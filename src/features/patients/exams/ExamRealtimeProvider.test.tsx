import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthResponse, ExamStatus } from "../../../api/types";
import {
  ExamRealtimeProvider,
  type ExamRealtimeConnection,
  type ExamRealtimeConnectionFactory,
  useExamRealtimeView,
} from "./ExamRealtimeProvider";

let session: AuthResponse | null;

vi.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({ session }),
}));

function auth(clinicId = "clinic-1", userId = "user-1", token = "token-1"): AuthResponse {
  return {
    clinicId,
    userId,
    email: "user@example.test",
    name: "Usuário",
    roles: ["Doctor"],
    tokens: {
      accessToken: token,
      refreshToken: "refresh-sensitive",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
    },
  };
}

class FakeConnection implements ExamRealtimeConnection {
  start = vi.fn().mockResolvedValue(undefined);
  stop = vi.fn().mockResolvedValue(undefined);
  private events = new Map<string, (payload: unknown) => void>();
  private reconnectingHandler: (() => void) | null = null;
  private reconnectedHandler: (() => void) | null = null;
  private closeHandler: (() => void) | null = null;

  on(event: string, handler: (payload: unknown) => void) { this.events.set(event, handler); }
  onreconnecting(handler: () => void) { this.reconnectingHandler = handler; }
  onreconnected(handler: () => void) { this.reconnectedHandler = handler; }
  onclose(handler: () => void) { this.closeHandler = handler; }
  emit(payload: unknown) { this.events.get("examUploadUpdated")?.(payload); }
  reconnecting() { this.reconnectingHandler?.(); }
  reconnected() { this.reconnectedHandler?.(); }
  close() { this.closeHandler?.(); }
}

interface HarnessProps {
  patientId?: string;
  statuses?: ExamStatus[];
  poll?: () => void;
  select?: (examId: string) => void;
}

function Harness({ patientId = "patient-1", statuses = ["Pendente"], poll = vi.fn(), select = vi.fn() }: HarnessProps) {
  const state = useExamRealtimeView({
    patientId,
    patientName: "Maria de teste",
    exams: statuses.map((status, index) => ({ id: `exam-${index + 1}`, name: index ? "Raio X" : "Hemograma", status })),
    onPoll: poll,
    onSelectExam: select,
  });
  return <output aria-label="Estado realtime">{state}</output>;
}

function renderRealtime(
  viewProps: HarnessProps = {},
  factory?: ExamRealtimeConnectionFactory,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const connection = new FakeConnection();
  const createConnection = factory ?? vi.fn(() => connection);
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <ExamRealtimeProvider connectionFactory={createConnection}>{children}</ExamRealtimeProvider>
    </QueryClientProvider>
  );
  const rendered = render(<Harness {...viewProps} />, { wrapper: Wrapper });
  return { ...rendered, connection, createConnection, client };
}

beforeEach(() => {
  session = auth();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("conecta no hub autenticado sem comando de join do cliente", async () => {
  const connection = new FakeConnection();
  const factory = vi.fn<ExamRealtimeConnectionFactory>(() => connection);
  renderRealtime({}, factory);
  await act(async () => undefined);
  expect(factory).toHaveBeenCalledOnce();
  expect(factory.mock.calls[0][0].url).toMatch(/\/hubs\/agenda$/);
  expect(factory.mock.calls[0][0].accessTokenFactory()).toBe("token-1");
  expect(connection.start).toHaveBeenCalledOnce();
  expect("invoke" in connection).toBe(false);
  expect(screen.getByLabelText("Estado realtime")).toHaveTextContent("connected");
});

test("refresh do token no mesmo escopo reutiliza a conexão e atualiza a factory", async () => {
  const connection = new FakeConnection();
  const factory = vi.fn<ExamRealtimeConnectionFactory>(() => connection);
  const rendered = renderRealtime({}, factory);
  await act(async () => undefined);
  session = auth("clinic-1", "user-1", "token-2");
  rendered.rerender(<Harness />);
  expect(factory).toHaveBeenCalledOnce();
  expect(factory.mock.calls[0][0].accessTokenFactory()).toBe("token-2");
});

test("troca de escopo encerra a conexão anterior e cria outra", async () => {
  const first = new FakeConnection();
  const second = new FakeConnection();
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const rendered = renderRealtime({}, factory);
  await act(async () => undefined);
  session = auth("clinic-2", "user-2", "token-2");
  rendered.rerender(<Harness />);
  await act(async () => undefined);
  expect(first.stop).toHaveBeenCalledOnce();
  expect(second.start).toHaveBeenCalledOnce();
});

test("unmount encerra a conexão e limpa o polling", async () => {
  vi.useFakeTimers();
  const poll = vi.fn();
  const rendered = renderRealtime({ poll });
  await act(async () => undefined);
  act(() => rendered.connection.reconnecting());
  rendered.unmount();
  act(() => vi.advanceTimersByTime(10_000));
  expect(rendered.connection.stop).toHaveBeenCalledOnce();
  expect(poll).not.toHaveBeenCalled();
});

test("falha ao iniciar expõe estado desconectado", async () => {
  const connection = new FakeConnection();
  connection.start.mockRejectedValueOnce(new Error("offline"));
  renderRealtime({}, vi.fn(() => connection));
  await act(async () => undefined);
  expect(screen.getByLabelText("Estado realtime")).toHaveTextContent("disconnected");
});

test("ignora evento de outro paciente sem invalidar cache", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const rendered = renderRealtime({}, undefined, client);
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-2", status: "EmRevisao", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z" }));
  expect(invalidate).not.toHaveBeenCalled();
});

test("evento visível invalida uma vez a lista do paciente e o detalhe", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const rendered = renderRealtime({}, undefined, client);
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-1", status: "Processando", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z" }));
  expect(invalidate.mock.calls.map((call) => call[0]?.queryKey)).toEqual([
    ["exams", "patient", "patient-1"],
    ["exams", "detail", "exam-1"],
  ]);
});

test("polling espera cinco segundos e só roda desconectado com exame ativo", async () => {
  vi.useFakeTimers();
  const poll = vi.fn();
  const rendered = renderRealtime({ poll, statuses: ["Pendente"] });
  await act(async () => undefined);
  act(() => rendered.connection.reconnecting());
  act(() => vi.advanceTimersByTime(4_999));
  expect(poll).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(poll).toHaveBeenCalledOnce();
});

test("reconexão interrompe o polling imediatamente", async () => {
  vi.useFakeTimers();
  const poll = vi.fn();
  const rendered = renderRealtime({ poll });
  await act(async () => undefined);
  act(() => rendered.connection.reconnecting());
  act(() => vi.advanceTimersByTime(5_000));
  expect(poll).toHaveBeenCalledOnce();
  act(() => rendered.connection.reconnected());
  act(() => vi.advanceTimersByTime(10_000));
  expect(poll).toHaveBeenCalledOnce();
});

test("estado terminal visível interrompe o polling", async () => {
  vi.useFakeTimers();
  const poll = vi.fn();
  const rendered = renderRealtime({ poll });
  await act(async () => undefined);
  act(() => rendered.connection.reconnecting());
  rendered.rerender(<Harness poll={poll} statuses={["Validado"]} />);
  act(() => vi.advanceTimersByTime(10_000));
  expect(poll).not.toHaveBeenCalled();
});

test("evento em revisão cria toast anunciado e ação para o exame", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  const rendered = renderRealtime({ select });
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-1", status: "EmRevisao", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z" }));
  const toast = screen.getByRole("status", { name: "Atualização de exame" });
  expect(toast).toHaveTextContent("Maria de testeHemogramaPronto para revisão");
  await user.click(screen.getByRole("button", { name: "Revisar agora" }));
  expect(select).toHaveBeenCalledWith("exam-1");
});

test("evento de falha oferece Ver falha e permanece aria-live polite", async () => {
  const rendered = renderRealtime();
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-1", status: "Falhou", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z" }));
  const toast = screen.getByRole("status", { name: "Atualização de exame" });
  expect(toast).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("button", { name: "Ver falha" })).toBeInTheDocument();
});

test("evento não terminal não cria toast", async () => {
  const rendered = renderRealtime();
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-1", status: "Processando", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z" }));
  expect(screen.queryByRole("status", { name: "Atualização de exame" })).not.toBeInTheDocument();
});

test("descarta campos clínicos/PII injetados no evento e não persiste notificação", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const rendered = renderRealtime();
  await act(async () => undefined);
  act(() => rendered.connection.emit({ examId: "exam-1", patientId: "patient-1", status: "Falhou", version: 2, updatedAtUtc: "2026-08-09T12:00:00Z", patientName: "PII injetada", examName: "Dado clínico injetado", fileKey: "secret-key" }));
  expect(screen.queryByText(/PII injetada|Dado clínico injetado|secret-key/)).not.toBeInTheDocument();
  expect(storage).not.toHaveBeenCalled();
});
