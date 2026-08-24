import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCountries } from "libphonenumber-js";
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

    const phone = screen.getByLabelText("WhatsApp");
    await user.type(phone, "1199999");
    expect(phone).toHaveValue("(11) 99999");
    await user.type(phone, "0000");

    expect(phone).toHaveValue("(11) 99999-0000");
    expect(onChange).toHaveBeenLastCalledWith("+5511999990000");
  });

  test("oferece o catálogo completo com nome, bandeira e DDI", () => {
    render(
      <PatientPhoneField
        name="phone"
        value=""
        onChange={vi.fn()}
      />,
    );

    const country = screen.getByLabelText(
      "País ou região do WhatsApp",
    ) as HTMLSelectElement;
    expect(country.options).toHaveLength(getCountries().length);
    expect(
      Array.from(country.options).some(
        (option) => option.textContent === "🇧🇷 Brasil (+55)",
      ),
    ).toBe(true);
    expect(
      Array.from(country.options).some(
        (option) => option.textContent === "🇵🇹 Portugal (+351)",
      ),
    ).toBe(true);
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

  test("reconhece telefone legado sem o sinal de mais", () => {
    render(
      <PatientPhoneField
        name="phone"
        value="5511999990000"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("País ou região do WhatsApp")).toHaveValue(
      "BR",
    );
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(11) 99999-0000");
  });

  test("mantém o país e emite vazio quando o número é apagado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PatientPhoneField
        name="phone"
        value=""
        onChange={onChange}
      />,
    );

    const country = screen.getByLabelText("País ou região do WhatsApp");
    const phone = screen.getByLabelText("WhatsApp");
    await user.selectOptions(country, "PT");
    await user.type(phone, "912345678");
    await user.clear(phone);

    expect(country).toHaveValue("PT");
    expect(phone).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith("");
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
