import type { AppointmentStatus } from "../../api/types";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  AwaitingPatientAction: "Aguardando confirmação do paciente",
  Confirmed: "Confirmada",
  AccessRequired: "Acesso necessário",
  InProgress: "Em atendimento",
  Completed: "Realizada",
  Cancelled: "Cancelada",
  NoShow: "Não compareceu",
};

export function appointmentStatusTone(status: AppointmentStatus) {
  if (status === "Confirmed" || status === "Completed") {
    return "success";
  }
  if (status === "AccessRequired" || status === "NoShow" || status === "Cancelled") {
    return "attention";
  }
  if (status === "AwaitingPatientAction" || status === "InProgress") {
    return "info";
  }
  return "neutral";
}

export function isAppointmentPendingPatientAction(status: AppointmentStatus) {
  return status === "AwaitingPatientAction";
}

export function isAppointmentConfirmed(status: AppointmentStatus) {
  return status === "Confirmed";
}

export function isAppointmentInProgress(status: AppointmentStatus) {
  return status === "InProgress";
}

export function isAppointmentCompleted(status: AppointmentStatus) {
  return status === "Completed";
}

export function isAppointmentCancelled(status: AppointmentStatus) {
  return status === "Cancelled" || status === "NoShow";
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
