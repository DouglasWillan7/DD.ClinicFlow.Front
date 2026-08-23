import {
  appointmentStatusLabels,
  appointmentStatusTone,
} from "./appointmentStatus";

describe("appointment status", () => {
  it("traduz estados internos para linguagem operacional", () => {
    expect(appointmentStatusLabels.ConfirmacaoEnviada).toBe(
      "Confirmação enviada",
    );
    expect(appointmentStatusLabels.NoShow).toBe("Não compareceu");
  });

  it("mantém estados que exigem atenção no mesmo tom semântico", () => {
    expect(appointmentStatusTone("Cancelada")).toBe("attention");
    expect(appointmentStatusTone("Confirmada")).toBe("success");
  });
});
