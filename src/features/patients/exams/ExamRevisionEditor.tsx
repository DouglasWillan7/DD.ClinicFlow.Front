import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Plus,
  RefreshCcw,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type FieldPath,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { ApiError } from "../../../api/client";
import type {
  ClassifyExamRequest,
  ClinicalReferenceState,
  PatientExamDetail,
  SaveExamRevisionRequest,
  ValidateExamRevisionRequest,
} from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, SelectField } from "../../../components/Field";
import { formatFileSize, LOW_CONFIDENCE_THRESHOLD } from "./examDetail";
import { examRequestCategories } from "./examRequestForm";
import {
  clinicalOutcomes,
  parseBrazilianNumber,
  parseRevisionSubmission,
  revisionToForm,
  type ExamRevisionFormInput,
} from "./examRevisionForm";
import { isClinicalNarrativeTitle } from "./narrativePresentation";
import { extractionWarningMessages } from "./extractionWarningPresentation";
import { ReviewExamDiscard } from "./ReviewExamDiscard";
import styles from "./ExamRevisionEditor.module.css";

interface ExamRevisionEditorProps {
  exam: PatientExamDetail;
  loadDocument?: () => Promise<Blob>;
  onClassify(request: ClassifyExamRequest): Promise<PatientExamDetail>;
  onSaveDraft(request: SaveExamRevisionRequest): Promise<PatientExamDetail>;
  onValidate(request: ValidateExamRevisionRequest): Promise<PatientExamDetail>;
  onDiscard?(): Promise<void>;
  onCompleted(exam: PatientExamDetail): void;
  onReload(): void;
}

type ReviewItemKey = `result:${string}` | `section:${string}` | `finding:${string}`;

const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").toLowerCase();
const controlId = (editorKey: string, control: string) => `exam-editor-${slug(editorKey)}-${control}`;
const itemKey = (kind: "result" | "section" | "finding", id: string): ReviewItemKey => `${kind}:${id}`;

function newId() {
  return crypto.randomUUID();
}

function calculatedReferenceState(
  rawValue: string,
  lowerBound: number | null | undefined,
  upperBound: number | null | undefined,
  fallback: ClinicalReferenceState,
): ClinicalReferenceState {
  const value = parseBrazilianNumber(rawValue);
  if (value === null || lowerBound == null && upperBound == null) return fallback;
  if (upperBound != null && value > upperBound) return "elevado";
  if (lowerBound != null && value < lowerBound) return "baixo";
  return "normal";
}

function referenceStateLabel(
  state: ClinicalReferenceState,
  referenceText?: string | null,
  lowerBound?: number | null,
  upperBound?: number | null,
) {
  if (state === "elevado") return "↑ Elevado";
  if (state === "baixo") return "↓ Baixo";
  if (state === "limítrofe") return "Limítrofe";
  if (state === "normal") return "Dentro da referência";
  if (!referenceText?.trim() && lowerBound == null && upperBound == null) return "Sem referência informada";
  return "Indeterminado";
}

function TextAreaField({
  id,
  label,
  error,
  registration,
}: {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<ExamRevisionFormInput>>["register"]>;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={4} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...registration} />
      {error ? <small id={`${id}-error`} className={styles.error}>{error}</small> : null}
    </div>
  );
}

function ConfirmationButton({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle(): void;
}) {
  return (
    <button
      type="button"
      className={clsx(styles.confirmButton, checked && styles.confirmButtonChecked)}
      aria-pressed={checked}
      aria-label={checked ? `${label} conferido; desfazer conferência` : `Marcar ${label} como conferido`}
      title={checked ? "Conferido — clique para desfazer" : "Marcar como conferido"}
      onClick={onToggle}
    >
      <Check size={17} aria-hidden="true" />
    </button>
  );
}

function DocumentPreview({
  exam,
  loadDocument,
}: {
  exam: PatientExamDetail;
  loadDocument?: () => Promise<Blob>;
}) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(exam.document && loadDocument));
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!exam.document || !loadDocument) {
      return;
    }

    void loadDocument()
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setDocumentUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError("O laudo original está indisponível no momento.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [exam.document, exam.id, loadDocument, reloadKey]);

  return (
    <aside className={styles.documentPanel} aria-labelledby="review-document-title">
      <header className={styles.documentHeader}>
        <div>
          <FileText size={18} aria-hidden="true" />
          <span>
            <strong id="review-document-title">Laudo original</strong>
            {exam.document ? <small>{formatFileSize(exam.document.sizeBytes)} · {exam.document.fileName}</small> : null}
          </span>
        </div>
        {documentUrl ? (
          <a className={styles.documentLink} href={documentUrl} target="_blank" rel="noreferrer">
            Abrir em nova aba <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </header>

      <div className={styles.documentViewport}>
        {loading ? (
          <div className={styles.documentFeedback} role="status"><span className={styles.loader} aria-hidden="true" />Carregando laudo original…</div>
        ) : error ? (
          <div className={styles.documentFeedback} role="alert">
            <p>{error}</p>
            <Button type="button" variant="secondary" onClick={() => {
              setLoading(true);
              setError(null);
              setReloadKey((value) => value + 1);
            }}><RefreshCcw size={16} aria-hidden="true" />Tentar novamente</Button>
          </div>
        ) : documentUrl ? (
          <iframe title="Visualização do laudo original" src={documentUrl} />
        ) : (
          <div className={styles.documentFeedback}><p>O documento original não está disponível para visualização.</p></div>
        )}
      </div>
    </aside>
  );
}

export function ExamRevisionEditor({ exam, loadDocument, onClassify, onSaveDraft, onValidate, onDiscard, onCompleted, onReload }: ExamRevisionEditorProps) {
  const revision = exam.draftRevision;
  if (!exam.capabilities.canEditRevision || !revision) return null;
  return <AuthorizedRevisionEditor exam={exam} revision={revision} loadDocument={loadDocument} onClassify={onClassify} onSaveDraft={onSaveDraft} onValidate={onValidate} onDiscard={onDiscard} onCompleted={onCompleted} onReload={onReload} />;
}

function AuthorizedRevisionEditor({ exam, revision, loadDocument, onClassify, onSaveDraft, onValidate, onDiscard, onCompleted, onReload }: ExamRevisionEditorProps & { revision: NonNullable<PatientExamDetail["draftRevision"]> }) {
  const [conflict, setConflict] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [classificationCategory, setClassificationCategory] = useState<ClassifyExamRequest["category"] | "">("");
  const [confirmed, setConfirmed] = useState<Set<ReviewItemKey>>(() => new Set());
  const [openItems, setOpenItems] = useState<Set<ReviewItemKey>>(() => new Set());
  const focusTarget = useRef<string | null>(null);
  const [initialValues] = useState(() => revisionToForm(revision));
  const nextLabels = useRef({
    result: revision.structuredResults.length + 1,
    finding: revision.structuredFindings.length + 1,
  });
  const {
    control,
    register,
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ExamRevisionFormInput>({ defaultValues: initialValues });
  const results = useFieldArray({ control, name: "structuredResults", keyName: "formKey" });
  const sections = useFieldArray({ control, name: "narrativeSections", keyName: "formKey" });
  const findings = useFieldArray({ control, name: "structuredFindings", keyName: "formKey" });
  const watchedResults = useWatch({ control, name: "structuredResults" });
  const watchedSections = useWatch({ control, name: "narrativeSections" });
  const watchedFindings = useWatch({ control, name: "structuredFindings" });
  const watchedOutcome = useWatch({ control, name: "clinicalOutcome" });
  const extractionWarnings = useMemo(
    () => extractionWarningMessages(revision.extractionIssues),
    [revision.extractionIssues],
  );
  const isCorrection = Boolean(exam.activeRevision);
  const originalResults = useMemo(() => new Map(revision.structuredResults.map((result) => [result.id, result])), [revision.structuredResults]);
  const [initialResultValues] = useState(() => new Map(initialValues.structuredResults.map((result) => [result.id, result])));
  const clinicalSectionIds = useMemo(
    () => new Set(revision.narrativeSections.filter((section) => isClinicalNarrativeTitle(section.title)).map((section) => section.id)),
    [revision.narrativeSections],
  );
  const clinicalSections = sections.fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => clinicalSectionIds.has(field.id));
  const additionalSections = sections.fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !clinicalSectionIds.has(field.id));
  const laboratoryFindings = exam.category === "Laboratório"
    ? findings.fields.map((field, index) => ({ field, index }))
    : [];
  const reviewableFindings = exam.category === "Laboratório" ? [] : findings.fields;

  const reviewKeys: ReviewItemKey[] = [
    ...results.fields.map((field) => itemKey("result", field.id)),
    ...clinicalSections.map(({ field }) => itemKey("section", field.id)),
    ...reviewableFindings.map((field) => itemKey("finding", field.id)),
  ];
  const confirmedCount = reviewKeys.filter((key) => confirmed.has(key)).length;
  const allConfirmed = reviewKeys.length > 0 && confirmedCount === reviewKeys.length;
  const progress = reviewKeys.length ? Math.round((confirmedCount / reviewKeys.length) * 100) : 0;

  useEffect(() => {
    if (!focusTarget.current) return;
    document.getElementById(focusTarget.current)?.focus();
    focusTarget.current = null;
  }, [results.fields.length, sections.fields.length, findings.fields.length]);

  function toggleConfirmed(key: ReviewItemKey) {
    setConfirmed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function unconfirm(key: ReviewItemKey) {
    setConfirmed((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function toggleOpen(key: ReviewItemKey) {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function trackedRegistration(path: FieldPath<ExamRevisionFormInput>, key: ReviewItemKey) {
    const registration = register(path);
    return {
      ...registration,
      onChange: (event: Parameters<typeof registration.onChange>[0]) => {
        unconfirm(key);
        return registration.onChange(event);
      },
    };
  }

  function addResult() {
    const editorKey = `Resultado ${nextLabels.current.result++}`;
    const id = newId();
    results.append({ editorKey, id, catalogCode: "", name: "", numericValue: "", textValue: "", unit: "", referenceText: "", outOfRangeSuggestion: "", referenceState: "indeterminado", confidence: "" });
    setOpenItems((current) => new Set(current).add(itemKey("result", id)));
    focusTarget.current = controlId(editorKey, "name");
  }

  function addFinding() {
    const editorKey = `Achado ${nextLabels.current.finding++}`;
    const id = newId();
    findings.append({ editorKey, id, key: "", value: "", confidence: "" });
    setOpenItems((current) => new Set(current).add(itemKey("finding", id)));
    focusTarget.current = controlId(editorKey, "key");
  }

  function removeWithFocus(
    fields: Array<{ id: string; editorKey: string }>,
    index: number,
    remove: (index: number) => void,
    firstControl: string,
    addButtonId: string,
    kind: "result" | "section" | "finding",
  ) {
    const removedKey = itemKey(kind, fields[index].id);
    const neighbor = fields[index + 1] ?? fields[index - 1];
    remove(index);
    setConfirmed((current) => {
      const next = new Set(current);
      next.delete(removedKey);
      return next;
    });
    focusTarget.current = neighbor ? controlId(neighbor.editorKey, firstControl) : addButtonId;
  }

  function applyIssues(issues: Array<{ path: string; message: string }>) {
    clearErrors();
    const first = issues[0];
    if (!first) return;
    if (first.path === "root.content") {
      setError("root.content", { type: "manual", message: first.message });
      document.getElementById("add-exam-result")?.focus();
      return;
    }
    issues.forEach((issue, index) => setError(issue.path as FieldPath<ExamRevisionFormInput>, { type: "manual", message: issue.message }, { shouldFocus: index === 0 }));
  }

  async function submit(intent: "draft" | "validate") {
    setConflict(false);
    setServerError(null);
    if (intent === "validate" && !allConfirmed) return;
    const parsed = parseRevisionSubmission(getValues(), intent, isCorrection);
    if (!parsed.success) {
      applyIssues(parsed.issues);
      return;
    }

    clearErrors();
    setSaving(true);
    const saveRequest: SaveExamRevisionRequest = {
      revisionId: revision.id,
      expectedVersion: exam.version,
      ...parsed.value,
      metadata: parsed.value.metadata,
      structuredResults: parsed.value.structuredResults.map((result) => {
        const original = originalResults.get(result.id);
        return {
          ...result,
          referenceLowerBound: original?.referenceLowerBound ?? null,
          referenceUpperBound: original?.referenceUpperBound ?? null,
        };
      }),
    };
    try {
      const saved = await onSaveDraft(saveRequest);
      if (intent === "draft") {
        if (saved.draftRevision) reset(revisionToForm(saved.draftRevision));
        onCompleted(saved);
        return;
      }
      const validated = await onValidate({
        revisionId: saved.draftRevision?.id ?? revision.id,
        clinicalOutcome: parsed.value.clinicalOutcome!,
        expectedVersion: saved.version,
      });
      onCompleted(validated);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
      } else {
        setServerError(error instanceof Error ? error.message : "Não foi possível salvar a revisão.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function classify() {
    if (!classificationCategory) return;
    setConflict(false);
    setServerError(null);
    setSaving(true);
    try {
      const classified = await onClassify({ category: classificationCategory, expectedVersion: exam.version });
      onCompleted(classified);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
      } else {
        setServerError(error instanceof Error ? error.message : "Não foi possível classificar o exame.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.reviewWorkspace}>
      <DocumentPreview key={exam.id} exam={exam} loadDocument={loadDocument} />

      <form className={styles.editor} aria-label="Corrigir resultados do exame" onSubmit={(event) => event.preventDefault()} noValidate>
        <header className={styles.progressHeader}>
          <div className={styles.progressHeading}>
            <div>
              <h2>Conferir dados extraídos</h2>
              <p>Compare com o laudo original, corrija se necessário e confirme cada item.</p>
            </div>
            {exam.capabilities.canDiscardExam && onDiscard ? (
              <div className={styles.reviewActions} role="region" aria-label="Ações da revisão">
                <ReviewExamDiscard
                  key={exam.id}
                  examId={exam.id}
                  onDiscard={onDiscard}
                  onReload={onReload}
                  placement="toolbar"
                />
              </div>
            ) : null}
          </div>
          <div className={styles.progressActions}>
            <strong className={allConfirmed ? styles.progressComplete : undefined}>{confirmedCount} de {reviewKeys.length} conferidos</strong>
            <Button type="button" variant="secondary" disabled={!reviewKeys.length || allConfirmed} onClick={() => setConfirmed(new Set(reviewKeys))}>Confirmar restantes</Button>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label="Progresso da conferência" aria-valuemin={0} aria-valuemax={reviewKeys.length} aria-valuenow={confirmedCount}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className={styles.editorBody}>
          <div className={styles.versionRow}>
            <span>Versão em edição {revision.number}</span>
            <span className={styles.reviewStatus}>Em revisão</span>
          </div>

          {isCorrection ? <p className={styles.correctionNote}>A versão validada atual permanece publicada até esta correção ser validada.</p> : null}

          {extractionWarnings.length ? (
            <section className={styles.extractionWarnings} aria-labelledby="editor-extraction-warnings-title">
              <TriangleAlert size={20} aria-hidden="true" />
              <div>
                <h3 id="editor-extraction-warnings-title">Pontos para conferir no laudo</h3>
                <ul>
                  {extractionWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            </section>
          ) : null}

          {exam.capabilities.canClassify ? (
            <section className={styles.decision} aria-labelledby="editor-classification-title">
              <div className={styles.sectionHeading}>
                <div><h3 id="editor-classification-title">Classificação clínica</h3><p>Defina a categoria para liberar a validação.</p></div>
              </div>
              <div className={styles.classificationControls}>
                <SelectField id="exam-editor-category" label="Categoria clínica do exame" value={classificationCategory} onChange={(event) => setClassificationCategory(event.target.value as ClassifyExamRequest["category"] | "")}>
                  <option value="">Selecione uma categoria</option>
                  {examRequestCategories.map((category) => <option key={category}>{category}</option>)}
                </SelectField>
                <Button type="button" variant="secondary" loading={saving} disabled={!classificationCategory} onClick={() => void classify()}>Classificar exame</Button>
              </div>
            </section>
          ) : null}

          <section className={styles.metadataSection} aria-labelledby="editor-metadata-title">
            <div className={styles.sectionHeading}><div><h3 id="editor-metadata-title">Dados do laudo</h3><p>Metadados que acompanharão esta versão.</p></div></div>
            <div className={styles.metadataGrid}>
              <Field id="exam-editor-collected-at" label="Data da coleta" type="datetime-local" {...register("metadata.collectedAtLocal")} />
              <Field id="exam-editor-issued-on" label="Emissão do laudo" type="date" {...register("metadata.issuedOn")} />
              <Field id="exam-editor-requester-name" label="Médico solicitante" {...register("metadata.requesterName")} />
              <Field id="exam-editor-requester-registration" label="Registro profissional" {...register("metadata.requesterRegistration")} />
            </div>
          </section>

          <section className={styles.collection} aria-labelledby="editor-results-title">
            <div className={styles.collectionHeading}>
              <div><h3 id="editor-results-title">Resultados <span>{results.fields.length}</span></h3><p>O estado é recalculado ao editar valores com limites numéricos.</p></div>
              <Button id="add-exam-result" type="button" variant="secondary" onClick={addResult}><Plus size={16} aria-hidden="true" />Adicionar resultado</Button>
            </div>
            <div className={styles.resultList}>
              {results.fields.map((field, index) => {
                const current = watchedResults?.[index] ?? field;
                const original = originalResults.get(field.id);
                const initial = initialResultValues.get(field.id);
                const key = itemKey("result", field.id);
                const checked = confirmed.has(key);
                const numericPrimary = original?.numericValue != null || current.numericValue !== "" && current.textValue === "";
                const rawValue = numericPrimary ? current.numericValue : current.textValue;
                const state = calculatedReferenceState(rawValue, original?.referenceLowerBound, original?.referenceUpperBound, current.referenceState);
                const lowConfidence = current.confidence !== "" && Number.isFinite(Number(current.confidence)) && Number(current.confidence) < LOW_CONFIDENCE_THRESHOLD;
                const edited = !initial || ["name", "numericValue", "textValue", "unit", "referenceText"].some((property) => current[property as keyof typeof current] !== initial[property as keyof typeof initial]);
                const nameRegistration = trackedRegistration(`structuredResults.${index}.name`, key);
                const valuePath = `structuredResults.${index}.${numericPrimary ? "numericValue" : "textValue"}` as FieldPath<ExamRevisionFormInput>;
                const valueRegistration = trackedRegistration(valuePath, key);
                const stateIsCalculated = original?.referenceLowerBound != null || original?.referenceUpperBound != null;
                return (
                  <fieldset key={field.formKey} className={clsx(styles.resultRow, checked && styles.itemConfirmed)} aria-label={field.editorKey}>
                    <legend className={styles.srOnly}>{field.editorKey}</legend>
                    <div className={styles.resultSummary}>
                      <div className={styles.resultIdentity}>
                        <Field id={controlId(field.editorKey, "name")} className={styles.resultNameField} label={`${field.editorKey} — nome`} error={errors.structuredResults?.[index]?.name?.message} {...nameRegistration} />
                        <div className={styles.resultBadges}>
                          <span className={clsx(styles.referenceState, (state === "elevado" || state === "baixo") && styles.referenceStateAlert)}>{referenceStateLabel(state, current.referenceText, original?.referenceLowerBound, original?.referenceUpperBound)}</span>
                          {edited ? <span className={styles.editedBadge}>Editado</span> : null}
                          {lowConfidence ? <span className={styles.confidenceBadge}>Revisar confiança</span> : null}
                        </div>
                      </div>
                      <div className={styles.valueGroup}>
                        <Field id={controlId(field.editorKey, numericPrimary ? "numeric-value" : "text-value")} className={clsx(styles.valueField, (state === "elevado" || state === "baixo") && styles.valueFieldAlert)} label={`${field.editorKey} — valor`} inputMode={numericPrimary ? "decimal" : undefined} error={numericPrimary ? errors.structuredResults?.[index]?.numericValue?.message : errors.structuredResults?.[index]?.textValue?.message} {...valueRegistration} />
                        <span>{current.unit || "sem unidade"}</span>
                      </div>
                      <p className={styles.referenceText}><span>Referência</span>{current.referenceText || "Não informada"}</p>
                      <ConfirmationButton checked={checked} label={current.name || field.editorKey} onToggle={() => toggleConfirmed(key)} />
                    </div>
                    <details className={styles.advancedFields} open={openItems.has(key)} onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setOpenItems((currentOpen) => {
                        const next = new Set(currentOpen);
                        if (isOpen) next.add(key); else next.delete(key);
                        return next;
                      });
                    }}>
                      <summary>Campos complementares e ações</summary>
                      <div className={styles.advancedGrid}>
                        <Field id={controlId(field.editorKey, "catalog-code")} label="Código (opcional)" error={errors.structuredResults?.[index]?.catalogCode?.message} {...trackedRegistration(`structuredResults.${index}.catalogCode`, key)} />
                        {numericPrimary
                          ? <Field id={controlId(field.editorKey, "text-value")} label="Valor textual original" error={errors.structuredResults?.[index]?.textValue?.message} {...trackedRegistration(`structuredResults.${index}.textValue`, key)} />
                          : <Field id={controlId(field.editorKey, "numeric-value")} label="Valor numérico normalizado" inputMode="decimal" error={errors.structuredResults?.[index]?.numericValue?.message} {...trackedRegistration(`structuredResults.${index}.numericValue`, key)} />}
                        <Field id={controlId(field.editorKey, "unit")} label="Unidade" error={errors.structuredResults?.[index]?.unit?.message} {...trackedRegistration(`structuredResults.${index}.unit`, key)} />
                        <Field id={controlId(field.editorKey, "reference")} label="Referência" error={errors.structuredResults?.[index]?.referenceText?.message} {...trackedRegistration(`structuredResults.${index}.referenceText`, key)} />
                        <SelectField id={controlId(field.editorKey, "out-of-range")} label="Fora da referência" {...trackedRegistration(`structuredResults.${index}.outOfRangeSuggestion`, key)}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></SelectField>
                        <SelectField id={controlId(field.editorKey, "reference-state")} label="Estado de referência" disabled={stateIsCalculated} hint={stateIsCalculated ? "Recalculado ao salvar a partir dos limites numéricos." : undefined} {...trackedRegistration(`structuredResults.${index}.referenceState`, key)}>
                          <option value="indeterminado">Indeterminado</option><option value="normal">Normal</option><option value="elevado">Elevado</option><option value="baixo">Baixo</option><option value="limítrofe">Limítrofe</option>
                        </SelectField>
                        <Field id={controlId(field.editorKey, "confidence")} label="Confiança" inputMode="decimal" hint="De 0 a 1; opcional." error={errors.structuredResults?.[index]?.confidence?.message} {...trackedRegistration(`structuredResults.${index}.confidence`, key)} />
                      </div>
                      <div className={styles.itemActions}>
                        <Button type="button" variant="ghost" disabled={index === 0} aria-label={`Mover ${field.editorKey} para cima`} onClick={() => results.move(index, index - 1)}><ArrowUp size={16} aria-hidden="true" />Mover para cima</Button>
                        <Button type="button" variant="ghost" disabled={index === results.fields.length - 1} aria-label={`Mover ${field.editorKey} para baixo`} onClick={() => results.move(index, index + 1)}><ArrowDown size={16} aria-hidden="true" />Mover para baixo</Button>
                        <Button type="button" variant="ghost" aria-label={`Remover ${field.editorKey}`} onClick={() => removeWithFocus(results.fields, index, results.remove, "name", "add-exam-result", "result")}><Trash2 size={16} aria-hidden="true" />Remover</Button>
                      </div>
                    </details>
                  </fieldset>
                );
              })}
            </div>
          </section>

          {clinicalSections.length ? <section className={styles.collection} aria-labelledby="editor-sections-title">
            <div className={styles.collectionHeading}>
              <div><h3 id="editor-sections-title">Narrativas clínicas <span>{clinicalSections.length}</span></h3><p>Confira conclusões, impressões e limitações relevantes para a análise.</p></div>
            </div>
            <div className={styles.noteList}>
              {clinicalSections.map(({ field, index }) => {
                const current = watchedSections?.[index] ?? field;
                const key = itemKey("section", field.id);
                const checked = confirmed.has(key);
                const open = openItems.has(key);
                const low = current.confidence !== "" && Number.isFinite(Number(current.confidence)) && Number(current.confidence) < LOW_CONFIDENCE_THRESHOLD;
                return (
                  <article key={field.formKey} className={clsx(styles.noteRow, checked && styles.itemConfirmed)}>
                    <div className={styles.noteHeader}>
                      <button type="button" className={styles.noteToggle} aria-expanded={open} aria-controls={`${controlId(field.editorKey, "content")}`} onClick={() => toggleOpen(key)}>
                        <span>{current.title || field.editorKey}</span><ChevronDown size={16} aria-hidden="true" />
                      </button>
                      {low ? <span className={styles.confidenceBadge}>Revisar confiança</span> : null}
                      <ConfirmationButton checked={checked} label={current.title || field.editorKey} onToggle={() => toggleConfirmed(key)} />
                    </div>
                    {open ? (
                      <div id={controlId(field.editorKey, "content")} className={styles.noteContent}>
                        <Field id={controlId(field.editorKey, "title")} label={`${field.editorKey} — título`} error={errors.narrativeSections?.[index]?.title?.message} {...trackedRegistration(`narrativeSections.${index}.title`, key)} />
                        <TextAreaField id={controlId(field.editorKey, "text")} label={`${field.editorKey} — texto`} error={errors.narrativeSections?.[index]?.text?.message} registration={trackedRegistration(`narrativeSections.${index}.text`, key)} />
                        <Field id={controlId(field.editorKey, "confidence")} label={`${field.editorKey} — confiança`} inputMode="decimal" error={errors.narrativeSections?.[index]?.confidence?.message} {...trackedRegistration(`narrativeSections.${index}.confidence`, key)} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section> : null}

          {additionalSections.length || laboratoryFindings.length ? (
            <details className={styles.additionalContent}>
              <summary>Conteúdo adicional do laudo <span>{additionalSections.length + laboratoryFindings.length}</span></summary>
              <p className={styles.additionalHint}>Informações preservadas para consulta e auditoria. Elas não exigem conferência.</p>
              <div className={styles.additionalList}>
                {additionalSections.map(({ field, index }) => {
                  const current = watchedSections?.[index] ?? field;
                  return (
                    <article key={field.formKey}>
                      <h4>{current.title || "Seção sem título"}</h4>
                      <p>{current.text || "Sem conteúdo informado."}</p>
                    </article>
                  );
                })}
                {laboratoryFindings.map(({ field, index }) => {
                  const current = watchedFindings?.[index] ?? field;
                  return (
                    <article key={field.formKey}>
                      <h4>{current.key || "Achado sem identificação"}</h4>
                      <p>{current.value || "Sem conteúdo informado."}</p>
                    </article>
                  );
                })}
              </div>
            </details>
          ) : null}

          {exam.category !== "Laboratório" ? <section className={styles.collection} aria-labelledby="editor-findings-title">
            <div className={styles.collectionHeading}>
              <div><h3 id="editor-findings-title">Achados estruturados <span>{findings.fields.length}</span></h3><p>Confirme também os achados que acompanham o laudo.</p></div>
              <Button id="add-exam-finding" type="button" variant="secondary" onClick={addFinding}><Plus size={16} aria-hidden="true" />Adicionar achado</Button>
            </div>
            <div className={styles.findingList}>
              {findings.fields.map((field, index) => {
                const current = watchedFindings?.[index] ?? field;
                const key = itemKey("finding", field.id);
                const checked = confirmed.has(key);
                const low = current.confidence !== "" && Number.isFinite(Number(current.confidence)) && Number(current.confidence) < LOW_CONFIDENCE_THRESHOLD;
                return (
                  <fieldset key={field.formKey} className={clsx(styles.findingRow, checked && styles.itemConfirmed)} aria-label={field.editorKey}>
                    <legend className={styles.srOnly}>{field.editorKey}</legend>
                    <div className={styles.findingFields}>
                      <Field id={controlId(field.editorKey, "key")} label={`${field.editorKey} — chave`} error={errors.structuredFindings?.[index]?.key?.message} {...trackedRegistration(`structuredFindings.${index}.key`, key)} />
                      <Field id={controlId(field.editorKey, "value")} label={`${field.editorKey} — valor`} error={errors.structuredFindings?.[index]?.value?.message} {...trackedRegistration(`structuredFindings.${index}.value`, key)} />
                    </div>
                    {low ? <span className={styles.confidenceBadge}>Revisar confiança</span> : null}
                    <ConfirmationButton checked={checked} label={current.key || field.editorKey} onToggle={() => toggleConfirmed(key)} />
                    <details className={styles.advancedFields}>
                      <summary>Confiança e ações</summary>
                      <Field id={controlId(field.editorKey, "confidence")} label={`${field.editorKey} — confiança`} inputMode="decimal" error={errors.structuredFindings?.[index]?.confidence?.message} {...trackedRegistration(`structuredFindings.${index}.confidence`, key)} />
                      <div className={styles.itemActions}>
                        <Button type="button" variant="ghost" disabled={index === 0} aria-label={`Mover ${field.editorKey} para cima`} onClick={() => findings.move(index, index - 1)}><ArrowUp size={16} aria-hidden="true" />Mover para cima</Button>
                        <Button type="button" variant="ghost" disabled={index === findings.fields.length - 1} aria-label={`Mover ${field.editorKey} para baixo`} onClick={() => findings.move(index, index + 1)}><ArrowDown size={16} aria-hidden="true" />Mover para baixo</Button>
                        <Button type="button" variant="ghost" aria-label={`Remover ${field.editorKey}`} onClick={() => removeWithFocus(findings.fields, index, findings.remove, "key", "add-exam-finding", "finding")}><Trash2 size={16} aria-hidden="true" />Remover</Button>
                      </div>
                    </details>
                  </fieldset>
                );
              })}
            </div>
          </section> : null}

          <section className={styles.decision} aria-labelledby="editor-decision-title">
            <div className={styles.sectionHeading}><div><h3 id="editor-decision-title">Decisão clínica</h3><p>Escolha a conclusão que será publicada após a validação.</p></div></div>
            <SelectField id="exam-editor-clinical-outcome" label="Conclusão clínica" error={errors.clinicalOutcome?.message} {...register("clinicalOutcome")}><option value="">Selecione ao validar</option>{clinicalOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}</SelectField>
            {isCorrection ? <TextAreaField id="exam-editor-correction-reason" label="Motivo da correção" error={errors.correctionReason?.message} registration={register("correctionReason")} /> : null}
          </section>

          {errors.root?.content?.message ? <p className={styles.errorBanner} role="alert">{errors.root.content.message}</p> : null}
          {conflict ? <div className={styles.conflict} role="alert"><span>Os dados deste exame mudaram. Seus campos foram preservados.</span><Button type="button" variant="secondary" onClick={onReload}>Recarregar dados atuais</Button></div> : null}
          {serverError ? <p className={styles.errorBanner} role="alert">{serverError}</p> : null}
        </div>

        <footer className={styles.footer}>
          <p className={allConfirmed ? styles.footerReady : undefined} role="status">
            {allConfirmed ? "Tudo conferido. Escolha a conclusão clínica e valide o laudo." : "Confira todos os itens para habilitar a validação. Edições são registradas no histórico."}
          </p>
          <div>
            <Button type="button" variant="secondary" loading={saving} onClick={() => void submit("draft")}>Salvar rascunho</Button>
            {exam.capabilities.canValidate ? <Button type="button" loading={saving} disabled={!allConfirmed || !watchedOutcome} onClick={() => void submit("validate")}>Validar laudo</Button> : null}
          </div>
        </footer>
      </form>
    </div>
  );
}
