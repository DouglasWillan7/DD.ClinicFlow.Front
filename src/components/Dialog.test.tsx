import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

test("abre nomeado pelo título, descrito pelo texto e fecha pelo botão", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog
      title="Nova avaliação"
      description="Registre as medidas de hoje."
      closeLabel="Fechar nova avaliação"
      onClose={onClose}
    >
      <p>Conteúdo</p>
    </Dialog>,
  );

  const dialog = screen.getByRole("dialog", { name: "Nova avaliação" });
  expect(dialog).toHaveAccessibleDescription("Registre as medidas de hoje.");
  expect(dialog.tagName).toBe("DIALOG");

  await user.click(screen.getByRole("button", { name: "Fechar nova avaliação" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Esc fecha; durante uma operação o diálogo não pode ser dispensado", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const { rerender } = render(
    <Dialog title="Anexar laudo" onClose={onClose}>
      <button type="button">Escolher arquivo</button>
    </Dialog>,
  );

  screen.getByRole("button", { name: "Escolher arquivo" }).focus();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);

  rerender(
    <Dialog title="Anexar laudo" dismissible={false} onClose={onClose}>
      <button type="button">Escolher arquivo</button>
    </Dialog>,
  );
  screen.getByRole("button", { name: "Escolher arquivo" }).focus();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
});

test("clique no fundo fecha; clique no conteúdo não", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog title="Selecionar paciente" onClose={onClose}>
      <p>Lista</p>
    </Dialog>,
  );

  await user.click(screen.getByText("Lista"));
  expect(onClose).not.toHaveBeenCalled();

  await user.click(screen.getByRole("dialog"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("confirmação sem botão fechar deixa a decisão no rodapé", () => {
  render(
    <Dialog
      role="alertdialog"
      title="Remover avaliação?"
      closeLabel={null}
      onClose={() => undefined}
      footer={<Button variant="danger">Remover</Button>}
    />,
  );

  const dialog = screen.getByRole("alertdialog", { name: "Remover avaliação?" });
  expect(dialog).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remover" })).toBeVisible();
});

test("fechar é um pedido: se quem controla recusa, o diálogo continua aberto", async () => {
  // jsdom não implementa close(); o dublê reproduz o efeito do navegador.
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  const original = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = close;
  try {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog title="Nova receita" onClose={onClose}>
        <textarea aria-label="Texto" />
      </Dialog>,
    );

    screen.getByRole("textbox", { name: "Texto" }).focus();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Nova receita" })).toHaveAttribute("open");

    // Ao sair da árvore, o fechamento nativo acontece (e devolve o foco).
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    HTMLDialogElement.prototype.close = original;
  }
});

test("fechado não deixa nada na árvore", () => {
  render(<Dialog open={false} title="Oculto" onClose={() => undefined} />);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
