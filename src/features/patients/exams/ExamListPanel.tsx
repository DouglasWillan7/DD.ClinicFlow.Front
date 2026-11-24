import clsx from "clsx";
import {
  Activity,
  FileQuestion,
  FileText,
  FlaskConical,
  HeartPulse,
  Image,
  LoaderCircle,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type {
  ExamCategory,
  ExamListFilters,
  ExamStatus,
  PatientExamCapabilities,
  PatientExamPage,
  PatientExamSummary,
} from "../../../api/types";
import { fallbackTimeZone } from "../../clinic/clinicTimeZone";
import { examDocumentUnavailableMessage } from "./examDocument";
import { flattenExamPages, groupExams } from "./examList";
import { examStatusLabels } from "./examQueries";
import { ExamStatusBadge } from "./ExamStatusBadge";
import styles from "./ExamListPanel.module.css";

const statusOptions: ExamStatus[] = [
  "Pendente", "Processando", "Em revisão", "Validado", "Falhou", "Sem análise", "Cancelado",
];
const categoryOptions: ExamCategory[] = [
  "Não classificado", "Laboratório", "Imagem", "Endoscopia", "Cardiologia",
];
const categoryIcons: Record<ExamCategory, LucideIcon> = {
  "Não classificado": FileQuestion,
  Laboratório: FlaskConical,
  Imagem: Image,
  Endoscopia: Activity,
  Cardiologia: HeartPulse,
};

export interface ExamListPanelProps {
  pages: PatientExamPage[];
  capabilities: PatientExamCapabilities;
  filters: ExamListFilters;
  selectedExamId: string | null;
  isLoading: boolean;
  error: Error | null;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onFiltersChange(filters: ExamListFilters): void;
  onSelect(examId: string): void;
  onLoadMore(): void;
  onRetry(): void;
  onAttach(): void;
  /**
   * Abre o PDF do exame direto da lista. O documento existe em qualquer estado, inclusive quando a
   * análise por IA falhou ou nem foi pedida, e não deve depender de entrar no detalhe.
   */
  onOpenDocument?(examId: string): Promise<void>;
  /** Fuso da clínica; as datas de atualização vêm em UTC. */
  timeZone?: string;
}

function ExamRow({
  exam,
  selected,
  timeZone,
  openingDocument,
  onSelect,
  onOpenDocument,
}: {
  timeZone: string;
  exam: PatientExamSummary;
  selected: boolean;
  openingDocument: boolean;
  onSelect(): void;
  onOpenDocument?(): void;
}) {
  const CategoryIcon = categoryIcons[exam.category];
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone }).format(new Date(exam.updatedAtUtc));
  const nameId = `exam-row-name-${exam.id}`;
  const showDocument = exam.hasDocument && onOpenDocument;
  return (
    <div className={clsx(styles.examRowWrap, selected && styles.examRowSelected)}>
      <button
        type="button"
        className={styles.examRow}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className={styles.categoryIcon} aria-hidden="true">
          <CategoryIcon size={18} />
        </span>
        <span className={styles.examCopy}>
          <strong id={nameId}>{exam.name}</strong>
          <span>{date} · {exam.category}</span>
        </span>
        <ExamStatusBadge status={exam.status} />
      </button>
      {showDocument ? (
        // Fora do botão da linha: botão dentro de botão é inválido e some para o leitor de tela.
        // O nome do exame entra como descrição, para o rótulo curto bastar em cada linha.
        <button
          type="button"
          className={styles.documentButton}
          aria-label="Abrir PDF"
          aria-describedby={nameId}
          aria-busy={openingDocument}
          title="Abrir PDF"
          disabled={openingDocument}
          onClick={onOpenDocument}
        >
          {openingDocument
            ? <LoaderCircle className={styles.spinning} size={18} aria-hidden="true" />
            : <FileText size={18} aria-hidden="true" />}
          <span>PDF</span>
        </button>
      ) : null}
    </div>
  );
}

export function ExamListPanel(props: ExamListPanelProps) {
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const { onOpenDocument } = props;

  async function openDocument(examId: string) {
    if (!onOpenDocument || openingDocumentId) return;
    setDocumentError(null);
    setOpeningDocumentId(examId);
    try {
      await onOpenDocument(examId);
    } catch {
      setDocumentError(examDocumentUnavailableMessage);
    } finally {
      setOpeningDocumentId(null);
    }
  }

  const items = flattenExamPages(props.pages);
  const groups = groupExams(items);
  const filtered = Boolean(
    props.filters.search.trim() ||
    props.filters.statuses.length ||
    props.filters.categories.length ||
    props.filters.includeCancelled,
  );

  return (
    <section className={styles.panel} aria-labelledby="exam-list-title">
      <header className={styles.header}>
        <div>
          <h2 id="exam-list-title">Exames</h2>
          <p>Laudos e revisões do paciente.</p>
        </div>
      </header>

      <div className={styles.searchWrap}>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Buscar exames"
          placeholder="Buscar por nome"
          value={props.filters.search}
          onChange={(event) => props.onFiltersChange({ ...props.filters, search: event.target.value })}
        />
      </div>

      <div className={styles.filters} aria-label="Filtros de exames">
        <label>
          <span>Status</span>
          <select
            value={props.filters.statuses[0] ?? ""}
            onChange={(event) => props.onFiltersChange({
              ...props.filters,
              statuses: event.target.value ? [event.target.value as ExamStatus] : [],
            })}
          >
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{examStatusLabels[status]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select
            value={props.filters.categories[0] ?? ""}
            onChange={(event) => props.onFiltersChange({
              ...props.filters,
              categories: event.target.value ? [event.target.value as ExamCategory] : [],
            })}
          >
            <option value="">Todas</option>
            {categoryOptions.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className={styles.cancelledToggle}>
          <input
            type="checkbox"
            checked={props.filters.includeCancelled}
            onChange={(event) => props.onFiltersChange({
              ...props.filters,
              includeCancelled: event.target.checked,
            })}
          />
          Incluir cancelados
        </label>
      </div>

      {props.isLoading && items.length === 0 ? (
        <div className={styles.skeleton} role="status">Carregando exames…</div>
      ) : props.error && items.length === 0 ? (
        <div className={styles.error} role="alert">
          <span>Não foi possível carregar os exames.</span>
          <button type="button" onClick={props.onRetry}>Tentar novamente</button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty} role={!filtered ? "region" : undefined} aria-label={!filtered ? "Começar histórico de exames" : undefined}>
          <p><strong>{filtered ? "Nenhum exame corresponde aos filtros." : "Nenhum exame registrado."}</strong></p>
          {filtered ? (
            <button type="button" onClick={() => props.onFiltersChange({ search: "", statuses: [], categories: [], includeCancelled: false })}>
              Limpar filtros
            </button>
          ) : (
            <>
              <p>{props.capabilities.canAttachDocument
                ? "Comece anexando um laudo em PDF ao histórico deste paciente."
                : "Os exames aparecerão aqui quando um laudo for anexado."}</p>
              {props.capabilities.canAttachDocument ? (
                <div className={styles.emptyActions}>
                  <button type="button" onClick={props.onAttach}>Anexar laudo</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className={styles.groups}>
          {props.error ? (
            <div className={styles.error} role="alert">
              <span>Não foi possível atualizar a lista.</span>
              <button type="button" onClick={props.onRetry}>Tentar novamente</button>
            </div>
          ) : null}
          {documentError ? (
            <div className={styles.error} role="alert">
              <span>{documentError}</span>
              <button type="button" onClick={() => setDocumentError(null)}>Fechar aviso</button>
            </div>
          ) : null}
          {groups.map((group) => (
            <section key={group.label} className={styles.group} aria-labelledby={`exam-group-${group.label}`}>
              <h3 id={`exam-group-${group.label}`}>{group.label}</h3>
              <div className={styles.rows}>
                {group.items.map((exam) => (
                  <ExamRow
                    key={exam.id}
                    exam={exam}
                    selected={exam.id === props.selectedExamId}
                    timeZone={props.timeZone ?? fallbackTimeZone}
                    openingDocument={openingDocumentId === exam.id}
                    onSelect={() => props.onSelect(exam.id)}
                    onOpenDocument={onOpenDocument ? () => void openDocument(exam.id) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
          {props.hasNextPage ? (
            <button
              type="button"
              className={styles.loadMore}
              disabled={props.isFetchingNextPage}
              onClick={props.onLoadMore}
            >
              {props.isFetchingNextPage ? "Carregando mais exames…" : "Carregar mais"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
