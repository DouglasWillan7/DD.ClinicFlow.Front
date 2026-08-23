import clsx from "clsx";
import {
  Activity,
  Ban,
  CircleCheck,
  ClipboardList,
  Clock3,
  FileQuestion,
  FlaskConical,
  HeartPulse,
  Image,
  LoaderCircle,
  Search,
  Stethoscope,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  ExamCategory,
  ExamListFilters,
  ExamStatus,
  PatientExamCapabilities,
  PatientExamPage,
  PatientExamSummary,
} from "../../../api/types";
import { flattenExamPages, groupExams } from "./examList";
import styles from "./ExamListPanel.module.css";

const statusOptions: ExamStatus[] = [
  "Solicitado", "Pendente", "Processando", "Em revisão", "Validado", "Falhou", "Cancelado",
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

type StatusTone = "neutral" | "primary" | "warning" | "success" | "danger" | "muted";

const statusSemantics: Record<ExamStatus, { icon: LucideIcon; meaning: string; tone: StatusTone }> = {
  Solicitado: { icon: ClipboardList, meaning: "aguardando laudo", tone: "neutral" },
  Pendente: { icon: Clock3, meaning: "aguardando processamento", tone: "primary" },
  Processando: { icon: LoaderCircle, meaning: "processamento em andamento", tone: "primary" },
  "Em revisão": { icon: Stethoscope, meaning: "revisão clínica necessária", tone: "warning" },
  Validado: { icon: CircleCheck, meaning: "resultado validado", tone: "success" },
  Falhou: { icon: TriangleAlert, meaning: "falha no processamento", tone: "danger" },
  Cancelado: { icon: Ban, meaning: "solicitação cancelada", tone: "muted" },
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
  onRequest(): void;
  onAttach(): void;
}

function ExamRow({
  exam,
  selected,
  onSelect,
}: {
  exam: PatientExamSummary;
  selected: boolean;
  onSelect(): void;
}) {
  const CategoryIcon = categoryIcons[exam.category];
  const status = statusSemantics[exam.status];
  const StatusIcon = status.icon;
  const date = exam.scheduledOn
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${exam.scheduledOn}T00:00:00Z`))
    : new Intl.DateTimeFormat("pt-BR").format(new Date(exam.updatedAtUtc));
  return (
    <button
      type="button"
      className={clsx(styles.examRow, selected && styles.examRowSelected)}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.categoryIcon} aria-hidden="true">
        <CategoryIcon size={18} strokeWidth={1.8} />
      </span>
      <span className={styles.examCopy}>
        <strong>{exam.name}</strong>
        <span>{date} · {exam.category}</span>
      </span>
      <span
        className={clsx(styles.status, styles[`status${status.tone[0].toUpperCase()}${status.tone.slice(1)}`])}
        aria-label={`Status: ${exam.status} — ${status.meaning}`}
        data-tone={status.tone}
      >
        <StatusIcon size={14} strokeWidth={2} aria-hidden="true" />
        {exam.status}
      </span>
    </button>
  );
}

export function ExamListPanel(props: ExamListPanelProps) {
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
          <p>Solicitações, laudos e revisões do paciente.</p>
        </div>
      </header>

      <div className={styles.searchWrap}>
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
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
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
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
              <p>{props.capabilities.canRequest && props.capabilities.canAttachDocument
                ? "Comece solicitando um exame ou anexando um laudo já disponível."
                : props.capabilities.canRequest
                  ? "Comece solicitando o exame que fará parte do histórico deste paciente."
                  : props.capabilities.canAttachDocument
                    ? "Comece anexando um laudo em PDF ao histórico deste paciente."
                    : "Os exames aparecerão aqui quando uma solicitação ou laudo for registrado."}</p>
              {props.capabilities.canRequest || props.capabilities.canAttachDocument ? (
                <div className={styles.emptyActions}>
                  {props.capabilities.canRequest ? <button type="button" onClick={props.onRequest}>Solicitar exame</button> : null}
                  {props.capabilities.canAttachDocument ? <button type="button" onClick={props.onAttach}>Anexar laudo</button> : null}
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
          {groups.map((group) => (
            <section key={group.label} className={styles.group} aria-labelledby={`exam-group-${group.label}`}>
              <h3 id={`exam-group-${group.label}`}>{group.label}</h3>
              <div className={styles.rows}>
                {group.items.map((exam) => (
                  <ExamRow
                    key={exam.id}
                    exam={exam}
                    selected={exam.id === props.selectedExamId}
                    onSelect={() => props.onSelect(exam.id)}
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
