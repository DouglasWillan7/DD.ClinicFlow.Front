import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Member } from "../../api/types";
import { PatientForm } from "./PatientForm.tsx";
import { emptyPatientForm, type PatientFormValue } from "./patientForm";

const members: Member[] = [
  {
    userId: "d-1",
    email: "medica@example.test",
    roles: ["Doctor"],
    isCreator: false,
    name: "Dra. Helena Costa",
    specialty: "Cardiologia",
  },
];

describe("PatientForm", () => {
  test("exige CPF, oferece tipos sanguíneos e preserva valores após erro", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PatientForm
        initialValue={emptyPatientForm}
        doctors={members}
        submitLabel="Salvar paciente"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
        serverError="CPF já cadastrado"
      />,
    );

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.selectOptions(screen.getByLabelText("Médico responsável"), "d-1");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(await screen.findByText("Informe um CPF válido.")).toBeVisible();
    expect(screen.getByRole("option", { name: "AB-" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("CPF já cadastrado");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Oliveira");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("preenche edição incluindo CPF e tipo sanguíneo", () => {
    const initialValue: PatientFormValue = {
      name: "Marina Oliveira",
      phone: "+351912345678",
      cpf: "52998224725",
      bloodType: "ABNegative",
      sexForClinicalUse: "Feminino",
      doctorUserId: "d-1",
      birthDate: "1980-03-10",
      notes: "Retorno",
    };
    render(
      <PatientForm
        initialValue={initialValue}
        doctors={members}
        submitLabel="Salvar alterações"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue("PT");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("912 345 678");
    expect(screen.getByLabelText("Tipo sanguíneo")).toHaveValue("ABNegative");
    expect(screen.getByLabelText("Sexo para referência laboratorial")).toHaveValue(
      "Feminino",
    );
  });

  test("submete CPF mascarado e tipo sanguíneo selecionado", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PatientForm
        initialValue={emptyPatientForm}
        doctors={members}
        submitLabel="Salvar paciente"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.selectOptions(screen.getByLabelText("Tipo sanguíneo"), "ABNegative");
    await user.selectOptions(
      screen.getByLabelText("Sexo para referência laboratorial"),
      "Masculino",
    );
    await user.selectOptions(screen.getByLabelText("Médico responsável"), "d-1");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...emptyPatientForm,
      name: "Marina Oliveira",
      phone: "+5511999990000",
      cpf: "529.982.247-25",
      bloodType: "ABNegative",
      sexForClinicalUse: "Masculino",
      doctorUserId: "d-1",
    });
  });

  test("oferece feminino, masculino e não informado em um controle acessível", () => {
    render(
      <PatientForm
        initialValue={emptyPatientForm}
        doctors={members}
        submitLabel="Salvar paciente"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    const field = screen.getByLabelText("Sexo para referência laboratorial");
    expect(field).toHaveValue("");
    expect(screen.getByRole("option", { name: "Feminino" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Masculino" })).toBeVisible();
    expect(screen.getAllByRole("option", { name: "Não informado" })).toHaveLength(2);
  });

  test("permite remover o tipo sanguíneo opcional antes de salvar", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PatientForm
        initialValue={emptyPatientForm}
        doctors={members}
        submitLabel="Salvar paciente"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
        serverError={null}
      />,
    );

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.selectOptions(screen.getByLabelText("Tipo sanguíneo"), "ABNegative");
    await user.selectOptions(screen.getByLabelText("Tipo sanguíneo"), "");
    await user.selectOptions(screen.getByLabelText("Médico responsável"), "d-1");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...emptyPatientForm,
      name: "Marina Oliveira",
      phone: "+5511999990000",
      cpf: "529.982.247-25",
      doctorUserId: "d-1",
    });
  });
});
