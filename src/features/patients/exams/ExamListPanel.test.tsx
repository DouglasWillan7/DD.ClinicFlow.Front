import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ExamListFilters, PatientExamPage, PatientExamSummary } from "../../../api/types";
import { ExamListPanel } from "./ExamListPanel";

function exam(id: string, name: string, status: PatientExamSummary["status"]): PatientExamSummary {
  return {
    id,
    patientId: "patient-1",
    name,
    category: "Laboratório",
    scheduledOn: "2026-08-15",
    status,
    version: 1,
    hasDocument: status !== "Solicitado",
    averageConfidence: status === "Em revisão" ? 0.91 : null,
    createdAtUtc: "2026-08-01T10:00:00Z",
    updatedAtUtc: "2026-08-02T10:00:00Z",
  };
}

const filters: ExamListFilters = {
  search: "",
  statuses: [],
  categories: [],
  includeCancelled: false,
};

const pages: PatientExamPage[] = [{
  items: [
    exam("review", "Perfil lipídico", "Em revisão"),
    exam("processing", "HbA1c", "Processando"),
    exam("validated", "Hemograma completo", "Validado"),
  ],
  nextCursor: "next",
  capabilities: { canRequest: true, canAttachDocument: true },
}];

function setup(overrides: Partial<React.ComponentProps<typeof ExamListPanel>> = {}) {
  const props: React.ComponentProps<typeof ExamListPanel> = {
    pages,
    capabilities: { canRequest: true, canAttachDocument: true },
    filters,
    selectedExamId: "review",
    isLoading: false,
    error: null,
    isFetchingNextPage: false,
    hasNextPage: true,
    onFiltersChange: vi.fn(),
    onSelect: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onRequest: vi.fn(),
    onAttach: vi.fn(),
    ...overrides,
  };
  return { ...render(<ExamListPanel {...props} />), props };
}

test("renderiza grupos, categoria, status e seleção sem depender só da cor", () => {
  setup();

  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
    .toEqual(["Revisar", "Em andamento", "Histórico validado"]);
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toHaveTextContent("Laboratório");
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toHaveTextContent("Em revisão");
});

test("os sete estados combinam rótulo, ícone semântico, tom e nome acessível exato", () => {
  const expected = [
    ["Solicitado", "aguardando laudo", "neutral"],
    ["Pendente", "aguardando processamento", "primary"],
    ["Processando", "processamento em andamento", "primary"],
    ["Em revisão", "revisão clínica necessária", "warning"],
    ["Validado", "resultado validado", "success"],
    ["Falhou", "falha no processamento", "danger"],
    ["Cancelado", "solicitação cancelada", "muted"],
  ] as const;
  setup({
    pages: [{
      items: expected.map(([status], index) => exam(`exam-${index}`, `Exame ${index + 1}`, status)),
      nextCursor: null,
      capabilities: { canRequest: true, canAttachDocument: true },
    }],
    hasNextPage: false,
  });

  for (const [status, meaning, tone] of expected) {
    const badge = screen.getByLabelText(`Status: ${status} — ${meaning}`);
    expect(badge).toHaveAccessibleName(`Status: ${status} — ${meaning}`);
    expect(badge).toHaveTextContent(status);
    expect(badge.querySelector("svg")).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-tone", tone);
  }
});

test("seleciona uma linha por controle de teclado/click", async () => {
  const user = userEvent.setup();
  const { props } = setup();
  await user.click(screen.getByRole("button", { name: /HbA1c/ }));
  expect(props.onSelect).toHaveBeenCalledWith("processing");
});

test("busca preserva a seleção e altera somente filtros", async () => {
  const { props } = setup();
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar exames" }), {
    target: { value: "tireoide" },
  });
  expect(props.onFiltersChange).toHaveBeenLastCalledWith({ ...filters, search: "tireoide" });
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Perfil lipídico/ })).toHaveAttribute("aria-pressed", "true");
});

test("cancelados só entram quando o usuário opta pelo filtro", async () => {
  const user = userEvent.setup();
  const { props } = setup();
  await user.click(screen.getByRole("checkbox", { name: "Incluir cancelados" }));
  expect(props.onFiltersChange).toHaveBeenCalledWith({ ...filters, includeCancelled: true });
});

test("carrega a próxima página com estado pendente acessível", () => {
  const { rerender, props } = setup();
  expect(screen.getByRole("button", { name: "Carregar mais" })).toBeEnabled();
  rerender(<ExamListPanel {...props} isFetchingNextPage />);
  expect(screen.getByRole("button", { name: "Carregando mais exames…" })).toBeDisabled();
});

test("distingue carregamento inicial, vazio e nenhum resultado", () => {
  const { rerender, props } = setup({ pages: [], isLoading: true });
  expect(screen.getByRole("status")).toHaveTextContent("Carregando exames");
  rerender(<ExamListPanel {...props} pages={[]} isLoading={false} />);
  expect(screen.getByText("Nenhum exame registrado.")).toBeInTheDocument();
  rerender(<ExamListPanel {...props} pages={[]} isLoading={false} filters={{ ...filters, search: "tireoide" }} />);
  expect(screen.getByText("Nenhum exame corresponde aos filtros.")).toBeInTheDocument();
});

test.each([
  {
    capabilities: { canRequest: true, canAttachDocument: true },
    guidance: "Comece solicitando um exame ou anexando um laudo já disponível.",
    request: true,
    attach: true,
  },
  {
    capabilities: { canRequest: true, canAttachDocument: false },
    guidance: "Comece solicitando o exame que fará parte do histórico deste paciente.",
    request: true,
    attach: false,
  },
  {
    capabilities: { canRequest: false, canAttachDocument: true },
    guidance: "Comece anexando um laudo em PDF ao histórico deste paciente.",
    request: false,
    attach: true,
  },
  {
    capabilities: { canRequest: false, canAttachDocument: false },
    guidance: "Os exames aparecerão aqui quando uma solicitação ou laudo for registrado.",
    request: false,
    attach: false,
  },
])("vazio instrui o fluxo e expõe somente ações permitidas: $guidance", async ({ capabilities, guidance, request, attach }) => {
  const user = userEvent.setup();
  const result = setup({ pages: [], capabilities, hasNextPage: false });
  const empty = screen.getByRole("region", { name: "Começar histórico de exames" });

  expect(within(empty).getByText("Nenhum exame registrado.")).toBeInTheDocument();
  expect(within(empty).getByText(guidance)).toBeInTheDocument();
  if (request) expect(within(empty).getByRole("button", { name: "Solicitar exame" })).toBeInTheDocument();
  else expect(within(empty).queryByRole("button", { name: "Solicitar exame" })).not.toBeInTheDocument();
  if (attach) expect(within(empty).getByRole("button", { name: "Anexar laudo" })).toBeInTheDocument();
  else expect(within(empty).queryByRole("button", { name: "Anexar laudo" })).not.toBeInTheDocument();

  if (request) await user.click(within(empty).getByRole("button", { name: "Solicitar exame" }));
  if (attach) await user.click(within(empty).getByRole("button", { name: "Anexar laudo" }));
  expect(result.props.onRequest).toHaveBeenCalledTimes(request ? 1 : 0);
  expect(result.props.onAttach).toHaveBeenCalledTimes(attach ? 1 : 0);
});

test("erro parcial mantém itens e oferece retentativa", async () => {
  const user = userEvent.setup();
  const { props } = setup({ error: new Error("rede") });
  expect(screen.getByText("Perfil lipídico")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível atualizar a lista");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
});

test("erro inicial oferece retentativa sem fingir lista vazia", () => {
  setup({ pages: [], error: new Error("rede") });
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os exames");
  expect(screen.queryByText("Nenhum exame registrado.")).not.toBeInTheDocument();
});
