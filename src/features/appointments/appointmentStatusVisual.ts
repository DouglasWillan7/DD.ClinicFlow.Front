import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  MessageCircleCheck,
  type LucideIcon,
} from "lucide-react";
import type { AppointmentStatus } from "../../api/types";
import type { StatusTone } from "../../components/StatusBadge";
import { appointmentStatusTone } from "./appointmentStatus";

// `appointmentStatusTone` fala em "attention"; no badge compartilhado é "danger".
const visuals: Record<
  ReturnType<typeof appointmentStatusTone>,
  { tone: StatusTone; icon: LucideIcon }
> = {
  success: { tone: "success", icon: CheckCircle2 },
  attention: { tone: "danger", icon: CircleAlert },
  info: { tone: "info", icon: MessageCircleCheck },
  neutral: { tone: "neutral", icon: CalendarClock },
};

/** Tom e ícone do estado da consulta: o estado nunca é comunicado só por cor. */
export function appointmentStatusVisual(status: AppointmentStatus) {
  return visuals[appointmentStatusTone(status)];
}
