import {
  Ban,
  CircleCheck,
  FileText,
  Clock3,
  LoaderCircle,
  Stethoscope,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ExamStatus } from "../../../api/types";
import { StatusBadge, type StatusTone } from "../../../components/StatusBadge";
import { examStatusLabels } from "./examQueries";

type ExamTone = "neutral" | "primary" | "warning" | "success" | "danger" | "muted";

const statusSemantics: Record<ExamStatus, { icon: LucideIcon; meaning: string; tone: ExamTone }> = {
  Pendente: { icon: Clock3, meaning: "aguardando processamento", tone: "primary" },
  Processando: { icon: LoaderCircle, meaning: "processamento em andamento", tone: "primary" },
  "Em revisão": { icon: Stethoscope, meaning: "revisão clínica necessária", tone: "warning" },
  Validado: { icon: CircleCheck, meaning: "resultado validado", tone: "success" },
  Falhou: { icon: TriangleAlert, meaning: "o documento está salvo; a análise por IA falhou", tone: "danger" },
  Cancelado: { icon: Ban, meaning: "registro cancelado", tone: "muted" },
  "Sem análise": { icon: FileText, meaning: "documento salvo, sem análise por IA", tone: "neutral" },
};

// O vocabulário dos exames (`data-tone`) é mais fino que o do badge compartilhado.
const badgeTone: Record<ExamTone, StatusTone> = {
  neutral: "neutral",
  muted: "neutral",
  primary: "info",
  warning: "warning",
  success: "success",
  danger: "danger",
};

/** Estado do exame, igual na lista e no detalhe: rótulo, ícone, cor e o que ele significa. */
export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const { icon, meaning, tone } = statusSemantics[status];
  const label = examStatusLabels[status];
  return (
    <StatusBadge
      tone={badgeTone[tone]}
      icon={icon}
      aria-label={`Status: ${label} — ${meaning}`}
      data-tone={tone}
    >
      {label}
    </StatusBadge>
  );
}
