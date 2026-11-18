import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { Patient, Prescription, PrescriptionList } from "../../api/types";
import { PatientPrescriptionsPage } from "./PatientPrescriptionsPage";

const { requestMock, requestBlobMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  requestBlobMock: vi.fn(),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, requestBlob: requestBlobMock }),
}));
vi.mock("../patient-actions/ClinicalAccessEmailAction", () => ({
  ClinicalAccessEmailAction: ({ patientId }: { patientId: string }) => (
    <button type="button">Enviar autorização de {patientId}</button>
  ),
}));

const patient: Patient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  documentCountryCode: "BR",
  documentType: "CPF",
  document: "52998224725",
  medicalRecordNumber: 48213,
  bloodType: null,
  sexForClinicalUse: null,
  name: "Rita de Cássia Alves",
  phone: "+5511988776655",
  email: null,
  birthDate: "1984-03-12",
  notes: null,
  isActive: true,
  createdAtUtc: "2025-01-01T12:00:00Z",
};

const issuedId = "11111111-1111-4111-8111-111111111111";
const cancelledId = "22222222-2222-4222-8222-222222222222";
const newId = "33333333-3333-4333-8333-333333333333";

const issuedRx: Prescription = {
  id: issuedId,
  patientId: patient.id,
  content: "Amoxicilina 500 mg\nTomar 1 cápsula de 8 em 8 horas por 7 dias.\n\nUso oral.",
  status: "Issued",
  version: 3,
  issuedAtUtc: "2026-08-12T17:30:00Z",
  issuedByUserId: "doctor-1",
  issuedByName: "Dra. Ana Martins",
  issuedByRegistration: "CRM-SP 123456",
  cancelledAtUtc: null,
  cancelledByUserId: null,
  capabilities: { canCancel: true },
};

const cancelledRx: Prescription = {
  id: cancelledId,
  patientId: patient.id,
  content: "Dipirona 500 mg\nTomar 1 comprimido se dor.",
  status: "Cancelled",
  version: 2,
  issuedAtUtc: "2026-07-01T13:00:00Z",
  issuedByUserId: "doctor-2",
  issuedByName: "Dr. Bruno Lima",
  issuedByRegistration: null,
  cancelledAtUtc: "2026-07-02T12:15:00Z",
  cancelledByUserId: "doctor-2",
  capabilities: { canCancel: false },
};

interface MockState {
  items: Prescription[];
  canIssue: boolean;
  listRequests: number;
  writes: Array<{ path: string; body: unknown }>;
}

let state: MockState;

function installApi(overrides: Partial<MockState> = {}) {
  state = { items: [issuedRx, cancelledRx], canIssue: true, listRequests: 0, writes: [], ...overrides };
  requestMock.mockImplementation(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (path === `/patients/${patient.id}`) return patient;
    if (path === "/clinics/current") return { id: "clinic-1", timeZoneId: "America/Sao_Paulo" };
    if (path === `/prescriptions/patients/${patient.id}` && method === "GET") {
      state.listRequests += 1;
      const list: PrescriptionList = { items: state.items, capabilities: { canIssue: state.canIssue } };
      return list;
    }
    if (path === `/prescriptions/patients/${patient.id}` && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { content: string };
      state.writes.push({ path, body });
      const created: Prescription = {
        ...issuedRx,
        id: newId,
        content: body.content,
        version: 1,
        issuedAtUtc: "2026-08-20T14:00:00Z",
      };
      state.items = [created, ...state.items];
      return created;
    }
    const cancelMatch = path.match(/^\/prescriptions\/([0-9a-f-]+)\/cancel$/);
    if (cancelMatch && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { expectedVersion: number };
      state.writes.push({ path, body });
      const current = state.items.find((item) => item.id === cancelMatch[1])!;
      const cancelled: Prescription = {
        ...current,
        status: "Cancelled",
        version: current.version + 1,
        cancelledAtUtc: "2026-08-20T15:00:00Z",
        cancelledByUserId: current.issuedByUserId,
        capabilities: { canCancel: false },
      };
      state.items = state.items.map((item) => (item.id === cancelled.id ? cancelled : item));
      return cancelled;
    }
    throw new Error(`rota inesperada: ${method} ${path}`);
  });
}

function renderPage(query = "") {
  window.history.replaceState({}, "", `/app/pacientes/${patient.id}/receitas${query}`);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PatientPrescriptionsPage patientId={patient.id} />
    </QueryClientProvider>,
  );
}

function searchParam(name: string) {
  return new URLSearchParams(window.location.search).get(name);
}

function historyRows() {
  return within(screen.getByRole("list", { name: "Histórico de receitas" })).getAllByRole("button");
}

beforeEach(() => {
  requestMock.mockReset();
  requestBlobMock.mockReset();
  installApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("lista o histórico do mais recente ao mais antigo, com data no fuso da clínica, prévia, médico e estado", async () => {
  renderPage();

  expect(await screen.findByText("2 receitas")).toBeVisible();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(patient.name);
  expect(screen.getByRole("heading", { level: 2, name: "Receitas" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Receitas" })).toHaveAttribute("aria-current", "page");

  const rows = historyRows();
  expect(rows).toHaveLength(2);
  // 17:30 UTC é 14:30 em São Paulo.
  expect(rows[0]).toHaveTextContent("12/08/2026, 14:30");
  expect(rows[0]).toHaveTextContent("Amoxicilina 500 mg Tomar 1 cápsula de 8 em 8 horas por 7 dias. Uso oral.");
  expect(rows[0]).toHaveTextContent("Dra. Ana Martins");
  expect(within(rows[0]).getByText("Emitida")).toBeVisible();
  expect(rows[1]).toHaveTextContent("01/07/2026, 10:00");
  expect(within(rows[1]).getByText("Cancelada")).toBeVisible();

  // O enum do backend nunca aparece cru.
  expect(screen.queryByText(/Issued|Cancelled/)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Selecione uma receita" })).toBeVisible();
});

test("clicar numa receita grava a seleção na URL e mostra o detalhe", async () => {
  const user = userEvent.setup();
  renderPage();

  await screen.findByText("2 receitas");
  await user.click(historyRows()[0]);

  await waitFor(() => expect(searchParam("receita")).toBe(issuedId));
  expect(historyRows()[0]).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "Receita de 12/08/2026" })).toBeVisible();
});

test("receita emitida mostra o texto completo com as quebras de linha e as ações", async () => {
  renderPage(`?receita=${issuedId}`);

  const detail = await screen.findByRole("article", { name: "Receita de 12/08/2026" });
  const text = within(detail).getByRole("region", { name: "Texto da receita" });
  // O texto chega intacto ao DOM; o CSS (pre-wrap) é quem mostra as quebras.
  expect(text.lastElementChild?.textContent).toBe(issuedRx.content);
  expect(within(detail).getByText("CRM-SP 123456")).toBeVisible();
  expect(within(detail).getByText("Dra. Ana Martins")).toBeVisible();
  expect(within(detail).getByText("12/08/2026, 14:30")).toBeVisible();
  expect(within(detail).getByRole("button", { name: "Abrir PDF" })).toBeVisible();
  expect(within(detail).getByRole("button", { name: "Usar como base" })).toBeVisible();
  expect(within(detail).getByRole("button", { name: "Cancelar receita" })).toBeVisible();
});

test("receita cancelada continua legível, sem PDF nem cancelamento, mas serve de base", async () => {
  renderPage(`?receita=${cancelledId}`);

  const detail = await screen.findByRole("article", { name: "Receita de 01/07/2026" });
  expect(within(detail).getByText("Cancelada")).toBeVisible();
  expect(within(detail).getByText("02/07/2026, 09:15")).toBeVisible();
  expect(within(detail).getByText("Não informado")).toBeVisible();
  expect(
    within(detail).getByText("Receita cancelada. O texto continua no histórico, mas o PDF não é mais entregue."),
  ).toBeVisible();
  expect(within(detail).queryByRole("button", { name: "Abrir PDF" })).not.toBeInTheDocument();
  expect(within(detail).queryByRole("button", { name: "Cancelar receita" })).not.toBeInTheDocument();
  expect(within(detail).getByRole("button", { name: "Usar como base" })).toBeVisible();
});

test("receita emitida por outro médico não oferece cancelamento", async () => {
  installApi({ items: [{ ...issuedRx, capabilities: { canCancel: false } }] });
  renderPage(`?receita=${issuedId}`);

  const detail = await screen.findByRole("article", { name: "Receita de 12/08/2026" });
  expect(within(detail).getByRole("button", { name: "Abrir PDF" })).toBeVisible();
  expect(within(detail).queryByRole("button", { name: "Cancelar receita" })).not.toBeInTheDocument();
});

test("emite uma receita nova e a seleciona no topo do histórico", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Nova receita" }));
  expect(searchParam("acao")).toBe("nova");
  const dialog = await screen.findByRole("dialog", { name: "Nova receita" });
  expect(within(dialog).getByText("Depois de emitida, a receita não pode ser editada.")).toBeVisible();

  await user.type(
    within(dialog).getByRole("textbox", { name: "Texto da receita" }),
    "Losartana 50 mg{enter}1 comprimido pela manhã.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Emitir receita" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova receita" })).not.toBeInTheDocument());
  expect(state.writes).toEqual([
    {
      path: `/prescriptions/patients/${patient.id}`,
      body: { content: "Losartana 50 mg\n1 comprimido pela manhã." },
    },
  ]);
  expect(searchParam("receita")).toBe(newId);
  expect(searchParam("acao")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Receita emitida.");
  expect(await screen.findByText("3 receitas")).toBeVisible();
  expect(historyRows()[0]).toHaveAttribute("aria-pressed", "true");
  expect(historyRows()[0]).toHaveTextContent("Losartana 50 mg 1 comprimido pela manhã.");
});

test("usar como base copia o texto, emite outra receita e deixa a original intacta", async () => {
  const user = userEvent.setup();
  renderPage(`?receita=${cancelledId}`);

  await user.click(await screen.findByRole("button", { name: "Usar como base" }));
  expect(searchParam("acao")).toBe("nova");
  expect(searchParam("base")).toBe(cancelledId);

  const dialog = await screen.findByRole("dialog", { name: "Nova receita" });
  expect(dialog).toHaveAccessibleDescription(
    "Paciente: Rita de Cássia Alves. Texto copiado da receita de 01/07/2026; a original continua como está.",
  );
  const field = within(dialog).getByRole("textbox", { name: "Texto da receita" });
  expect(field).toHaveValue(cancelledRx.content);

  await user.type(field, "{enter}Máximo de 4 comprimidos ao dia.");
  await user.click(within(dialog).getByRole("button", { name: "Emitir receita" }));

  await waitFor(() => expect(searchParam("receita")).toBe(newId));
  expect(state.writes).toEqual([
    {
      path: `/prescriptions/patients/${patient.id}`,
      body: { content: `${cancelledRx.content}\nMáximo de 4 comprimidos ao dia.` },
    },
  ]);
  expect(searchParam("base")).toBeNull();
  // Nada foi escrito na original: ela segue cancelada, com o mesmo texto.
  expect(state.items.find((item) => item.id === cancelledId)).toEqual(cancelledRx);
});

test("?acao=nova abre o formulário direto pela URL", async () => {
  renderPage("?acao=nova");

  expect(await screen.findByRole("dialog", { name: "Nova receita" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Texto da receita" })).toHaveValue("");
});

test("sem permissão de emitir, nem o botão nem a URL abrem o formulário", async () => {
  installApi({ canIssue: false });
  renderPage("?acao=nova");

  expect(await screen.findByText("2 receitas")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Nova receita" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Nova receita" })).not.toBeInTheDocument();
});

test("histórico vazio explica a próxima ação", async () => {
  installApi({ items: [] });
  renderPage();

  expect(await screen.findByText("Nenhuma receita emitida", { selector: "strong" })).toBeVisible();
  expect(screen.getByText(/Emita a primeira em “Nova receita”/)).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Selecione uma receita" })).not.toBeInTheDocument();
});

test("cancela com a versão esperada e a receita segue no histórico como cancelada", async () => {
  const user = userEvent.setup();
  renderPage(`?receita=${issuedId}`);

  await user.click(await screen.findByRole("button", { name: "Cancelar receita" }));
  let confirm = screen.getByRole("alertdialog", { name: "Cancelar esta receita?" });
  expect(confirm).toHaveAccessibleDescription(/continua no histórico do paciente, marcada como cancelada/);

  await user.click(within(confirm).getByRole("button", { name: "Manter receita" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(state.writes).toEqual([]);

  await user.click(screen.getByRole("button", { name: "Cancelar receita" }));
  confirm = screen.getByRole("alertdialog", { name: "Cancelar esta receita?" });
  await user.click(within(confirm).getByRole("button", { name: "Cancelar receita" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(state.writes).toEqual([
    { path: `/prescriptions/${issuedId}/cancel`, body: { expectedVersion: 3 } },
  ]);
  expect(screen.getByRole("status")).toHaveTextContent("Receita cancelada. Ela continua no histórico do paciente.");
  const detail = screen.getByRole("article", { name: "Receita de 12/08/2026" });
  expect(within(detail).getByText("Cancelada")).toBeVisible();
  expect(within(detail).queryByRole("button", { name: "Abrir PDF" })).not.toBeInTheDocument();
  expect(within(detail).queryByRole("button", { name: "Cancelar receita" })).not.toBeInTheDocument();
  expect(historyRows()).toHaveLength(2);
});

test("conflito no cancelamento fecha a confirmação, avisa e recarrega a lista", async () => {
  const user = userEvent.setup();
  renderPage(`?receita=${issuedId}`);
  await screen.findByRole("article", { name: "Receita de 12/08/2026" });
  const requestsBefore = state.listRequests;

  const fallback = requestMock.getMockImplementation()!;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.endsWith("/cancel")) {
      // Outra sessão cancelou antes: a lista que volta já mostra isso.
      state.items = [{ ...issuedRx, status: "Cancelled", version: 4, cancelledAtUtc: "2026-08-20T15:00:00Z", capabilities: { canCancel: false } }, cancelledRx];
      return Promise.reject(new ApiError("A receita foi alterada.", 409));
    }
    return fallback(path, init);
  });

  await user.click(screen.getByRole("button", { name: "Cancelar receita" }));
  await user.click(
    within(screen.getByRole("alertdialog", { name: "Cancelar esta receita?" })).getByRole("button", {
      name: "Cancelar receita",
    }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Esta receita mudou enquanto você decidia. A lista foi recarregada; confira o estado atual.",
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await waitFor(() => expect(state.listRequests).toBeGreaterThan(requestsBefore));
  const detail = screen.getByRole("article", { name: "Receita de 12/08/2026" });
  await waitFor(() => expect(within(detail).getByText("Cancelada")).toBeVisible());
});

test("falha transitória no cancelamento mantém a confirmação aberta para tentar de novo", async () => {
  const user = userEvent.setup();
  renderPage(`?receita=${issuedId}`);
  await screen.findByRole("article", { name: "Receita de 12/08/2026" });

  const fallback = requestMock.getMockImplementation()!;
  requestMock.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith("/cancel")
      ? Promise.reject(new ApiError("Serviço indisponível.", 503))
      : fallback(path, init),
  );

  await user.click(screen.getByRole("button", { name: "Cancelar receita" }));
  const confirm = screen.getByRole("alertdialog", { name: "Cancelar esta receita?" });
  await user.click(within(confirm).getByRole("button", { name: "Cancelar receita" }));

  expect(await within(confirm).findByRole("alert")).toHaveTextContent("Serviço indisponível.");
  expect(screen.getByRole("alertdialog", { name: "Cancelar esta receita?" })).toBeVisible();
});

test("abre o PDF autenticado numa aba nova", async () => {
  const user = userEvent.setup();
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receita-1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  requestBlobMock.mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
  renderPage(`?receita=${issuedId}`);

  await user.click(await screen.findByRole("button", { name: "Abrir PDF" }));

  expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(tab.opener).toBeNull();
  expect(requestBlobMock).toHaveBeenCalledWith(`/prescriptions/${issuedId}/document`);
  await waitFor(() => expect(tab.location.href).toBe("blob:receita-1"));
  expect(tab.close).not.toHaveBeenCalled();
});

test("PDF recusado por cancelamento em outra sessão fecha a aba, explica e recarrega", async () => {
  const user = userEvent.setup();
  const tab = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  requestBlobMock.mockRejectedValue(new ApiError("Receita cancelada.", 409));
  renderPage(`?receita=${issuedId}`);
  await screen.findByRole("article", { name: "Receita de 12/08/2026" });
  const requestsBefore = state.listRequests;

  await user.click(screen.getByRole("button", { name: "Abrir PDF" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Esta receita foi cancelada e o PDF não é mais entregue. A lista foi atualizada.",
  );
  expect(tab.close).toHaveBeenCalledOnce();
  await waitFor(() => expect(state.listRequests).toBeGreaterThan(requestsBefore));
});

test("sem acesso clínico ao paciente mostra o aviso e nenhuma ação de receita", async () => {
  requestMock.mockImplementation(async (path: string) => {
    if (path === `/patients/${patient.id}`) return patient;
    if (path === `/prescriptions/patients/${patient.id}`) {
      throw new ApiError("Usuário sem acesso clínico ao paciente.", 403);
    }
    throw new Error(`rota inesperada: ${path}`);
  });
  renderPage();

  expect(await screen.findByRole("heading", { name: "Acesso clínico pendente" })).toBeVisible();
  expect(screen.getByRole("button", { name: `Enviar autorização de ${patient.id}` })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Nova receita" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Receitas" })).toHaveAttribute("aria-current", "page");
});

test("link para receita que não está no histórico avisa em vez de quebrar", async () => {
  renderPage("?receita=99999999-9999-4999-8999-999999999999");

  expect(await screen.findByRole("heading", { name: "Receita não encontrada" })).toBeVisible();
  expect(screen.getByText("2 receitas")).toBeVisible();
  expect(historyRows().every((row) => row.getAttribute("aria-pressed") === "false")).toBe(true);
});
