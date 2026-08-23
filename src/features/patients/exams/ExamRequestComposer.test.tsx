import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type { PatientExamDetail } from "../../../api/types";
import { ExamRequestComposer } from "./ExamRequestComposer";

function detail(hasDocument = false): PatientExamDetail {
  return {
    id: "exam-1",
    patientId: "patient-1",
    doctorUserId: "doctor-1",
    requestedByUserId: "doctor-1",
    name: "Hemograma",
    category: "Laboratório",
    scheduledOn: "2026-08-15",
    status: "Solicitado",
    version: 3,
    error: null,
    createdAtUtc: "2026-08-01T10:00:00Z",
    updatedAtUtc: "2026-08-01T10:00:00Z",
    processedAtUtc: null,
    cancelledByUserId: null,
    cancelledAtUtc: null,
    document: hasDocument ? {
      fileName: "laudo.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      source: "Clínica",
      createdAtUtc: "2026-08-01T10:00:00Z",
      processingAttempts: 0,
    } : null,
    activeRevision: null,
    draftRevision: null,
    attemptsRemaining: 3,
    capabilities: {
      canEditRequest: !hasDocument,
      canCancelRequest: !hasDocument,
      canAttachDocument: !hasDocument,
      canReprocess: false,
      canDiscardFailedExam: false,
      canDiscardExam: false,
      canOpenCorrection: false,
      canEditRevision: false,
      canClassify: false,
      canValidate: false,
    },
  };
}

const baseProps: React.ComponentProps<typeof ExamRequestComposer> = {
  canRequest: true,
  openInitially: false,
  exam: null,
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onCancel: vi.fn(),
  onCompleted: vi.fn(),
  onReload: vi.fn(),
};

test("não renderiza comandos clínicos sem capacidade Doctor", () => {
  render(<ExamRequestComposer {...baseProps} canRequest={false} />);
  expect(screen.queryByRole("button", { name: "Solicitar exame" })).not.toBeInTheDocument();
});

test("abre composer inline e valida campos obrigatórios", async () => {
  const user = userEvent.setup();
  render(<ExamRequestComposer {...baseProps} />);
  await user.click(screen.getByRole("button", { name: "Solicitar exame" }));
  expect(screen.getByRole("region", { name: "Solicitar exame" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Criar solicitação" }));
  expect(await screen.findByText("Informe o nome do exame.")).toBeInTheDocument();
  expect(screen.getByText("Informe a categoria do exame.")).toBeInTheDocument();
});

test("cria solicitação com data passada e fecha/reset após sucesso", async () => {
  const user = userEvent.setup();
  const created = detail();
  const onCreate = vi.fn().mockResolvedValue(created);
  const onCompleted = vi.fn();
  render(<ExamRequestComposer {...baseProps} onCreate={onCreate} onCompleted={onCompleted} />);
  await user.click(screen.getByRole("button", { name: "Solicitar exame" }));
  await user.type(screen.getByLabelText("Nome do exame"), "Hemograma");
  await user.selectOptions(screen.getByLabelText("Categoria"), "Laboratório");
  await user.type(screen.getByLabelText("Data prevista (opcional)"), "2020-01-02");
  await user.click(screen.getByRole("button", { name: "Criar solicitação" }));

  await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
    name: "Hemograma",
    category: "Laboratório",
    scheduledOn: "2020-01-02",
  }));
  expect(onCompleted).toHaveBeenCalledWith(created);
  expect(screen.queryByRole("region", { name: "Solicitar exame" })).not.toBeInTheDocument();
});

test("prefill de edição envia versão esperada", async () => {
  const user = userEvent.setup();
  const exam = detail();
  const onUpdate = vi.fn().mockResolvedValue({ ...exam, version: 4 });
  render(<ExamRequestComposer {...baseProps} exam={exam} onUpdate={onUpdate} />);
  await user.click(screen.getByRole("button", { name: "Editar solicitação" }));
  expect(screen.getByLabelText("Nome do exame")).toHaveValue("Hemograma");
  await user.clear(screen.getByLabelText("Nome do exame"));
  await user.type(screen.getByLabelText("Nome do exame"), "Hemograma completo");
  await user.click(screen.getByRole("button", { name: "Salvar solicitação" }));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("exam-1", {
    name: "Hemograma completo",
    category: "Laboratório",
    scheduledOn: "2026-08-15",
    expectedVersion: 3,
  }));
});

test("oferece editar e cancelar somente antes do documento", () => {
  const { rerender } = render(<ExamRequestComposer {...baseProps} exam={detail()} />);
  expect(screen.getByRole("button", { name: "Editar solicitação" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancelar solicitação" })).toBeInTheDocument();
  rerender(<ExamRequestComposer {...baseProps} exam={detail(true)} />);
  expect(screen.queryByRole("button", { name: "Editar solicitação" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar solicitação" })).not.toBeInTheDocument();
});

test("cancela com a versão atual e notifica conclusão", async () => {
  const user = userEvent.setup();
  const exam = detail();
  const cancelled = { ...exam, status: "Cancelado" as const, version: 4 };
  const onCancel = vi.fn().mockResolvedValue(cancelled);
  const onCompleted = vi.fn();
  render(<ExamRequestComposer {...baseProps} exam={exam} onCancel={onCancel} onCompleted={onCompleted} />);
  await user.click(screen.getByRole("button", { name: "Cancelar solicitação" }));
  await waitFor(() => expect(onCancel).toHaveBeenCalledWith("exam-1", { expectedVersion: 3 }));
  expect(onCompleted).toHaveBeenCalledWith(cancelled);
});

test("409 preserva todos os campos e oferece recarregar dados atuais", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockRejectedValue(new ApiError("Conflito", 409, { currentVersion: 8 }));
  const onReload = vi.fn();
  render(<ExamRequestComposer {...baseProps} onCreate={onCreate} onReload={onReload} />);
  await user.click(screen.getByRole("button", { name: "Solicitar exame" }));
  await user.type(screen.getByLabelText("Nome do exame"), "Ultrassom abdominal");
  await user.selectOptions(screen.getByLabelText("Categoria"), "Imagem");
  await user.type(screen.getByLabelText("Data prevista (opcional)"), "2026-08-20");
  await user.click(screen.getByRole("button", { name: "Criar solicitação" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Os dados deste exame mudaram");
  expect(screen.getByLabelText("Nome do exame")).toHaveValue("Ultrassom abdominal");
  expect(screen.getByLabelText("Categoria")).toHaveValue("Imagem");
  expect(screen.getByLabelText("Data prevista (opcional)")).toHaveValue("2026-08-20");
  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test("erro de campo do servidor foca o controle correspondente", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockRejectedValue(new ApiError("Inválido", 400, {
    errors: { Name: ["Nome já utilizado."] },
  }));
  render(<ExamRequestComposer {...baseProps} onCreate={onCreate} />);
  await user.click(screen.getByRole("button", { name: "Solicitar exame" }));
  await user.type(screen.getByLabelText("Nome do exame"), "Hemograma");
  await user.selectOptions(screen.getByLabelText("Categoria"), "Laboratório");
  await user.click(screen.getByRole("button", { name: "Criar solicitação" }));
  expect(await screen.findByText("Nome já utilizado.")).toBeInTheDocument();
  expect(screen.getByLabelText("Nome do exame")).toHaveFocus();
});
