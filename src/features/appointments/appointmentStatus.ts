import type { AppointmentStatus } from "../../api/types";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  Agendada: "Agendada",
  ConfirmacaoEnviada: "Confirmação enviada",
  Confirmada: "Confirmada",
  Cancelada: "Cancelada",
  Realizada: "Realizada",
  NoShow: "Não compareceu",
};

export function appointmentStatusTone(status: AppointmentStatus) {
  if (status === "Confirmada" || status === "Realizada") return "success";
  if (status === "NoShow" || status === "Cancelada") return "attention";
  if (status === "ConfirmacaoEnviada") return "info";
  return "neutral";
}
