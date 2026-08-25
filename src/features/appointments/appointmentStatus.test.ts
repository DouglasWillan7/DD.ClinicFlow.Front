import {
  canOpenClinicalAppointment,
  canStartAppointment,
  isAppointmentCompleted,
  isAppointmentPendingPatientAction,
  appointmentStatusLabels,
  appointmentStatusTone,
} from "./appointmentStatus";

describe("appointment status", () => {
  it("traduz estados internos para linguagem operacional", () => {
    expect(appointmentStatusLabels.AwaitingPatientAction).toBe(
      "Aguardando confirmação do paciente",
    );
    expect(appointmentStatusLabels.NoShow).toBe("Não compareceu");
  });

  it("mantém estados que exigem atenção no mesmo tom semântico", () => {
    expect(appointmentStatusTone("Cancelled")).toBe("attention");
    expect(appointmentStatusTone("Confirmed")).toBe("success");
  });

  it("traduz todos os estados canônicos do lifecycle v2", () => {
    expect(appointmentStatusLabels.AwaitingPatientAction).toBe(
      "Aguardando confirmação do paciente",
    );
    expect(appointmentStatusLabels.Confirmed).toBe("Confirmada");
    expect(appointmentStatusLabels.AccessRequired).toBe("Acesso necessário");
    expect(appointmentStatusLabels.InProgress).toBe("Em atendimento");
    expect(appointmentStatusLabels.Completed).toBe("Realizada");
    expect(appointmentStatusLabels.Cancelled).toBe("Cancelada");
  });

  it("só libera o fluxo clínico quando o estado tem acesso confirmado", () => {
    expect(canOpenClinicalAppointment("AwaitingPatientAction")).toBe(false);
    expect(canOpenClinicalAppointment("AccessRequired")).toBe(false);
    expect(canOpenClinicalAppointment("Confirmed")).toBe(true);
    expect(canOpenClinicalAppointment("InProgress")).toBe(true);
    expect(canOpenClinicalAppointment("Completed")).toBe(true);
    expect(canStartAppointment("Confirmed")).toBe(true);
    expect(canStartAppointment("InProgress")).toBe(false);
    expect(isAppointmentPendingPatientAction("AwaitingPatientAction")).toBe(true);
    expect(isAppointmentCompleted("Completed")).toBe(true);
  });
});
