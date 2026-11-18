import clsx from "clsx";
import { FilePlus2, ScrollText } from "lucide-react";
import type { Prescription } from "../../../api/types";
import { Button } from "../../../components/Button";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/Feedback";
import { formatDateTimeInZone } from "../../clinic/clinicTimeZone";
import { prescriptionPreview } from "./prescriptionQueries";
import { PrescriptionStatusBadge } from "./PrescriptionStatusBadge";
import styles from "./PrescriptionListPanel.module.css";

export interface PrescriptionListPanelProps {
  items: Prescription[];
  canIssue: boolean;
  selectedId: string | null;
  isLoading: boolean;
  error: Error | null;
  /** Fuso da clínica; a emissão vem em UTC. */
  timeZone: string;
  onSelect(prescriptionId: string): void;
  onIssue(): void;
  onRetry(): void;
}

function countLabel(count: number) {
  if (count === 0) return "Nenhuma receita emitida";
  return `${count} ${count === 1 ? "receita" : "receitas"}`;
}

export function PrescriptionListPanel({
  items,
  canIssue,
  selectedId,
  isLoading,
  error,
  timeZone,
  onSelect,
  onIssue,
  onRetry,
}: PrescriptionListPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="prescription-list-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id="prescription-list-title">Receitas</h2>
          {!isLoading && !(error && items.length === 0) ? (
            <p>{countLabel(items.length)}</p>
          ) : null}
        </div>
        {canIssue ? (
          <Button type="button" onClick={onIssue}>
            <FilePlus2 size={17} aria-hidden="true" />
            Nova receita
          </Button>
        ) : null}
      </header>

      {isLoading && items.length === 0 ? (
        <LoadingBlock label="Carregando receitas…" />
      ) : error && items.length === 0 ? (
        <ErrorBlock message="Não foi possível carregar as receitas." retry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhuma receita emitida"
          description={
            canIssue
              ? "As receitas deste paciente ficam aqui, com o texto e o PDF. Emita a primeira em “Nova receita”."
              : "As receitas aparecem aqui quando um médico com acesso clínico emitir a primeira."
          }
        />
      ) : (
        <>
          {error ? (
            <ErrorBlock message="Não foi possível atualizar a lista." retry={onRetry} />
          ) : null}
          <ul className={styles.rows} aria-label="Histórico de receitas">
            {items.map((prescription) => {
              const selected = prescription.id === selectedId;
              return (
                <li key={prescription.id}>
                  <button
                    type="button"
                    className={clsx(styles.row, selected && styles.rowSelected)}
                    aria-pressed={selected}
                    onClick={() => onSelect(prescription.id)}
                  >
                    <span className={styles.rowTop}>
                      <time dateTime={prescription.issuedAtUtc}>
                        {formatDateTimeInZone(prescription.issuedAtUtc, timeZone)}
                      </time>
                      <PrescriptionStatusBadge status={prescription.status} />
                    </span>
                    <span className={styles.preview}>
                      {prescriptionPreview(prescription.content)}
                    </span>
                    <span className={styles.doctor}>{prescription.issuedByName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
