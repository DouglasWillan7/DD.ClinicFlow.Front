import clsx from "clsx";
import { Clock, Plus, Search, X } from "lucide-react";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { getAuthScope } from "../../auth/sessionScope";
import {
  searchEntries,
  splitHighlight,
  type SearchHit,
  type SearchKind,
} from "./searchIndex";
import {
  formatOpenedAt,
  kindLabels,
  readRecents,
  rememberRecent,
} from "./recentSearches";
import { useGlobalSearchIndex } from "./useGlobalSearchIndex";
import styles from "./GlobalSearch.module.css";

const RESULTS_PER_GROUP = 3;
/** Abaixo disso o atalho de cadastro só atrapalharia quem ainda está digitando. */
const MIN_CREATE_LENGTH = 2;

type RowVisual = SearchKind | "recent" | "create";

/** A linha guarda o destino como dado; quem navega é o handler do clique. */
type RowAction =
  | { type: "open"; kind: SearchKind; id: string; label: string }
  | { type: "create"; name: string };

const avatarClass: Record<RowVisual, string> = {
  patient: styles.avatarPatient,
  doctor: styles.avatarDoctor,
  recent: styles.avatarRecent,
  create: styles.avatarCreate,
};

const chipClass: Record<RowVisual, string> = {
  patient: styles.chipPatient,
  doctor: styles.chipDoctor,
  recent: "",
  create: "",
};

interface Row {
  key: string;
  visual: RowVisual;
  /** Cabeçalho a que a linha pertence; vazio no atalho de cadastro. */
  group: string;
  title: string;
  highlight: SearchHit["highlight"];
  subtitle: string;
  initials: string;
  chip: string | null;
  ariaLabel: string;
  action: RowAction;
}

/**
 * Busca global da topbar: um único campo resolve pacientes e médicos a partir
 * de qualquer tela. O filtro roda sobre o índice em memória, então o dropdown
 * responde na tecla — sem debounce e sem uma requisição por digitação.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const index = useGlobalSearchIndex();
  const scope = session ? getAuthScope(session) : "";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // O AppShell remonta a busca quando a identidade muda (`key`), então ler o
  // storage uma vez no início basta — nunca sobra recente de outra sessão.
  const [recents, setRecents] = useState(() => readRecents(scope));
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const listId = `${fieldId}-resultados`;

  const term = query.trim();

  // ⌘K / Ctrl+K traz o foco para a busca de qualquer lugar do painel.
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  const patientHits = useMemo(
    () => searchEntries(index.patients, term, RESULTS_PER_GROUP),
    [index.patients, term],
  );
  const doctorHits = useMemo(
    () => searchEntries(index.doctors, term, RESULTS_PER_GROUP),
    [index.doctors, term],
  );
  const entriesByKey = useMemo(
    () =>
      new Map(
        [...index.patients, ...index.doctors].map((entry) => [
          `${entry.kind}:${entry.id}`,
          entry,
        ]),
      ),
    [index.doctors, index.patients],
  );

  function close() {
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function runAction(action: RowAction) {
    close();
    if (action.type === "create") {
      navigate(`/app/pacientes/novo?nome=${encodeURIComponent(action.name)}`);
      return;
    }

    const { kind, id, label } = action;
    setRecents(rememberRecent(scope, { kind, id, label }));
    navigate(
      kind === "patient"
        ? `/app/pacientes/${encodeURIComponent(id)}`
        : `/app/agenda?doctorId=${encodeURIComponent(id)}`,
    );
  }

  // São poucas linhas (3 por grupo) e o trabalho pesado já está memoizado em
  // `patientHits`/`doctorHits`; montá-las a cada render sai de graça.
  const rows: Row[] = [];

  if (!term) {
    for (const recent of recents) {
      const entry = entriesByKey.get(`${recent.kind}:${recent.id}`);
      // Sem o item no índice já carregado, ele saiu do cadastro: não abre.
      if (!entry && !index.isLoading) continue;
      const title = entry?.title ?? recent.label;
      const subtitle = `${kindLabels[recent.kind]} · ${formatOpenedAt(recent.openedAtIso)}`;

      rows.push({
        key: `recent-${recent.kind}-${recent.id}`,
        visual: "recent",
        group: "Recentes",
        title,
        highlight: null,
        subtitle,
        initials: entry?.initials ?? "",
        chip: null,
        ariaLabel: `${title}. ${subtitle}`,
        action: { type: "open", kind: recent.kind, id: recent.id, label: title },
      });
    }
  } else {
    for (const hit of patientHits) {
      rows.push({
        key: `patient-${hit.entry.id}`,
        visual: "patient",
        group: "Pacientes",
        title: hit.entry.title,
        highlight: hit.highlight,
        subtitle: hit.entry.subtitle,
        initials: hit.entry.initials,
        chip: "Ficha",
        ariaLabel: `Paciente ${hit.entry.title}. ${hit.entry.subtitle}`,
        action: {
          type: "open",
          kind: "patient",
          id: hit.entry.id,
          label: hit.entry.title,
        },
      });
    }

    for (const hit of doctorHits) {
      rows.push({
        key: `doctor-${hit.entry.id}`,
        visual: "doctor",
        group: "Médicos",
        title: hit.entry.title,
        highlight: hit.highlight,
        subtitle: hit.entry.subtitle,
        initials: hit.entry.initials,
        chip: "Agenda",
        ariaLabel: `Médico ${hit.entry.title}. ${hit.entry.subtitle}`,
        action: {
          type: "open",
          kind: "doctor",
          id: hit.entry.id,
          label: hit.entry.title,
        },
      });
    }

    // O atalho só aparece quando o cadastro realmente não existe — oferecê-lo
    // enquanto o índice carrega convidaria a duplicar um paciente.
    if (
      term.length >= MIN_CREATE_LENGTH &&
      !index.isLoading &&
      !index.isError &&
      patientHits.length === 0
    ) {
      const title = `Cadastrar “${term}” como novo paciente`;
      rows.push({
        key: "create",
        visual: "create",
        group: "",
        title,
        highlight: null,
        subtitle: "Abre o cadastro com o nome preenchido",
        initials: "",
        chip: null,
        ariaLabel: title,
        action: { type: "create", name: term },
      });
    }
  }

  const active = activeIndex >= 0 && activeIndex < rows.length ? activeIndex : -1;
  const dropdownOpen = open && (term.length > 0 || rows.length > 0);

  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (rows.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const next = active + (event.key === "ArrowDown" ? 1 : -1);
      setActiveIndex(
        next < 0 ? rows.length - 1 : next >= rows.length ? 0 : next,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active >= 0 ? active : 0];
      if (row) runAction(row.action);
    }
  }

  function releaseFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setOpen(false);
    setActiveIndex(-1);
  }

  // O clique só chega ao botão se o campo não perder o foco antes dele.
  function keepFocus(event: ReactMouseEvent) {
    event.preventDefault();
  }

  const status = !term
    ? null
    : index.isError
      ? "Não foi possível carregar pacientes e médicos."
      : index.isLoading
        ? "Carregando pacientes e médicos…"
        : rows.some((row) => row.visual !== "create")
          ? null
          : `Nenhum resultado para “${term}”.`;

  return (
    <div className={styles.search} onBlur={releaseFocus}>
      <div
        className={clsx(
          styles.field,
          open && styles.fieldFocused,
          dropdownOpen && styles.fieldOpen,
        )}
      >
        <Search size={18} aria-hidden="true" />
        <label className={styles.srOnly} htmlFor={fieldId}>
          Busca global
        </label>
        <input
          id={fieldId}
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          autoComplete="off"
          value={query}
          placeholder="Buscar médico ou paciente…"
          aria-expanded={dropdownOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Limpar busca"
            onMouseDown={keepFocus}
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <X size={12} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
        <span className={styles.shortcut} aria-hidden="true">
          ⌘K
        </span>
      </div>

      {dropdownOpen ? (
        <div className={styles.dropdown}>
          {status ? (
            <p className={styles.status} role="status">
              {status}
              {index.isError ? (
                <button
                  type="button"
                  className={styles.retry}
                  onMouseDown={keepFocus}
                  onClick={index.retry}
                >
                  Tentar novamente
                </button>
              ) : null}
            </p>
          ) : null}

          <div
            id={listId}
            role="listbox"
            aria-label="Resultados da busca"
            className={styles.list}
          >
            {rows.map((row, position) => (
              <Fragment key={row.key}>
                {row.group && row.group !== rows[position - 1]?.group ? (
                  <p className={styles.groupLabel} role="presentation">
                    {row.group}
                  </p>
                ) : null}
                <button
                  id={`${listId}-${position}`}
                  type="button"
                  role="option"
                  aria-selected={position === active}
                  aria-label={row.ariaLabel}
                  className={clsx(
                    styles.row,
                    position === active && styles.rowActive,
                    row.visual === "create" && styles.createRow,
                  )}
                  onMouseDown={keepFocus}
                  onClick={() => runAction(row.action)}
                >
                  <span
                    className={clsx(styles.avatar, avatarClass[row.visual])}
                    aria-hidden="true"
                  >
                    {row.visual === "recent" ? (
                      <Clock size={16} strokeWidth={1.8} />
                    ) : row.visual === "create" ? (
                      <Plus size={16} strokeWidth={2} />
                    ) : (
                      row.initials
                    )}
                  </span>
                  <span className={styles.identity}>
                    <span className={styles.title}>
                      {splitHighlight(row.title, row.highlight).map(
                        (part, partIndex) =>
                          part.match ? (
                            <mark key={partIndex} className={styles.match}>
                              {part.text}
                            </mark>
                          ) : (
                            <Fragment key={partIndex}>{part.text}</Fragment>
                          ),
                      )}
                    </span>
                    <span className={styles.subtitle}>{row.subtitle}</span>
                  </span>
                  {row.chip ? (
                    <span className={clsx(styles.chip, chipClass[row.visual])}>
                      {row.chip}
                    </span>
                  ) : null}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
