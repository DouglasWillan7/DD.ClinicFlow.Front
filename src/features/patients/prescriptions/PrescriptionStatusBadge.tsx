import { Ban, FileCheck2, type LucideIcon } from "lucide-react";
import type { PrescriptionStatus } from "../../../api/types";
import { StatusBadge, type StatusTone } from "../../../components/StatusBadge";
import { prescriptionStatusLabels } from "./prescriptionQueries";

const statusSemantics: Record<
  PrescriptionStatus,
  { icon: LucideIcon; meaning: string; tone: StatusTone }
> = {
  // Verde é verificação explícita: a receita foi emitida por um médico e vale.
  Issued: { icon: FileCheck2, meaning: "receita válida", tone: "success" },
  Cancelled: { icon: Ban, meaning: "mantida no histórico, sem PDF", tone: "neutral" },
};

/** Estado da receita, igual na lista e no detalhe: rótulo, ícone e cor. */
export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const { icon, meaning, tone } = statusSemantics[status];
  const label = prescriptionStatusLabels[status];
  return (
    <StatusBadge tone={tone} icon={icon} aria-label={`Status: ${label} — ${meaning}`}>
      {label}
    </StatusBadge>
  );
}
