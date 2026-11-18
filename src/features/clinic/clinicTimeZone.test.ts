import { formatDateTimeInZone, timeZoneLabel } from "./clinicTimeZone";

test("nomeia o fuso como a equipe o reconhece, sem identificador técnico", () => {
  expect(timeZoneLabel("America/Sao_Paulo")).toBe("Brasília (São Paulo)");
  expect(timeZoneLabel("America/Cuiaba")).toBe("Cuiabá");
  // Fuso fora da lista (clínica no exterior): só a cidade, sem sublinhado.
  expect(timeZoneLabel("America/New_York")).toBe("New York");
});

test("formata o instante UTC no fuso da clínica, não no do navegador", () => {
  // 01:30 UTC ainda é o dia anterior em Brasília.
  expect(formatDateTimeInZone("2026-08-10T01:30:00Z", "America/Sao_Paulo")).toMatch(
    /^09\/08\/2026,? 22:30$/,
  );
  expect(formatDateTimeInZone("2026-08-10T01:30:00Z", "America/Manaus")).toMatch(
    /^09\/08\/2026,? 21:30$/,
  );
});

test("devolve null para data ausente ou inválida", () => {
  expect(formatDateTimeInZone(null, "America/Sao_Paulo")).toBeNull();
  expect(formatDateTimeInZone("não é data", "America/Sao_Paulo")).toBeNull();
});
