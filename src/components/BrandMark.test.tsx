import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  test("usa o logotipo completo nos contextos amplos", () => {
    render(<BrandMark />);

    const mark = screen.getByRole("img", { name: "ClinicFlow" });
    expect(mark.querySelector("img")).toHaveAttribute(
      "src",
      "/clinicflow-logo.png",
    );
  });

  test("usa o símbolo oficial nos contextos compactos", () => {
    render(<BrandMark compact />);

    const mark = screen.getByRole("img", { name: "ClinicFlow" });
    expect(mark.querySelector("img")).toHaveAttribute(
      "src",
      "/clinicflow-icon.png",
    );
  });
});
