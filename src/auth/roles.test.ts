import { formatRoles, getRoles, hasRole } from "./roles";

describe("roles", () => {
  it("usa roles quando a API retorna múltiplas funções", () => {
    const subject = { roles: ["Admin", "Doctor"] as const };

    expect(getRoles(subject)).toEqual(["Admin", "Doctor"]);
    expect(hasRole(subject, "Doctor")).toBe(true);
    expect(formatRoles(subject)).toBe("Administração · Médico");
  });

  it("trata uma lista vazia sem inventar função", () => {
    const subject = { roles: [] };

    expect(getRoles(subject)).toEqual([]);
    expect(hasRole(subject, "Admin")).toBe(false);
    expect(formatRoles(subject)).toBe("Função não informada");
  });
});
