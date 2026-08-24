import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Member } from "../../api/types";
import { emptyPatientForm } from "./patientForm";
import { PatientRegistrationForm } from "./PatientRegistrationForm";

const doctors: Member[] = [
  {
    userId: "d-1",
    email: "medica@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    specialty: "Cardiologia",
  },
];

describe("PatientRegistrationForm", () => {
  test("valida a identificação e preserva os valores ao voltar", async () => {
    const user = userEvent.setup();
    render(
      <PatientRegistrationForm
        initialValue={emptyPatientForm}
        doctors={doctors}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Etapas do cadastro do paciente" }),
    ).toBeVisible();
    expect(screen.getByText("Identificação")).toBeVisible();
    expect(screen.getByText("Dados clínicos")).toBeVisible();
    expect(screen.getByText("Atendimento")).toBeVisible();
    expect(screen.getByText("Identificação").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("heading", { name: "Identifique o paciente" })).toBeVisible();

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: "Dados clínicos" })).toBeVisible();
    await user.type(screen.getByLabelText("Data de nascimento"), "1984-03-12");
    await user.selectOptions(screen.getByLabelText("Tipo sanguíneo"), "ABNegative");
    await user.selectOptions(
      screen.getByLabelText("Sexo para referência laboratorial"),
      "Feminino",
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Organize o atendimento" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue("1984-03-12");
    expect(screen.getByLabelText("Tipo sanguíneo")).toHaveValue("ABNegative");
    expect(screen.getByLabelText("Sexo para referência laboratorial")).toHaveValue(
      "Feminino",
    );
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Oliveira");
    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue("BR");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(11) 99999-0000");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
  });

  test.each([
    ["Nome completo", "Informe o nome completo."],
    ["WhatsApp", "Informe um WhatsApp válido para o país selecionado."],
    ["CPF", "Informe um CPF válido."],
  ])("bloqueia o avanço quando somente %s está inválido", async (invalidField, message) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PatientRegistrationForm
        initialValue={emptyPatientForm}
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    if (invalidField !== "Nome completo") {
      await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    }
    if (invalidField !== "WhatsApp") {
      await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    }
    if (invalidField !== "CPF") {
      await user.type(screen.getByLabelText("CPF"), "52998224725");
    }
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Identifique o paciente" })).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submete os dados finais e apresenta o estado pendente", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const view = render(
      <PatientRegistrationForm
        initialValue={emptyPatientForm}
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.selectOptions(
      screen.getByLabelText("Sexo para referência laboratorial"),
      "Feminino",
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));
    expect(await screen.findByText("Selecione o médico responsável.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Médico responsável"), "d-1");
    await user.type(screen.getByLabelText("Observações"), "Retorno em 30 dias");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...emptyPatientForm,
      name: "Marina Oliveira",
      phone: "+5511999990000",
      cpf: "529.982.247-25",
      sexForClinicalUse: "Feminino",
      doctorUserId: "d-1",
      notes: "Retorno em 30 dias",
    });

    view.rerender(
      <PatientRegistrationForm
        initialValue={emptyPatientForm}
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending
        serverError={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Salvando paciente…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });
});
