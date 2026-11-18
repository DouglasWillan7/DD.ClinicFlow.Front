import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ApiError } from "../../../api/client";
import type { Prescription } from "../../../api/types";
import {
  useConfirmDiscard,
  useUnsavedChangesGuard,
} from "../../../app/unsavedChanges";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { InlineError } from "../../../components/Feedback";
import { TextAreaField } from "../../../components/Field";
import {
  prescriptionContentMaxLength,
  prescriptionLengthHint,
  prescriptionSchema,
  type PrescriptionFormInput,
  type PrescriptionFormValue,
} from "./prescriptionForm";
import styles from "./PrescriptionComposerDialog.module.css";

export interface PrescriptionComposerDialogProps {
  patientName: string;
  /**
   * Receita usada como base: o texto chega copiado e a emissão cria outra
   * receita. A original nunca é alterada (pode até estar cancelada).
   */
  base: { content: string; issuedOn: string } | null;
  onIssue(content: string): Promise<Prescription>;
  onIssued(prescription: Prescription): void;
  onClose(): void;
}

/**
 * Formulário de emissão. Monte só enquanto estiver aberto: cada abertura começa
 * do texto da base (ou vazio) sem efeito para limpar estado.
 */
export function PrescriptionComposerDialog({
  patientName,
  base,
  onIssue,
  onIssued,
  onClose,
}: PrescriptionComposerDialogProps) {
  const formId = useId();
  const noticeId = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PrescriptionFormInput, unknown, PrescriptionFormValue>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { content: base?.content ?? "" },
  });
  const content = useWatch({ control, name: "content" });

  // `autoFocus` não serve aqui: o React chama focus() antes de o <dialog> abrir
  // (fechado, nada dentro dele recebe foco) e o showModal() escolhe o foco
  // inicial por conta própria. O efeito roda depois da abertura.
  useEffect(() => {
    setFocus("content");
  }, [setFocus]);

  // Só o que foi digitado conta como alteração: o texto copiado da base continua
  // existindo na receita original, então fechar sem mexer nele não pergunta nada.
  useUnsavedChangesGuard(isDirty);
  const confirmDiscard = useConfirmDiscard();

  function close() {
    if (isSubmitting) return;
    confirmDiscard(onClose);
  }

  async function submit(value: PrescriptionFormValue) {
    setServerError(null);
    try {
      onIssued(await onIssue(value.content));
    } catch (error) {
      const fieldMessage =
        error instanceof ApiError ? error.problem?.errors?.Content?.[0] : undefined;
      if (fieldMessage) {
        setError("content", { type: "server", message: fieldMessage }, { shouldFocus: true });
        return;
      }
      setServerError(
        error instanceof Error ? error.message : "Não foi possível emitir a receita.",
      );
    }
  }

  return (
    <Dialog
      size="lg"
      title="Nova receita"
      description={
        base
          ? `Paciente: ${patientName}. Texto copiado da receita de ${base.issuedOn}; a original continua como está.`
          : `Paciente: ${patientName}.`
      }
      closeLabel="Fechar nova receita"
      dismissible={!isSubmitting}
      onClose={close}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={close}>
            Fechar
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={isSubmitting}
            aria-describedby={noticeId}
          >
            Emitir receita
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <TextAreaField
          label="Texto da receita"
          rows={12}
          maxLength={prescriptionContentMaxLength}
          hint={prescriptionLengthHint(content ?? "")}
          error={errors.content?.message}
          {...register("content")}
        />
        <p id={noticeId} className={styles.notice}>
          <LockKeyhole size={16} aria-hidden="true" />
          <span>Depois de emitida, a receita não pode ser editada.</span>
        </p>
        {serverError ? <InlineError>{serverError}</InlineError> : null}
      </form>
    </Dialog>
  );
}
