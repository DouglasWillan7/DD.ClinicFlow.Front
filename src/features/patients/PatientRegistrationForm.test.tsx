import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { emptyPatientForm } from "./patientForm";
import { PatientRegistrationForm } from "./PatientRegistrationForm";

function renderRegistration(onSubmit = vi.fn()) {
  render(
    <PatientRegistrationForm
      initialValue={emptyPatientForm}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      pending={false}
      serverError={null}
    />,
  );
  return onSubmit;
}

async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
  await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
  await user.type(screen.getByLabelText("Documento"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "marina@example.test");
}

describe("PatientRegistrationForm", () => {
  test("separa cadastro do paciente e consentimento médico", async () => {
    const user = userEvent.setup();
    renderRegistration();
    await fillIdentity(user);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Dados clínicos" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: "Organize o atendimento" })).toBeVisible();
    expect(screen.getByText(/acesso médico nasce apenas do consentimento/i)).toBeVisible();
    expect(screen.queryByLabelText(/médico responsável/i)).not.toBeInTheDocument();
  });

  test("preserva os campos ao voltar e submete o documento canônico", async () => {
    const user = userEvent.setup();
    const onSubmit = renderRegistration();
    await fillIdentity(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.selectOptions(screen.getByLabelText("Tipo sanguíneo"), "ABNegative");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Observações"), "Alergia registrada");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...emptyPatientForm,
      name: "Marina Oliveira",
      phone: "+5511999990000",
      document: "52998224725",
      email: "marina@example.test",
      bloodType: "ABNegative",
      notes: "Alergia registrada",
    });
  });

  test("não avança sem identidade e contato válidos", async () => {
    const user = userEvent.setup();
    renderRegistration();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: "Identifique o paciente" })).toBeVisible();
    expect(await screen.findByText("Informe o nome completo.")).toBeVisible();
  });
});
