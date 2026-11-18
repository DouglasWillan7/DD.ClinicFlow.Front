import type { AppointmentStatus } from "../../api/types";
import { StatusBadge } from "../../components/StatusBadge";
import { appointmentStatusLabels } from "./appointmentStatus";
import { appointmentStatusVisual } from "./appointmentStatusVisual";

/** Estado da consulta em pílula, com o rótulo em pt-BR de `appointmentStatus.ts`. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { tone, icon } = appointmentStatusVisual(status);
  return (
    <StatusBadge tone={tone} icon={icon}>
      {appointmentStatusLabels[status]}
    </StatusBadge>
  );
}
