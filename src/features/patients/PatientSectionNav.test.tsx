import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { PatientSectionNav } from "./PatientSectionNav";

vi.mock("../../app/navigation", () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("PatientSectionNav", () => {
  test("expõe exatamente os três destinos no escopo do paciente", () => {
    render(<PatientSectionNav patientId="patient-7" activeSection="overview" />);

    expect(screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]))
      .toEqual([
        ["Visão geral", "/app/pacientes/patient-7"],
        ["Avaliações físicas", "/app/pacientes/patient-7/avaliacoes"],
        ["Exames", "/app/pacientes/patient-7/exames"],
      ]);
  });

  test.each([
    ["overview", "Visão geral"],
    ["assessments", "Avaliações físicas"],
    ["exams", "Exames"],
  ] as const)("marca somente %s como página atual", (activeSection, label) => {
    render(<PatientSectionNav patientId="patient-7" activeSection={activeSection} />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current")))
      .toHaveLength(1);
  });

  test("identifica semanticamente a navegação entre seções do paciente", () => {
    render(<PatientSectionNav patientId="patient-7" activeSection="exams" />);

    expect(screen.getByRole("navigation", { name: "Seções do paciente" }))
      .toContainElement(screen.getByRole("link", { name: "Exames" }));
  });
});
