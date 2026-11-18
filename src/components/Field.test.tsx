import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Field, PasswordField, TextAreaField } from "./Field";

test("liga rótulo, erro e controle; o id cai para o nome do campo", () => {
  render(<Field label="Nome completo" name="name" error="Informe o nome." />);

  const input = screen.getByLabelText("Nome completo");
  expect(input).toHaveAttribute("id", "name");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Informe o nome.");
});

test("dois campos sem id nem nome não dividem o mesmo rótulo", () => {
  render(
    <>
      <Field label="Início" />
      <Field label="Fim" />
    </>,
  );

  expect(screen.getByLabelText("Início")).not.toBe(screen.getByLabelText("Fim"));
  expect(screen.getByLabelText("Início").id).not.toBe(screen.getByLabelText("Fim").id);
});

test("área de texto usa o mesmo contrato de rótulo e dica", () => {
  render(<TextAreaField label="Observações" name="notes" hint="Opcional." />);

  const textarea = screen.getByLabelText("Observações");
  expect(textarea.tagName).toBe("TEXTAREA");
  expect(textarea).toHaveAccessibleDescription("Opcional.");
});

test("senha alterna a visibilidade e o conteúdo ao lado fica fora do rótulo", async () => {
  const user = userEvent.setup();
  render(
    <PasswordField
      label="Senha"
      name="password"
      labelAside={<button type="button">Esqueci minha senha</button>}
    />,
  );

  // O rótulo continua exato: o atalho ao lado não entra no nome do campo.
  const input = screen.getByLabelText("Senha");
  expect(input).toHaveAttribute("type", "password");

  const toggle = screen.getByRole("button", { name: "Mostrar senha" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await user.click(toggle);

  expect(input).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("um campo de senha pode seguir a visibilidade de outro, sem botão próprio", () => {
  render(<PasswordField label="Repita sua senha" name="confirmation" visible toggle={false} />);

  expect(screen.getByLabelText("Repita sua senha")).toHaveAttribute("type", "text");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
