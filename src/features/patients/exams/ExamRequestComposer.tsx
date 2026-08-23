import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../../api/client";
import type {
  CancelExamRequest,
  CreateExamRequest,
  PatientExamDetail,
  UpdateExamRequest,
} from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, SelectField } from "../../../components/Field";
import {
  examRequestCategories,
  examRequestSchema,
  type ExamRequestFormInput,
  type ExamRequestFormValue,
} from "./examRequestForm";
import styles from "./ExamRequestComposer.module.css";

interface ExamRequestComposerProps {
  canRequest: boolean;
  openInitially: boolean;
  showCreateTrigger?: boolean;
  exam: PatientExamDetail | null;
  onCreate(request: CreateExamRequest): Promise<PatientExamDetail>;
  onUpdate(examId: string, request: UpdateExamRequest): Promise<PatientExamDetail>;
  onCancel(examId: string, request: CancelExamRequest): Promise<PatientExamDetail>;
  onCompleted(exam: PatientExamDetail): void;
  onReload(): void;
  onClose?(): void;
}

const emptyValue: ExamRequestFormInput = { name: "", category: "", scheduledOn: "" };

export function ExamRequestComposer({
  canRequest,
  openInitially,
  showCreateTrigger = true,
  exam,
  onCreate,
  onUpdate,
  onCancel,
  onCompleted,
  onReload,
  onClose,
}: ExamRequestComposerProps) {
  const [open, setOpen] = useState(openInitially);
  const [conflict, setConflict] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const editable = Boolean(exam && !exam.document && exam.capabilities.canEditRequest);
  const cancellable = Boolean(exam && !exam.document && exam.capabilities.canCancelRequest);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExamRequestFormInput, unknown, ExamRequestFormValue>({
    resolver: zodResolver(examRequestSchema),
    defaultValues: emptyValue,
  });

  useEffect(() => {
    if (showCreateTrigger && !openInitially) return;
    queueMicrotask(() => setOpen(openInitially));
  }, [openInitially, showCreateTrigger]);

  if (!canRequest && !editable && !cancellable) return null;

  function openCreate() {
    reset(emptyValue);
    setConflict(false);
    setServerError(null);
    setOpen(true);
  }

  function closeComposer() {
    if (!exam) reset(emptyValue);
    setConflict(false);
    setServerError(null);
    setOpen(false);
    onClose?.();
  }

  function openEdit() {
    if (!exam) return;
    reset({
      name: exam.name,
      category: exam.category === "Não classificado" ? "" : exam.category,
      scheduledOn: exam.scheduledOn ?? "",
    });
    setConflict(false);
    setServerError(null);
    setOpen(true);
  }

  function applyApiError(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setConflict(true);
      return;
    }
    if (error instanceof ApiError && error.problem?.errors) {
      const fields: Array<[string, keyof ExamRequestFormInput]> = [
        ["Name", "name"],
        ["Category", "category"],
        ["ScheduledOn", "scheduledOn"],
      ];
      for (const [serverField, field] of fields) {
        const message = error.problem.errors[serverField]?.[0];
        if (message) {
          setError(field, { type: "server", message }, { shouldFocus: true });
          return;
        }
      }
    }
    setServerError(error instanceof Error ? error.message : "Não foi possível salvar a solicitação.");
  }

  async function submit(value: ExamRequestFormValue) {
    setConflict(false);
    setServerError(null);
    try {
      const result = exam
        ? await onUpdate(exam.id, { ...value, expectedVersion: exam.version })
        : await onCreate(value);
      reset(emptyValue);
      setOpen(false);
      onCompleted(result);
    } catch (error) {
      applyApiError(error);
    }
  }

  async function cancelRequest() {
    if (!exam) return;
    setConflict(false);
    setServerError(null);
    setCancelling(true);
    try {
      onCompleted(await onCancel(exam.id, { expectedVersion: exam.version }));
    } catch (error) {
      applyApiError(error);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.triggers}>
        {showCreateTrigger && canRequest && !exam ? (
          <Button type="button" variant="secondary" onClick={openCreate}>
            Solicitar exame
          </Button>
        ) : null}
        {editable ? (
          <Button type="button" variant="secondary" onClick={openEdit}>
            Editar solicitação
          </Button>
        ) : null}
        {cancellable ? (
          <Button
            type="button"
            variant="danger"
            loading={cancelling}
            onClick={() => void cancelRequest()}
          >
            Cancelar solicitação
          </Button>
        ) : null}
      </div>

      {open ? (
        <section
          className={styles.composer}
          role="region"
          aria-label={exam ? "Editar solicitação" : "Solicitar exame"}
        >
          <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
            <Field
              label="Nome do exame"
              autoComplete="off"
              error={errors.name?.message}
              {...register("name")}
            />
            <SelectField label="Categoria" error={errors.category?.message} {...register("category")}>
              <option value="">Selecione</option>
              {examRequestCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </SelectField>
            <Field
              label="Data prevista (opcional)"
              type="date"
              error={errors.scheduledOn?.message}
              {...register("scheduledOn")}
            />

            {conflict ? (
              <div className={styles.conflict} role="alert">
                <span>Os dados deste exame mudaram. Seus campos foram preservados.</span>
                <Button type="button" variant="secondary" onClick={onReload}>
                  Recarregar dados atuais
                </Button>
              </div>
            ) : null}
            {serverError ? <p className={styles.serverError} role="alert">{serverError}</p> : null}

            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={closeComposer}>
                Fechar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {exam ? "Salvar solicitação" : "Criar solicitação"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
