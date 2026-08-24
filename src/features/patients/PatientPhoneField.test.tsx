import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PatientPhoneField } from "./PatientPhoneField";

describe("PatientPhoneField", () => {
  test("inicia no Brasil, mascara a digitação e emite E.164", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PatientPhoneField
        name="phone"
        value=""
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue(
      "BR",
    );
    expect(screen.getByText("🇧🇷")).toBeVisible();
    expect(screen.getByText("+55")).toBeVisible();

    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");

    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(11) 99999-0000");
    expect(onChange).toHaveBeenLastCalledWith("+5511999990000");
  });

  test("troca o país, preserva os dígitos e usa a máscara selecionada", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PatientPhoneField
        name="phone"
        value=""
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText("WhatsApp"), "912345678");
    await user.selectOptions(
      screen.getByLabelText("País ou região do WhatsApp"),
      "PT",
    );

    expect(screen.getByText("🇵🇹")).toBeVisible();
    expect(screen.getByText("+351")).toBeVisible();
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("912 345 678");
    expect(onChange).toHaveBeenLastCalledWith("+351912345678");
  });

  test("reconhece o país e a máscara de um telefone existente", () => {
    render(
      <PatientPhoneField
        name="phone"
        value="+12133734253"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue(
      "US",
    );
    expect(screen.getByText("+1")).toBeVisible();
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(213) 373-4253");
  });

  test("detecta o país ao colar um telefone internacional", () => {
    const onChange = vi.fn();
    render(
      <PatientPhoneField
        name="phone"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "+447400123456" },
    });

    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue(
      "GB",
    );
    expect(screen.getByText("+44")).toBeVisible();
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("07400 123456");
    expect(onChange).toHaveBeenLastCalledWith("+447400123456");
  });
});
