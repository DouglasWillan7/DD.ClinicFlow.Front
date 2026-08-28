import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Plus, Search, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PatientDemographic, PatientListItem } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { getAuthScope } from "../../auth/sessionScope";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { formatBirthDate } from "../patients/patientFormatters";
import { getInitials } from "./appointmentLabels";
import styles from "./NewAppointmentPage.module.css";

const SEARCH_DELAY_MS = 250;
const MAX_SEARCH_RESULTS = 50;
const MAX_RECENT_PATIENTS = 3;

export interface PatientSearchDialogProps {
  open: boolean;
  selectedId: string | null;
  onSelect(patient: PatientDemographic): void;
  onClose(): void;
  onCreate(): void;
}

function normalizePatientSearch(value: string) {
  const trimmed = value.trim();
  if (/^#?[\d.\-/\s]+$/.test(trimmed)) {
    return trimmed.replace(/\D/g, "");
  }
  return trimmed;
}

export function PatientSearchDialog({
  open,
  selectedId,
  onSelect,
  onClose,
  onCreate,
}: PatientSearchDialogProps) {
  const { request, session } = useAuth();
  const authScope = session ? getAuthScope(session) : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizePatientSearch(query);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const resultButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(normalizedQuery),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);

  const patientsQuery = useQuery({
    queryKey: ["patients", authScope, "search-dialog", debouncedQuery],
    queryFn: () =>
      request<PatientListItem[]>(
        debouncedQuery
          ? `/patients?search=${encodeURIComponent(debouncedQuery)}&includeInactive=false`
          : "/patients?includeInactive=false",
      ),
    enabled: open && Boolean(authScope),
  });

  const patients = useMemo(() => {
    const data = patientsQuery.data ?? [];
    if (debouncedQuery) return data.slice(0, MAX_SEARCH_RESULTS);
    return data.slice(0, MAX_RECENT_PATIENTS);
  }, [debouncedQuery, patientsQuery.data]);

  const activePatientIndex = patients.findIndex(
    (patient) => patient.id === activePatientId,
  );
  const activeIndex = activePatientIndex;
  const isDebouncing = normalizedQuery !== debouncedQuery;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      if (!wasOpenRef.current) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      searchRef.current?.focus();
    } else if (wasOpenRef.current) {
      if (dialog?.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(
    () => () => {
      if (wasOpenRef.current) returnFocusRef.current?.focus();
    },
    [],
  );

  function closeDialog() {
    setQuery("");
    setDebouncedQuery("");
    setActivePatientId(null);
    onClose();
  }

  function selectPatient(patient: PatientDemographic) {
    onSelect(patient);
    closeDialog();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isDebouncing || patients.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusPatientAt(
        activeIndex < 0 ? 0 : (activeIndex + 1) % patients.length,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusPatientAt(
        activeIndex < 0
          ? patients.length - 1
          : (activeIndex - 1 + patients.length) % patients.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectPatient(patients[activeIndex] ?? patients[0]);
    }
  }

  function focusPatientAt(index: number) {
    const patient = patients[index];
    const button = resultButtonsRef.current[index];
    if (!patient || !button) return;
    setActivePatientId(patient.id);
    button.focus();
    button.scrollIntoView?.({ block: "nearest" });
  }

  function handleResultKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusPatientAt((index + 1) % patients.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusPatientAt((index - 1 + patients.length) % patients.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusPatientAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusPatientAt(patients.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectPatient(patients[index]);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  const isEmpty = !patientsQuery.isPending && patients.length === 0;
  const showResultsLabel =
    !isDebouncing &&
    !patientsQuery.isPending &&
    !patientsQuery.isError &&
    !isEmpty;
  const emptyTitle = debouncedQuery
    ? "Nenhum paciente encontrado"
    : "Nenhum paciente cadastrado";

  return (
    <dialog
      ref={dialogRef}
      className={styles.patientDialog}
      aria-labelledby="patient-search-title"
      aria-describedby="patient-search-description"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onKeyDown={handleDialogKeyDown}
      onClick={handleBackdropClick}
    >
      <div className={styles.dialogPanel}>
        <header className={styles.dialogHeader}>
          <h2 id="patient-search-title" className={styles.dialogTitle}>
            Selecionar paciente
          </h2>
          <p id="patient-search-description" className={styles.srOnly}>
            Busque por nome, CPF ou número do prontuário.
          </p>
          <button
            type="button"
            className={styles.dialogClose}
            aria-label="Fechar seleção de paciente"
            onClick={closeDialog}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <label className={`${styles.searchPill} ${styles.dialogSearch}`}>
          <span className={styles.srOnly}>Buscar paciente</span>
          <Search size={19} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            aria-controls="patient-search-results"
            autoComplete="off"
            placeholder="Nome, CPF ou nº do prontuário..."
          />
        </label>

        {showResultsLabel ? (
          <p className={styles.resultsLabel}>
            {debouncedQuery
              ? `${patients.length} resultado(s)`
              : "Pacientes recentes"}
          </p>
        ) : (
          <span />
        )}

        <div className={styles.dialogResults}>
          {isDebouncing ? (
            <LoadingBlock label="Buscando pacientes…" />
          ) : patientsQuery.isPending ? (
            <LoadingBlock label="Carregando pacientes…" />
          ) : patientsQuery.isError ? (
            <ErrorBlock
              message="Não foi possível carregar os pacientes."
              retry={() => void patientsQuery.refetch()}
            />
          ) : isEmpty ? (
            <div className={styles.emptyPatients} role="status">
              <strong>{emptyTitle}</strong>
              <p>
                {debouncedQuery
                  ? "Revise a busca ou faça um novo cadastro."
                  : "Cadastre o primeiro paciente para continuar o agendamento."}
              </p>
            </div>
          ) : (
            <ul
              id="patient-search-results"
              className={styles.patientResults}
              aria-label="Pacientes encontrados"
            >
              {patients.map((patient, index) => (
                <li key={patient.id}>
                  <button
                    ref={(button) => {
                      resultButtonsRef.current[index] = button;
                    }}
                    type="button"
                    className={clsx(
                      styles.resultRow,
                      index === activeIndex && styles.activePatient,
                    )}
                    aria-current={index === activeIndex ? "true" : undefined}
                    aria-pressed={patient.id === selectedId}
                    onMouseEnter={() => setActivePatientId(patient.id)}
                    onFocus={() => setActivePatientId(patient.id)}
                    onKeyDown={(event) => handleResultKeyDown(event, index)}
                    onClick={() => selectPatient(patient)}
                  >
                    <span className={styles.resultAvatar} aria-hidden="true">
                      {getInitials(patient.name)}
                    </span>
                    <span className={styles.resultIdentity}>
                      <span className={styles.resultName}>{patient.name}</span>
                      <span className={styles.patientMetadata}>
                        <span>Nasc.:</span>
                        <span>{formatBirthDate(patient.birthDate)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{patient.phone}</span>
                      </span>
                    </span>
                    {patient.id === selectedId ? (
                      <Check
                        size={16}
                        className={styles.rowCheck}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer>
          <button
            type="button"
            className={styles.createButton}
            onClick={onCreate}
          >
            <Plus size={16} aria-hidden="true" /> Cadastrar novo paciente
          </button>
          <p className={styles.dialogHint}>
            Enter seleciona o primeiro resultado · Esc fecha
          </p>
        </footer>
      </div>
    </dialog>
  );
}
