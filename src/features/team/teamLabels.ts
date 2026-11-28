import {
  CheckCircle2,
  CircleOff,
  CirclePause,
  Clock3,
  Headset,
  HeartPulse,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { ClinicMember, ClinicRole, UserClinicStatus } from "../../api/types";
import type { StatusTone } from "../../components/StatusBadge";

export const statusLabels: Record<UserClinicStatus, string> = {
  Pending: "Pendente",
  Active: "Ativo",
  Suspended: "Suspenso",
  Inactive: "Inativo",
};

// Cada estado tem ícone próprio: pendente, suspenso e inativo não se distinguem só pela cor.
export const statusBadges: Record<
  UserClinicStatus,
  { tone: StatusTone; icon: LucideIcon }
> = {
  Pending: { tone: "warning", icon: Clock3 },
  Active: { tone: "success", icon: CheckCircle2 },
  Suspended: { tone: "danger", icon: CirclePause },
  Inactive: { tone: "neutral", icon: CircleOff },
};

export const roleIcons: Record<ClinicRole, LucideIcon> = {
  Doctor: Stethoscope,
  Nurse: HeartPulse,
  Secretary: Headset,
};

export function memberName(member: ClinicMember) {
  return member.displayName?.trim() || member.email || "Integrante sem nome";
}

export function memberInitials(member: ClinicMember) {
  const words = memberName(member).split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? "?"}${words[1]?.[0] ?? ""}`.toUpperCase();
}
