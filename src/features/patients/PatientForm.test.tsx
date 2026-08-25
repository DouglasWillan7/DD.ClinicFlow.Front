import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PatientForm } from "./PatientForm.tsx";
import { emptyPatientForm, type PatientFormValue } from "./patientForm";

function renderForm(initialValue: PatientFormValue = emptyPatientForm) {
  const onSubmit = vi.fn();
  render(
    <PatientForm
      initialValue={initialValue}
      submitLabel="Salvar paciente"
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      pending={false}
      serverError={null}
    />,
  );
  return onSubmit;
}

describe("PatientForm", () => {
  test("cadastra identidade internacional sem vínculo prévio com médico", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText("Nome completo"), "Marina Oliveira");
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.type(screen.getByLabelText("Documento"), "52998224725");
    await user.type(screen.getByLabelText("E-mail"), "marina@example.test");
    await user.click(screen.getByRole("button", { name: "Salvar paciente" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...emptyPatientForm,
      name: "Marina Oliveira",
      phone: "+5511999990000",
      document: "52998224725",
      email: "marina@example.test",
    });
    expect(screen.queryByLabelText(/médico responsável/i)).not.toBeInTheDocument();
  });

  test("preenche documentos estrangeiros sem formatação brasileira", () => {
    renderForm({
      ...emptyPatientForm,
      name: "Inês Carvalho",
      phone: "+351912345678",
      documentCountryCode: "PT",
      documentType: "NIF",
      document: "123456789",
      email: "ines@example.test",
    });

    expect(screen.getByLabelText("País do documento")).toHaveValue("PT");
    expect(screen.getByLabelText("Tipo de documento")).toHaveValue("NIF");
    expect(screen.getByLabelText("Documento")).toHaveValue("123456789");
    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue("PT");
  });

  test("mostra os dados clínicos opcionais e o erro da API", () => {
    render(
      <PatientForm
        initialValue={emptyPatientForm}
        submitLabel="Salvar paciente"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
        serverError="Documento já cadastrado."
      />,
    );

    expect(screen.getByRole("option", { name: "AB-" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Feminino" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Documento já cadastrado.");
  });
});
