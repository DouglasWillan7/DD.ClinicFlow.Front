import { CircleOff, UserRoundCheck } from "lucide-react";
import type { ExistingPatientPreview } from "../../api/types";
import { Button } from "../../components/Button";
import { InlineError } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { formatBloodType, formatDateOnly } from "./patientFormatters";
import styles from "./PatientRegistrationForm.module.css";

interface ExistingPatientConfirmationProps {
  patient: ExistingPatientPreview;
  /** Documento já formatado para exibição (ex.: "CPF 529.982.247-25"). */
  documentLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  pending: boolean;
  serverError: string | null;
}

const notInformed = "Não informado";

/**
 * A pessoa já existe no cadastro global. A recepção só confere os dados: confirmar
 * cria o vínculo com a clínica, sem cadastrar outro paciente. É somente leitura
 * porque o cadastro é compartilhado: corrigir aqui mudaria o dado para as outras
 * clínicas sem que a recepção percebesse; a correção fica para a tela de edição.
 */
export function ExistingPatientConfirmation({
  patient,
  documentLabel,
  onConfirm,
  onBack,
  onCancel,
  pending,
  serverError,
}: ExistingPatientConfirmationProps) {
  return (
    <div className={styles.registration}>
      <section className={styles.card} aria-labelledby="existing-patient-title" aria-busy={pending}>
        <header className={styles.header}>
          <div className={styles.badges}>
            <StatusBadge tone="info" icon={UserRoundCheck}>Cadastro existente</StatusBadge>
            {patient.isActive ? null : (
              <StatusBadge tone="neutral" icon={CircleOff}>Inativo</StatusBadge>
            )}
          </div>
          <h1 id="existing-patient-title">Confirme os dados do paciente</h1>
          <p>
            Este documento já tem cadastro no ClinicFlow. Confira os dados com a pessoa:
            ao confirmar, ela passa a ser paciente desta clínica e nenhum cadastro novo é criado.
          </p>
        </header>

        <dl className={styles.summary}>
          <div>
            <dt>Nome completo</dt>
            <dd>{patient.name}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{documentLabel}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>{patient.phone}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{patient.email ?? notInformed}</dd>
          </div>
          <div>
            <dt>Data de nascimento</dt>
            <dd>{patient.birthDate ? formatDateOnly(patient.birthDate) : notInformed}</dd>
          </div>
          <div>
            <dt>Tipo sanguíneo</dt>
            <dd>{patient.bloodType ? formatBloodType(patient.bloodType) : notInformed}</dd>
          </div>
          <div>
            <dt>Sexo para referência laboratorial</dt>
            <dd>{patient.sexForClinicalUse ?? notInformed}</dd>
          </div>
          <div className={styles.summaryWide}>
            <dt>Observações</dt>
            <dd>{patient.notes?.trim() || "Sem observações"}</dd>
          </div>
        </dl>

        {patient.isActive ? null : (
          <p className={styles.note}>
            Este cadastro está inativo. Ao confirmar, ele volta a ficar ativo.
          </p>
        )}
        <p className={styles.note}>
          O vínculo não dá acesso ao prontuário: o acesso médico nasce apenas do
          consentimento do paciente.
        </p>

        {serverError ? <InlineError>{serverError}</InlineError> : null}

        <div className={styles.actions}>
          {pending ? null : (
            <Button type="button" variant="secondary" onClick={onBack}>
              Voltar
            </Button>
          )}
          <Button
            type="button"
            className={styles.primary}
            loading={pending}
            loadingLabel="Vinculando paciente…"
            onClick={onConfirm}
          >
            Confirmar e vincular
          </Button>
        </div>
      </section>

      <Button type="button" variant="ghost" className={styles.cancel} onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
