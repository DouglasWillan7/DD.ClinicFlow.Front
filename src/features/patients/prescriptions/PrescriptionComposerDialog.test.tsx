import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type { Prescription } from "../../../api/types";
import { UnsavedChangesProvider } from "../../../app/unsavedChanges";
import {
  PrescriptionComposerDialog,
  type PrescriptionComposerDialogProps,
} from "./PrescriptionComposerDialog";

const issued: Prescription = {
  id: "rx-new",
  patientId: "patient-1",
  content: "Dipirona 500 mg",
  status: "Issued",
  version: 1,
  issuedAtUtc: "2026-08-12T17:30:00Z",
  issuedByUserId: "doctor-1",
  issuedByName: "Dra. Ana Martins",
  issuedByRegistration: "CRM-SP 123456",
  cancelledAtUtc: null,
  cancelledByUserId: null,
  capabilities: { canCancel: true },
};

const onIssue = vi.fn<PrescriptionComposerDialogProps["onIssue"]>();
const onIssued = vi.fn<PrescriptionComposerDialogProps["onIssued"]>();
const onClose = vi.fn<PrescriptionComposerDialogProps["onClose"]>();

function renderDialog(base: PrescriptionComposerDialogProps["base"] = null) {
  return render(
    <UnsavedChangesProvider>
      <PrescriptionComposerDialog
        patientName="Rita de Cássia Alves"
        base={base}
        onIssue={onIssue}
        onIssued={onIssued}
        onClose={onClose}
      />
    </UnsavedChangesProvider>,
  );
}

beforeEach(() => {
  onIssue.mockReset();
  onIssued.mockReset();
  onClose.mockReset();
  onIssue.mockResolvedValue(issued);
});

test("avisa antes de emitir que a receita não poderá ser editada e foca o texto", async () => {
  renderDialog();

  const dialog = screen.getByRole("dialog", { name: "Nova receita" });
  expect(dialog).toHaveAccessibleDescription("Paciente: Rita de Cássia Alves.");
  expect(screen.getByText("Depois de emitida, a receita não pode ser editada.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Emitir receita" })).toHaveAccessibleDescription(
    "Depois de emitida, a receita não pode ser editada.",
  );
  expect(screen.getByRole("textbox", { name: "Texto da receita" })).toHaveValue("");
  // O foco vai ao campo depois que o <dialog> abre (setFocus agenda para o próximo ciclo).
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Texto da receita" })).toHaveFocus());
  expect(screen.getByText("0 de 5.000 caracteres")).toBeVisible();
});

test("não emite sem texto e explica o que falta junto ao campo", async () => {
  const user = userEvent.setup();
  renderDialog();

  await user.click(screen.getByRole("button", { name: "Emitir receita" }));

  const field = screen.getByRole("textbox", { name: "Texto da receita" });
  expect(await screen.findByText("Escreva o texto da receita.")).toBeVisible();
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAccessibleDescription("Escreva o texto da receita.");
  expect(onIssue).not.toHaveBeenCalled();
});

test("emite o texto com as quebras de linha digitadas", async () => {
  const user = userEvent.setup();
  renderDialog();

  await user.type(
    screen.getByRole("textbox", { name: "Texto da receita" }),
    "Dipirona 500 mg{enter}Tomar 1 comprimido se dor.",
  );
  expect(screen.getByText("42 de 5.000 caracteres")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Emitir receita" }));

  await waitFor(() => expect(onIssued).toHaveBeenCalledWith(issued));
  expect(onIssue).toHaveBeenCalledWith("Dipirona 500 mg\nTomar 1 comprimido se dor.");
  expect(onClose).not.toHaveBeenCalled();
});

test("usar como base copia o texto e emite uma receita nova com o ajuste", async () => {
  const user = userEvent.setup();
  renderDialog({ content: "Amoxicilina 500 mg\nPor 7 dias.", issuedOn: "12/08/2026" });

  expect(screen.getByRole("dialog", { name: "Nova receita" })).toHaveAccessibleDescription(
    "Paciente: Rita de Cássia Alves. Texto copiado da receita de 12/08/2026; a original continua como está.",
  );
  const field = screen.getByRole("textbox", { name: "Texto da receita" });
  expect(field).toHaveValue("Amoxicilina 500 mg\nPor 7 dias.");

  await user.clear(field);
  await user.type(field, "Amoxicilina 500 mg{enter}Por 10 dias.");
  await user.click(screen.getByRole("button", { name: "Emitir receita" }));

  await waitFor(() => expect(onIssue).toHaveBeenCalledWith("Amoxicilina 500 mg\nPor 10 dias."));
});

test("texto copiado da base e não alterado fecha sem pedir confirmação", async () => {
  const user = userEvent.setup();
  renderDialog({ content: "Amoxicilina 500 mg", issuedOn: "12/08/2026" });

  await user.click(screen.getByRole("button", { name: "Fechar" }));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog", { name: "Descartar alterações?" })).not.toBeInTheDocument();
});

test("fechar com texto digitado pede confirmação e preserva o texto ao continuar", async () => {
  const user = userEvent.setup();
  renderDialog();

  const field = screen.getByRole("textbox", { name: "Texto da receita" });
  await user.type(field, "Losartana 50 mg");
  await user.keyboard("{Escape}");

  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByRole("dialog", { name: "Descartar alterações?" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Nova receita" })).toHaveAttribute("open");
  expect(field).toHaveValue("Losartana 50 mg");

  await user.click(screen.getByRole("button", { name: "Fechar nova receita" }));
  await user.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("erro de validação da API aparece no campo", async () => {
  const user = userEvent.setup();
  onIssue.mockRejectedValue(
    new ApiError("O texto da receita é obrigatório.", 400, {
      errors: { Content: ["O texto da receita é obrigatório."] },
    }),
  );
  renderDialog();

  await user.type(screen.getByRole("textbox", { name: "Texto da receita" }), "x");
  await user.click(screen.getByRole("button", { name: "Emitir receita" }));

  expect(await screen.findByText("O texto da receita é obrigatório.")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Texto da receita" })).toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onIssued).not.toHaveBeenCalled();
});

test("outra falha mantém o texto e mostra o motivo", async () => {
  const user = userEvent.setup();
  onIssue.mockRejectedValue(new ApiError("Usuário sem acesso clínico ao paciente.", 403));
  renderDialog();

  const field = screen.getByRole("textbox", { name: "Texto da receita" });
  await user.type(field, "Losartana 50 mg");
  await user.click(screen.getByRole("button", { name: "Emitir receita" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Usuário sem acesso clínico ao paciente.");
  expect(field).toHaveValue("Losartana 50 mg");
  expect(onIssued).not.toHaveBeenCalled();
});
