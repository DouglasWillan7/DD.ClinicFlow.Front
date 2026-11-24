import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ExamListFilters, PatientExamPage, PatientExamSummary } from "../../../api/types";
import { ExamListPanel } from "./ExamListPanel";

function exam(
  id: string,
  name: string,
  status: PatientExamSummary["status"],
  hasDocument = true,
): PatientExamSummary {
  return {
    id,
    patientId: "patient-1",
    name,
    category: "Laboratório",
    status,
    version: 1,
    hasDocument,
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
  capabilities: { canAttachDocument: true },
}];

function setup(overrides: Partial<React.ComponentProps<typeof ExamListPanel>> = {}) {
  const props: React.ComponentProps<typeof ExamListPanel> = {
    pages,
    capabilities: { canAttachDocument: true },
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
  // Estado, rótulo na tela, significado e tom. "Falhou" fala só da análise: o documento está salvo.
  const expected = [
    ["Pendente", "Pendente", "aguardando processamento", "primary"],
    ["Processando", "Processando", "processamento em andamento", "primary"],
    ["Em revisão", "Em revisão", "revisão clínica necessária", "warning"],
    ["Validado", "Validado", "resultado validado", "success"],
    ["Falhou", "Análise falhou", "o documento está salvo; a análise por IA falhou", "danger"],
    ["Cancelado", "Cancelado", "registro cancelado", "muted"],
    ["Sem análise", "Sem análise", "documento salvo, sem análise por IA", "neutral"],
  ] as const;
  setup({
    pages: [{
      items: expected.map(([status], index) => exam(`exam-${index}`, `Exame ${index + 1}`, status)),
      nextCursor: null,
      capabilities: { canAttachDocument: true },
    }],
    hasNextPage: false,
  });

  for (const [, label, meaning, tone] of expected) {
    const badge = screen.getByLabelText(`Status: ${label} — ${meaning}`);
    expect(badge).toHaveAccessibleName(`Status: ${label} — ${meaning}`);
    expect(badge).toHaveTextContent(label);
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
    capabilities: { canAttachDocument: true },
    guidance: "Comece anexando um laudo em PDF ao histórico deste paciente.",
    attach: true,
  },
  {
    capabilities: { canAttachDocument: false },
    guidance: "Os exames aparecerão aqui quando um laudo for anexado.",
    attach: false,
  },
])("vazio instrui o fluxo e expõe somente ações permitidas: $guidance", async ({ capabilities, guidance, attach }) => {
  const user = userEvent.setup();
  const result = setup({ pages: [], capabilities, hasNextPage: false });
  const empty = screen.getByRole("region", { name: "Começar histórico de exames" });

  expect(within(empty).getByText("Nenhum exame registrado.")).toBeInTheDocument();
  expect(within(empty).getByText(guidance)).toBeInTheDocument();
  if (attach) expect(within(empty).getByRole("button", { name: "Anexar laudo" })).toBeInTheDocument();
  else expect(within(empty).queryByRole("button", { name: "Anexar laudo" })).not.toBeInTheDocument();

  if (attach) await user.click(within(empty).getByRole("button", { name: "Anexar laudo" }));
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

test("todo exame com documento abre o PDF pela linha, em qualquer estado da análise", async () => {
  const user = userEvent.setup();
  const onOpenDocument = vi.fn().mockResolvedValue(undefined);
  const { props } = setup({
    pages: [{
      items: [
        exam("failed", "Função tireoidiana", "Falhou"),
        exam("stored", "Ultrassom", "Sem análise"),
        exam("legacy", "Glicemia", "Cancelado", false),
      ],
      nextCursor: null,
      capabilities: { canAttachDocument: true },
    }],
    hasNextPage: false,
    onOpenDocument,
  });

  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
    .toEqual(["Análise com falha", "Documentos sem análise", "Cancelados"]);
  // Registro cancelado antigo, que nunca recebeu laudo, não tem o que abrir.
  const documentButtons = screen.getAllByRole("button", { name: "Abrir PDF" });
  expect(documentButtons).toHaveLength(2);
  expect(documentButtons[0]).toHaveAccessibleDescription("Função tireoidiana");
  expect(documentButtons[1]).toHaveAccessibleDescription("Ultrassom");

  await user.click(documentButtons[0]);

  expect(onOpenDocument).toHaveBeenCalledWith("failed");
  // Abrir o PDF não troca o exame selecionado.
  expect(props.onSelect).not.toHaveBeenCalled();
});

test("avisa quando o PDF não abre e mantém a lista", async () => {
  const user = userEvent.setup();
  setup({
    pages: [{
      items: [exam("stored", "Ultrassom", "Sem análise")],
      nextCursor: null,
      capabilities: { canAttachDocument: true },
    }],
    hasNextPage: false,
    onOpenDocument: vi.fn().mockRejectedValue(new Error("rede")),
  });

  await user.click(screen.getByRole("button", { name: "Abrir PDF" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("O laudo original está indisponível no momento.");
  expect(screen.getByText("Ultrassom")).toBeInTheDocument();
});

test("o filtro de status usa os rótulos da tela, incluindo documento sem análise", () => {
  setup();
  const status = screen.getByRole("combobox", { name: "Status" });
  expect(within(status).getByRole("option", { name: "Análise falhou" })).toHaveValue("Falhou");
  expect(within(status).getByRole("option", { name: "Sem análise" })).toHaveValue("Sem análise");
});
