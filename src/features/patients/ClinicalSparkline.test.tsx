import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import type { ClinicalExamHistoryPoint } from "../../api/types";
import { ClinicalSparkline } from "./ClinicalSparkline";

const points: ClinicalExamHistoryPoint[] = [
  {
    date: "2025-12-10",
    numericValue: 281,
    valueText: "281",
    outOfRange: false,
  },
  {
    date: "2026-03-23",
    numericValue: 294,
    valueText: "294",
    outOfRange: false,
  },
  {
    date: "2026-07-29",
    numericValue: 562,
    valueText: "562",
    outOfRange: true,
  },
];

test("sparkline associa data, valor, unidade e estado na série textual", () => {
  render(
    <ClinicalSparkline
      label="CPK"
      unit="U/L"
      referenceState="elevado"
      points={points}
    />,
  );

  expect(
    screen.getByRole("img", {
      name: /CPK.*10\/12\/2025, 281 U\/L.*23\/03\/2026, 294 U\/L.*29\/07\/2026, 562 U\/L.*resultado mais recente: Elevado/i,
    }),
  ).toBeVisible();
});

test("mantém valores textuais sem número na alternativa acessível", () => {
  render(
    <ClinicalSparkline
      label="Anticorpos"
      points={[
        {
          date: "2026-07-29",
          numericValue: null,
          valueText: "Não reagente",
          outOfRange: false,
        },
      ]}
    />,
  );

  expect(
    screen.getByRole("img", { name: /Anticorpos.*Não reagente/i }),
  ).toBeVisible();
});
