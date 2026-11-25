import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ClinicHealthcarePlans,
  HealthcarePlan,
  UserClinicHealthcarePlans,
} from "../../api/types";
import { useUnsavedChangesGuard } from "../../app/unsavedChanges";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { Button } from "../../components/Button";
import {
  ErrorBlock,
  InlineError,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { DoctorPlansEditor } from "./DoctorPlansEditor";
import { healthcarePlanModeLabels } from "./healthcarePlanLabels";
import {
  clinicHealthcarePlansKey,
  clinicMembersSummaryKey,
  doctorHealthcarePlansKey,
  healthcarePlanCatalogKey,
} from "./healthcarePlanQueries";
import {
  type ClinicDraft,
  clinicDraftFromSaved,
  type DoctorDraft,
  doctorDraftFromSaved,
  doctorSelectedIds,
  isDoctorDirty,
} from "./healthcarePlansDraft";
import plansStyles from "./HealthcarePlansSettingsPage.module.css";
import styles from "./SettingsLayout.module.css";

/**
 * Cartão da aba "Convênios" de Meu perfil: os convênios do médico da sessão nesta
 * clínica. Quem administra a clínica edita aqui mesmo, com salvar próprio; os demais
 * médicos só consultam, porque a API reserva a alteração ao administrador.
 */
export function DoctorPlansPanel({ doctorName }: { doctorName: string }) {
  const { request, session } = useAuth();
  const clinicId = session?.clinicId;
  const userClinicId = session?.userClinicId ?? "";
  const canEdit = Boolean(session && can(session, "ManageHealthcarePlans"));
  const enabled = Boolean(clinicId && userClinicId);

  const catalog = useQuery({
    queryKey: healthcarePlanCatalogKey,
    enabled,
    queryFn: () => request<HealthcarePlan[]>("/healthcare-plans"),
  });
  const clinicPlans = useQuery({
    queryKey: clinicHealthcarePlansKey,
    enabled,
    queryFn: () =>
      request<ClinicHealthcarePlans>("/clinics/current/healthcare-plans"),
  });
  const ownPlans = useQuery({
    queryKey: doctorHealthcarePlansKey(userClinicId),
    enabled,
    queryFn: () =>
      request<UserClinicHealthcarePlans>(
        `/clinics/${clinicId}/members/${userClinicId}/healthcare-plans`,
      ),
  });

  if (!enabled) return null;

  return (
    <section className={styles.panel} aria-labelledby="profile-plans-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="profile-plans-title">Convênios</h2>
          <p>
            Os convênios que você atende nesta clínica. É a lista oferecida ao agendar
            uma consulta com você.
          </p>
        </div>
      </div>
      {catalog.isLoading || clinicPlans.isLoading || ownPlans.isLoading ? (
        <LoadingBlock label="Carregando seus convênios…" />
      ) : !catalog.data || !clinicPlans.data || !ownPlans.data ? (
        <ErrorBlock
          message="Não foi possível carregar seus convênios."
          retry={() => {
            void catalog.refetch();
            void clinicPlans.refetch();
            void ownPlans.refetch();
          }}
        />
      ) : canEdit ? (
        <EditablePlans
          doctorName={doctorName}
          clinicId={clinicId!}
          plans={catalog.data}
          clinic={clinicDraftFromSaved(clinicPlans.data)}
          saved={ownPlans.data}
        />
      ) : (
        <ReadOnlyPlans
          plans={catalog.data}
          clinic={clinicDraftFromSaved(clinicPlans.data)}
          saved={ownPlans.data}
        />
      )}
    </section>
  );
}

function EditablePlans({
  doctorName,
  clinicId,
  plans,
  clinic,
  saved,
}: {
  doctorName: string;
  clinicId: string;
  plans: HealthcarePlan[];
  clinic: ClinicDraft;
  saved: UserClinicHealthcarePlans;
}) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  // Sem rascunho a tela mostra o que está salvo, inclusive depois de salvar.
  const [draft, setDraft] = useState<DoctorDraft | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const baseline = doctorDraftFromSaved(saved);
  const current = draft ?? baseline;
  const dirty = isDoctorDirty(current, baseline, clinic);
  useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: () =>
      request<UserClinicHealthcarePlans>(
        `/clinics/${clinicId}/members/${saved.userClinicId}/healthcare-plans`,
        {
          method: "PUT",
          body: JSON.stringify({
            mode: current.mode,
            healthcarePlanIds:
              current.mode === "Custom" ? doctorSelectedIds(current, clinic) : [],
          }),
        },
      ),
    onMutate: () => setSavedNote(false),
    onSuccess: (value) => {
      queryClient.setQueryData(doctorHealthcarePlansKey(saved.userClinicId), value);
      void queryClient.invalidateQueries({ queryKey: clinicMembersSummaryKey });
      void queryClient.invalidateQueries({ queryKey: ["new-appointment"] });
      setDraft(null);
      setSavedNote(true);
    },
  });

  return (
    <>
      <DoctorPlansEditor
        doctorName={doctorName}
        plans={plans}
        clinic={clinic}
        draft={current}
        savedCustomPlanIds={saved.mode === "Custom" ? saved.healthcarePlanIds : null}
        disabled={save.isPending}
        listHeadingAs="h3"
        onChange={(next) => {
          setDraft(next);
          setSavedNote(false);
          save.reset();
        }}
      />
      <div className={styles.actions}>
        {savedNote && !dirty ? <SuccessNote>Convênios atualizados.</SuccessNote> : null}
        {save.isError ? (
          <InlineError>
            {save.error instanceof ApiError
              ? save.error.message
              : "Não foi possível salvar os convênios."}
          </InlineError>
        ) : null}
        <Button
          type="button"
          loading={save.isPending}
          disabled={!dirty}
          onClick={() => save.mutate()}
        >
          Salvar convênios
        </Button>
      </div>
    </>
  );
}

function ReadOnlyPlans({
  plans,
  clinic,
  saved,
}: {
  plans: HealthcarePlan[];
  clinic: ClinicDraft;
  saved: UserClinicHealthcarePlans;
}) {
  const attended = plans.filter((plan) =>
    doctorSelectedIds(doctorDraftFromSaved(saved), clinic).includes(plan.id),
  );

  return (
    <div className={plansStyles.readOnlySummary}>
      <p className={plansStyles.readOnlyOrigin}>
        Origem:
        {saved.mode === "ClinicDefault" ? (
          <span className={plansStyles.definedTag}>
            <Star size={12} fill="currentColor" aria-hidden="true" />
            {healthcarePlanModeLabels.ClinicDefault}
          </span>
        ) : (
          <span className={plansStyles.neutralTag}>
            {healthcarePlanModeLabels.Custom}
          </span>
        )}
      </p>
      {attended.length > 0 ? (
        <ul className={plansStyles.readOnlyPlans} aria-label="Convênios que você atende">
          {attended.map((plan) => (
            <li key={plan.id}>{plan.name}</li>
          ))}
        </ul>
      ) : (
        <p className={plansStyles.hint}>
          Você atende apenas consulta particular nesta clínica.
        </p>
      )}
      <p className={plansStyles.hint}>
        Os convênios são definidos pela administração da clínica. Para incluir ou
        retirar um convênio, fale com um administrador. Consulta particular está
        sempre disponível.
      </p>
    </div>
  );
}
