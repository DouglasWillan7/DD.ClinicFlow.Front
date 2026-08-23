import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type { PatientExamDetail } from "../../../api/types";
import { FailedExamRecovery } from "./FailedExamRecovery";

const capabilities: PatientExamDetail["capabilities"] = {
  canEditRequest: false,
  canCancelRequest: false,
  canAttachDocument: false,
  canReprocess: true,
  canDiscardFailedExam: true,
  canDiscardExam: true,
  canOpenCorrection: false,
  canEditRevision: false,
  canClassify: false,
  canValidate: false,
};

const failedExam: PatientExamDetail = {
  id: "failed-exam",
  patientId: "patient-1",
  doctorUserId: "doctor-1",
  requestedByUserId: "doctor-1",
  name: "Hemograma completo",
  category: "Laboratório",
  scheduledOn: null,
  status: "Falhou",
  version: 7,
  error: "O documento não pôde ser lido.",
  createdAtUtc: "2026-08-09T10:00:00Z",
  updatedAtUtc: "2026-08-09T11:00:00Z",
  processedAtUtc: null,
  cancelledByUserId: null,
  cancelledAtUtc: null,
  document: {
    fileName: "laudo.pdf",
    contentType: "application/pdf",
    sizeBytes: 2_048,
    source: "Clínica",
    createdAtUtc: "2026-08-09T10:00:00Z",
    processingAttempts: 1,
  },
  activeRevision: null,
  draftRevision: null,
  attemptsRemaining: 2,
  capabilities,
};

test("não oferece descarte sem capability", () => {
  render(
    <FailedExamRecovery
      exam={{ ...failedExam, capabilities: { ...capabilities, canDiscardFailedExam: false } }}
      onDiscard={vi.fn()}
    />,
  );

  expect(screen.queryByRole("button", { name: "Descartar laudo" })).not.toBeInTheDocument();
});

test("confirma descarte com consequência explícita e permite desistir", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  render(<FailedExamRecovery exam={failedExam} onDiscard={onDiscard} />);

  const trigger = screen.getByRole("button", { name: "Descartar laudo" });
  trigger.focus();
  await user.click(trigger);

  const confirmation = screen.getByRole("region", { name: "Confirmar descarte do laudo" });
  expect(confirmation).toHaveTextContent("continuará registrado para auditoria");
  expect(screen.getByRole("heading", { name: "Confirmar descarte do laudo" })).toHaveFocus();

  await user.click(screen.getByRole("button", { name: "Manter laudo" }));
  expect(onDiscard).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Descartar laudo" })).toHaveFocus();
});

test("Escape cancela a confirmação e devolve foco ao gatilho", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  render(<FailedExamRecovery exam={failedExam} onDiscard={onDiscard} />);

  const trigger = screen.getByRole("button", { name: "Descartar laudo" });
  await user.click(trigger);
  await user.keyboard("{Escape}");

  expect(
    screen.queryByRole("region", { name: "Confirmar descarte do laudo" }),
  ).not.toBeInTheDocument();
  expect(onDiscard).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Descartar laudo" })).toHaveFocus();
});

test("confirma descarte uma única vez enquanto a operação está pendente", async () => {
  const user = userEvent.setup();
  let resolveDiscard: () => void = () => undefined;
  const onDiscard = vi.fn(() => new Promise<void>((resolve) => {
    resolveDiscard = resolve;
  }));
  render(<FailedExamRecovery exam={failedExam} onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar laudo" }));
  const confirm = screen.getByRole("button", { name: "Descartar e enviar novamente" });
  await user.dblClick(confirm);

  expect(onDiscard).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  expect(screen.getByRole("button", { name: "Manter laudo" })).toBeDisabled();
  resolveDiscard();
  await waitFor(() => expect(confirm).not.toHaveAttribute("aria-busy", "true"));
});

test("mantém confirmação e mostra erro regional quando o descarte falha", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn().mockRejectedValue(new ApiError("Serviço indisponível", 503));
  render(<FailedExamRecovery exam={failedExam} onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar laudo" }));
  await user.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));

  expect((await screen.findByText("Não foi possível descartar o laudo. Tente novamente.")).closest("[role='alert']"))
    .toHaveTextContent("Não foi possível descartar o laudo. Tente novamente.");
  expect(screen.getByRole("region", { name: "Confirmar descarte do laudo" })).toBeInTheDocument();
});

test("oferece recarga explícita no conflito de versão", async () => {
  const user = userEvent.setup();
  const onReload = vi.fn();
  const onDiscard = vi.fn().mockRejectedValue(new ApiError("Conflito técnico", 409, { currentVersion: 8 }));
  render(<FailedExamRecovery exam={failedExam} onDiscard={onDiscard} onReload={onReload} />);

  await user.click(screen.getByRole("button", { name: "Descartar laudo" }));
  await user.click(screen.getByRole("button", { name: "Descartar e enviar novamente" }));

  expect((await screen.findByText(/Este exame foi atualizado por outra pessoa/)).closest("[role='alert']"))
    .toHaveTextContent("Este exame foi atualizado por outra pessoa.");
  expect(onReload).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  expect(onReload).toHaveBeenCalledOnce();
});
