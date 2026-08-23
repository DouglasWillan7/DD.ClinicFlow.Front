import clsx from "clsx";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  MessageCircleCheck,
} from "lucide-react";
import type { AppointmentStatus } from "../../api/types";
import {
  appointmentStatusLabels,
  appointmentStatusTone,
} from "./appointmentStatus";
import styles from "./StatusBadge.module.css";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const tone = appointmentStatusTone(status);
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "attention"
        ? CircleAlert
        : tone === "info"
          ? MessageCircleCheck
          : CalendarClock;

  return (
    <span className={clsx(styles.badge, styles[tone])}>
      <Icon size={13} aria-hidden="true" />
      {appointmentStatusLabels[status]}
    </span>
  );
}
