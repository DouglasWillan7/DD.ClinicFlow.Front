import type { AppointmentStatus } from "../../api/types";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  AwaitingPatientAction: "Aguardando confirmação do paciente",
  Confirmed: "Confirmada",
  AccessRequired: "Acesso necessário",
  InProgress: "Em atendimento",
  Completed: "Realizada",
  Cancelled: "Cancelada",
  Agendada: "Agendada",
  ConfirmacaoEnviada: "Confirmação enviada",
  Confirmada: "Confirmada",
  Cancelada: "Cancelada",
  Realizada: "Realizada",
  NoShow: "Não compareceu",
};

export function appointmentStatusTone(status: AppointmentStatus) {
  if (["Confirmed", "Completed", "Confirmada", "Realizada"].includes(status)) {
    return "success";
  }
  if (["AccessRequired", "NoShow", "Cancelled", "Cancelada"].includes(status)) {
    return "attention";
  }
  if (["AwaitingPatientAction", "InProgress", "ConfirmacaoEnviada"].includes(status)) {
    return "info";
  }
  return "neutral";
}

export function isAppointmentPendingPatientAction(status: AppointmentStatus) {
  return status === "AwaitingPatientAction" || status === "Agendada" ||
    status === "ConfirmacaoEnviada";
}

export function isAppointmentConfirmed(status: AppointmentStatus) {
  return status === "Confirmed" || status === "Confirmada";
}

export function isAppointmentInProgress(status: AppointmentStatus) {
  return status === "InProgress";
}

export function isAppointmentCompleted(status: AppointmentStatus) {
  return status === "Completed" || status === "Realizada";
}

export function isAppointmentCancelled(status: AppointmentStatus) {
  return status === "Cancelled" || status === "Cancelada" || status === "NoShow";
}

export function isAppointmentTerminal(status: AppointmentStatus) {
  return isAppointmentCompleted(status) || isAppointmentCancelled(status);
}

export function canOpenClinicalAppointment(status: AppointmentStatus) {
  return isAppointmentConfirmed(status) || isAppointmentInProgress(status) ||
    isAppointmentCompleted(status);
}

export function canStartAppointment(status: AppointmentStatus) {
  return isAppointmentConfirmed(status);
}
