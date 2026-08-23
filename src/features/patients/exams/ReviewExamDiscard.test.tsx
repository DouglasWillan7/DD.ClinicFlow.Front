import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import { ReviewExamDiscard } from "./ReviewExamDiscard";

test("explica o descarte auditável e permite desistir com restauração de foco", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} />);

  const trigger = screen.getByRole("button", { name: "Descartar exame" });
  trigger.focus();
  await user.click(trigger);

  const confirmation = screen.getByRole("region", { name: "Confirmar descarte do exame" });
  expect(confirmation).toHaveTextContent("retirado da lista principal");
  expect(confirmation).toHaveTextContent("documento e a revisão continuarão registrados para auditoria");
  expect(screen.getByRole("heading", { name: "Confirmar descarte do exame" })).toHaveFocus();

  await user.click(screen.getByRole("button", { name: "Manter exame" }));
  expect(onDiscard).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Descartar exame" })).toHaveFocus();
});

test("Escape fecha a confirmação sem descartar", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar exame" }));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("region", { name: "Confirmar descarte do exame" })).not.toBeInTheDocument();
  expect(onDiscard).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Descartar exame" })).toHaveFocus();
});

test("submete uma única vez e anuncia o estado pendente", async () => {
  const user = userEvent.setup();
  let resolveDiscard: () => void = () => undefined;
  const onDiscard = vi.fn(() => new Promise<void>((resolve) => {
    resolveDiscard = resolve;
  }));
  render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar exame" }));
  const confirm = screen.getAllByRole("button", { name: "Descartar exame" })[0];
  await user.dblClick(confirm);

  expect(onDiscard).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  expect(screen.getByRole("button", { name: "Manter exame" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Descartando exame…");
  resolveDiscard();
  await waitFor(() => expect(confirm).not.toHaveAttribute("aria-busy", "true"));
});

test("mantém a revisão e oferece recarga explícita no conflito", async () => {
  const user = userEvent.setup();
  const onReload = vi.fn();
  const onDiscard = vi.fn().mockRejectedValue(new ApiError("Conflito", 409, { currentVersion: 8 }));
  render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} onReload={onReload} />);

  await user.click(screen.getByRole("button", { name: "Descartar exame" }));
  await user.click(screen.getAllByRole("button", { name: "Descartar exame" })[0]);

  expect(await screen.findByRole("alert")).toHaveTextContent("Este exame foi atualizado por outra pessoa.");
  expect(screen.getByRole("region", { name: "Confirmar descarte do exame" })).toBeInTheDocument();
  expect(onReload).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Recarregar dados atuais" }));
  expect(onReload).toHaveBeenCalledOnce();
});

test("anuncia erro genérico sem fechar a revisão", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn().mockRejectedValue(new ApiError("Falha", 503));
  render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar exame" }));
  await user.click(screen.getAllByRole("button", { name: "Descartar exame" })[0]);

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível descartar o exame. Tente novamente.");
  expect(screen.getByRole("region", { name: "Confirmar descarte do exame" })).toBeInTheDocument();
});

test("não atualiza estado local depois de desmontar durante o descarte", async () => {
  const user = userEvent.setup();
  let rejectDiscard: (reason: unknown) => void = () => undefined;
  const onDiscard = vi.fn(() => new Promise<void>((_resolve, reject) => {
    rejectDiscard = reject;
  }));
  const { unmount } = render(<ReviewExamDiscard examId="exam-1" onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Descartar exame" }));
  await user.click(screen.getAllByRole("button", { name: "Descartar exame" })[0]);
  unmount();
  rejectDiscard(new ApiError("Conflito tardio", 409));

  await Promise.resolve();
  expect(onDiscard).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
