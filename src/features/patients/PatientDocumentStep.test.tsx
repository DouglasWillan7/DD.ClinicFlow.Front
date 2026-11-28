import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { emptyPatientDocument } from "./patientForm";
import { PatientDocumentStep } from "./PatientDocumentStep";

function renderStep(onSubmit = vi.fn()) {
  render(
    <PatientDocumentStep
      initialValue={emptyPatientDocument}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      pending={false}
      serverError={null}
    />,
  );
  return onSubmit;
}

describe("PatientDocumentStep", () => {
  test("não consulta um CPF incompleto", async () => {
    const user = userEvent.setup();
    const onSubmit = renderStep();
    await user.type(screen.getByLabelText("Documento"), "5299822");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um CPF com 11 dígitos.")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("trocar o país troca o tipo para um documento daquele país", async () => {
    const user = userEvent.setup();
    const onSubmit = renderStep();
    await user.selectOptions(screen.getByLabelText("País do documento"), "PT");
    expect(screen.getByLabelText("Tipo de documento")).toHaveValue("NIF");

    await user.type(screen.getByLabelText("Documento"), "123456789");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onSubmit).toHaveBeenCalledWith({
      documentCountryCode: "PT",
      documentType: "NIF",
      document: "123456789",
    });
  });
});
