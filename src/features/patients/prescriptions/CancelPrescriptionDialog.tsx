import { Ban } from "lucide-react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { InlineError } from "../../../components/Feedback";

/**
 * Confirmação do cancelamento. A receita não some: fica no histórico, marcada
 * como cancelada, e o PDF deixa de ser entregue.
 */
export function CancelPrescriptionDialog({
  issuedOn,
  pending,
  error,
  onKeep,
  onConfirm,
}: {
  /** Data da emissão já no fuso da clínica. */
  issuedOn: string;
  pending: boolean;
  /** Falha que permite tentar de novo; conflito e recusa fecham o diálogo. */
  error: string | null;
  onKeep(): void;
  onConfirm(): void;
}) {
  // Sem botão fechar: Esc e clique no fundo equivalem a manter a receita.
  return (
    <Dialog
      size="sm"
      tone="danger"
      role="alertdialog"
      icon={<Ban size={20} />}
      title="Cancelar esta receita?"
      description={`A receita de ${issuedOn} continua no histórico do paciente, marcada como cancelada, e o PDF deixa de ser entregue. O cancelamento não pode ser desfeito.`}
      closeLabel={null}
      dismissible={!pending}
      onClose={onKeep}
      footer={
        <>
          <Button type="button" variant="secondary" autoFocus disabled={pending} onClick={onKeep}>
            Manter receita
          </Button>
          <Button type="button" variant="danger" loading={pending} onClick={onConfirm}>
            Cancelar receita
          </Button>
        </>
      }
    >
      {error ? <InlineError>{error}</InlineError> : null}
    </Dialog>
  );
}
