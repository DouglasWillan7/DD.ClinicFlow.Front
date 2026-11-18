import { Ban, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../../api/client";
import type { Prescription } from "../../../api/types";
import { Button } from "../../../components/Button";
import { InlineError } from "../../../components/Feedback";
import { formatDateTimeInZone } from "../../clinic/clinicTimeZone";
import { PrescriptionStatusBadge } from "./PrescriptionStatusBadge";
import styles from "./PrescriptionDetailPanel.module.css";

interface PrescriptionDetailPanelProps {
  prescription: Prescription;
  /** Fuso da clínica; emissão e cancelamento vêm em UTC. */
  timeZone: string;
  loadDocument(): Promise<Blob>;
  onUseAsBase(): void;
  onCancel(): void;
  /** O PDF foi recusado porque a receita mudou (cancelada em outra sessão). */
  onStale(): void;
}

export function PrescriptionDetailPanel({
  prescription,
  timeZone,
  loadDocument,
  onUseAsBase,
  onCancel,
  onStale,
}: PrescriptionDetailPanelProps) {
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);
  const cancelled = prescription.status === "Cancelled";
  const issuedOn = formatDateTimeInZone(prescription.issuedAtUtc, timeZone, { dateStyle: "short" });
  const titleId = `prescription-title-${prescription.id}`;
  const contentId = `prescription-content-${prescription.id}`;

  // A aba nasce no clique (senão o bloqueador de pop-up a barra) e recebe o PDF
  // autenticado depois, como no laudo original dos exames.
  async function openDocument() {
    setDocumentError(null);
    setOpeningDocument(true);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setDocumentError("O navegador bloqueou a nova aba. Permita pop-ups para abrir o PDF.");
      setOpeningDocument(false);
      return;
    }
    tab.opener = null;

    try {
      const blob = await loadDocument();
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      tab.close();
      if (error instanceof ApiError && error.status === 409) {
        setDocumentError("Esta receita foi cancelada e o PDF não é mais entregue. A lista foi atualizada.");
        onStale();
      } else {
        setDocumentError("O PDF da receita está indisponível no momento. Tente novamente.");
      }
    } finally {
      setOpeningDocument(false);
    }
  }

  return (
    <article className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Receita médica</p>
          <h2 id={titleId}>Receita de {issuedOn}</h2>
        </div>
        <PrescriptionStatusBadge status={prescription.status} />
      </header>

      <dl className={styles.metadata}>
        <div>
          <dt>Emitida em</dt>
          <dd>{formatDateTimeInZone(prescription.issuedAtUtc, timeZone)}</dd>
        </div>
        <div>
          <dt>Médico</dt>
          <dd>{prescription.issuedByName}</dd>
        </div>
        <div>
          <dt>Registro profissional</dt>
          <dd>{prescription.issuedByRegistration ?? "Não informado"}</dd>
        </div>
        {cancelled ? (
          <div>
            <dt>Cancelada em</dt>
            <dd>{formatDateTimeInZone(prescription.cancelledAtUtc, timeZone) ?? "Data não informada"}</dd>
          </div>
        ) : null}
      </dl>

      {cancelled ? (
        <p className={styles.cancelledNote}>
          <Ban size={16} aria-hidden="true" />
          <span>Receita cancelada. O texto continua no histórico, mas o PDF não é mais entregue.</span>
        </p>
      ) : null}

      <section className={styles.contentSection} aria-labelledby={contentId}>
        <h3 id={contentId}>Texto da receita</h3>
        {/* pre-wrap mantém as quebras de linha que o médico digitou. */}
        <div className={styles.content}>{prescription.content}</div>
      </section>

      <div className={styles.actions}>
        {cancelled ? null : (
          <Button type="button" loading={openingDocument} onClick={() => void openDocument()}>
            <ExternalLink size={16} aria-hidden="true" />
            Abrir PDF
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onUseAsBase}>
          <Copy size={16} aria-hidden="true" />
          Usar como base
        </Button>
        {prescription.capabilities.canCancel && !cancelled ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar receita
          </Button>
        ) : null}
      </div>
      {documentError ? <InlineError>{documentError}</InlineError> : null}
      <p className={styles.hint}>
        Receitas emitidas não são editadas. Para ajustar o texto, use esta como base e emita uma nova; a original continua como está.
      </p>
    </article>
  );
}
