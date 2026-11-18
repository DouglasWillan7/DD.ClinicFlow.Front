import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  MessageCircleCheck,
} from "lucide-react";
import type { AppointmentStatus } from "../../api/types";
import { StatusBadge, type StatusTone } from "../../components/StatusBadge";
import {
  appointmentStatusLabels,
  appointmentStatusTone,
} from "./appointmentStatus";

// `appointmentStatusTone` fala em "attention"; no badge compartilhado é "danger".
const badgeTone: Record<ReturnType<typeof appointmentStatusTone>, StatusTone> = {
  success: "success",
  attention: "danger",
  info: "info",
  neutral: "neutral",
};

const badgeIcon = {
  success: CheckCircle2,
  attention: CircleAlert,
  info: MessageCircleCheck,
  neutral: CalendarClock,
};

/** Estado da consulta em pílula, com o rótulo em pt-BR de `appointmentStatus.ts`. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const tone = appointmentStatusTone(status);
  return (
    <StatusBadge tone={badgeTone[tone]} icon={badgeIcon[tone]}>
      {appointmentStatusLabels[status]}
    </StatusBadge>
  );
}
