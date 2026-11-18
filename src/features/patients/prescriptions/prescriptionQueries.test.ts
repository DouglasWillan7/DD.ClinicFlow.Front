import { expect, test } from "vitest";
import type { Prescription, PrescriptionList } from "../../../api/types";
import {
  prependPrescription,
  prescriptionKeys,
  prescriptionPreview,
  prescriptionStatusLabels,
  replacePrescription,
} from "./prescriptionQueries";

function prescription(id: string, overrides: Partial<Prescription> = {}): Prescription {
  return {
    id,
    patientId: "patient-1",
    content: "Dipirona 500 mg",
    status: "Issued",
    version: 1,
    issuedAtUtc: "2026-08-12T17:30:00Z",
    issuedByUserId: "doctor-1",
    issuedByName: "Dra. Ana Martins",
    issuedByRegistration: "CRM-SP 123456",
    cancelledAtUtc: null,
    cancelledByUserId: null,
    capabilities: { canCancel: true },
    ...overrides,
  };
}

test("a lista fica sob o prefixo do paciente", () => {
  expect(prescriptionKeys.list("patient-1")).toEqual(["patients", "patient-1", "prescriptions"]);
});

test("rótulos em pt-BR para cada estado do enum", () => {
  expect(prescriptionStatusLabels).toEqual({ Issued: "Emitida", Cancelled: "Cancelada" });
});

test("prévia achata as quebras de linha e corta numa palavra", () => {
  expect(prescriptionPreview("Dipirona 500 mg\n\nTomar  se dor.")).toBe("Dipirona 500 mg Tomar se dor.");

  const long = `${"Paracetamol 750 mg ".repeat(10)}fim`;
  const preview = prescriptionPreview(long);
  expect(preview.length).toBeLessThanOrEqual(121);
  expect(preview.endsWith("…")).toBe(true);
  expect(preview).not.toMatch(/\s…$/);
  expect(long.startsWith(preview.slice(0, -1))).toBe(true);
});

test("receita emitida entra no topo sem duplicar", () => {
  const list: PrescriptionList = { items: [prescription("a")], capabilities: { canIssue: true } };

  expect(prependPrescription(list, prescription("b"))?.items.map((item) => item.id)).toEqual(["b", "a"]);
  expect(prependPrescription(list, prescription("a"))?.items).toHaveLength(1);
  expect(prependPrescription(undefined, prescription("b"))).toBeUndefined();
});

test("cancelamento troca só a receita devolvida pela API", () => {
  const list: PrescriptionList = {
    items: [prescription("a"), prescription("b")],
    capabilities: { canIssue: true },
  };
  const cancelled = prescription("b", { status: "Cancelled", version: 2, capabilities: { canCancel: false } });

  const next = replacePrescription(list, cancelled);
  expect(next?.items[0]).toBe(list.items[0]);
  expect(next?.items[1]).toBe(cancelled);
  expect(next?.capabilities).toEqual({ canIssue: true });
});
