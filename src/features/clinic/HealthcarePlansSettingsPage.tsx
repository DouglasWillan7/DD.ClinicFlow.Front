import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ClinicHealthcarePlans,
  ClinicHealthcarePlansImpact,
  HealthcarePlan,
  Member,
  UserClinicHealthcarePlans,
} from "../../api/types";
import { useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { PageHeader } from "../../components/PageHeader";
import { ClinicPlansDetail } from "./ClinicPlansDetail";
import { ClinicSettingsTabs } from "./ClinicSettingsTabs";
import { type CopySource, DoctorPlansDetail } from "./DoctorPlansDetail";
import {
  clinicSummaryLabel,
  healthcarePlanModeLabels,
  planCountLabel,
} from "./healthcarePlanLabels";
import {
  CLINIC_ITEM,
  type ClinicDraft,
  clinicDraftFromSaved,
  countDoctorsByPlan,
  type DoctorDraft,
  doctorDraftFromSaved,
  isClinicDirty,
  isDoctorDirty,
  normalizeClinicDraft,
  restoreClinicPlan,
  withoutKey,
} from "./healthcarePlansDraft";
import { PlansImpactDialog } from "./PlansImpactDialog";
import {
  type DoctorNavItem,
  type DoctorStatus,
  PlansNavigation,
} from "./PlansNavigation";
import { UnsavedChangesBar } from "./UnsavedChangesBar";
import styles from "./HealthcarePlansSettingsPage.module.css";

const catalogKey = ["healthcare-plans", "catalog"] as const;
const clinicPlansKey = ["healthcare-plans", "clinic"] as const;
const membersKey = ["clinic", "members"] as const;
const doctorPlansKey = (userClinicId: string) =>
  ["healthcare-plans", "doctor", userClinicId] as const;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível salvar.";
}

export function HealthcarePlansSettingsPage() {
  const { request, session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const clinicId = session?.clinicId;
  // Rascunhos por item: trocar de item não perde o que foi editado.
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft | null>(null);
  const [doctorDrafts, setDoctorDrafts] = useState<Record<string, DoctorDraft>>({});
  const [savedItem, setSavedItem] = useState<string | null>(null);
  const [impact, setImpact] = useState<ClinicHealthcarePlansImpact | null>(null);

  const catalog = useQuery({
    queryKey: catalogKey,
    queryFn: () => request<HealthcarePlan[]>("/healthcare-plans"),
  });
  const clinicPlans = useQuery({
    queryKey: clinicPlansKey,
    queryFn: () =>
      request<ClinicHealthcarePlans>("/clinics/current/healthcare-plans"),
  });
  const members = useQuery({
    queryKey: membersKey,
    enabled: Boolean(clinicId),
    queryFn: () => request<Member[]>(`/clinics/${clinicId}/members/summary`),
  });

  const doctors = useMemo(
    () => (members.data ?? []).filter((member) => member.role === "Doctor"),
    [members.data],
  );
  const doctorIds = useMemo(
    () => doctors.map((doctor) => doctor.userClinicId),
    [doctors],
  );
  // As listas de todos os médicos alimentam a contagem por convênio e o "copiar de outro".
  const doctorQueries = useQueries({
    queries: doctorIds.map((userClinicId) => ({
      queryKey: doctorPlansKey(userClinicId),
      enabled: Boolean(clinicId),
      queryFn: () =>
        request<UserClinicHealthcarePlans>(
          `/clinics/${clinicId}/members/${userClinicId}/healthcare-plans`,
        ),
    })),
  });

  const requestedItem = searchParams.get("item");
  const selectedItem =
    requestedItem && doctorIds.includes(requestedItem) ? requestedItem : CLINIC_ITEM;

  function select(item: string) {
    setSavedItem(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (item === CLINIC_ITEM) next.delete("item");
      else next.set("item", item);
      return next;
    });
  }

  const savedClinic = useMemo(
    () => (clinicPlans.data ? clinicDraftFromSaved(clinicPlans.data) : null),
    [clinicPlans.data],
  );

  const saveClinic = useMutation({
    mutationFn: async ({ confirmed }: { confirmed: boolean }) => {
      const current = normalizeClinicDraft(clinicDraft!);
      const body = JSON.stringify({
        healthcarePlanIds: current.accepted,
        defaultHealthcarePlanIds: current.defaults,
      });
      if (!confirmed) {
        const preview = await request<ClinicHealthcarePlansImpact>(
          "/clinics/current/healthcare-plans/impact",
          { method: "POST", body },
        );
        if (preview.removals.length > 0) return preview;
      }
      const saved = await request<ClinicHealthcarePlans>(
        "/clinics/current/healthcare-plans",
        { method: "PUT", body },
      );
      queryClient.setQueryData(clinicPlansKey, saved);
      // Aceitos e padrão mudam o que cada médico atende.
      void queryClient.invalidateQueries({ queryKey: ["healthcare-plans", "doctor"] });
      void queryClient.invalidateQueries({ queryKey: membersKey });
      void queryClient.invalidateQueries({ queryKey: ["new-appointment"] });
      return null;
    },
    onSuccess: (pendingImpact) => {
      setImpact(pendingImpact);
      if (pendingImpact) return;
      setClinicDraft(null);
      setSavedItem(CLINIC_ITEM);
    },
    onError: () => setImpact(null),
  });

  const saveDoctor = useMutation({
    mutationFn: async ({
      userClinicId,
      draft,
    }: {
      userClinicId: string;
      draft: DoctorDraft;
    }) => {
      const saved = await request<UserClinicHealthcarePlans>(
        `/clinics/${clinicId}/members/${userClinicId}/healthcare-plans`,
        {
          method: "PUT",
          body: JSON.stringify({
            mode: draft.mode,
            healthcarePlanIds: draft.mode === "Custom" ? draft.planIds : [],
          }),
        },
      );
      queryClient.setQueryData(doctorPlansKey(userClinicId), saved);
      void queryClient.invalidateQueries({ queryKey: membersKey });
      void queryClient.invalidateQueries({ queryKey: ["new-appointment"] });
    },
    onSuccess: (_, { userClinicId }) => {
      setDoctorDrafts((current) => withoutKey(current, userClinicId));
      setSavedItem(userClinicId);
    },
  });

  const loading =
    catalog.isLoading || clinicPlans.isLoading || members.isLoading;
  if (loading) {
    return (
      <Shell>
        <LoadingBlock label="Carregando os convênios…" />
      </Shell>
    );
  }
  if (catalog.isError || clinicPlans.isError || members.isError || !savedClinic) {
    return (
      <Shell>
        <ErrorBlock
          message="Não foi possível carregar os convênios."
          retry={() => {
            void catalog.refetch();
            void clinicPlans.refetch();
            void members.refetch();
          }}
        />
      </Shell>
    );
  }

  const plans = catalog.data ?? [];
  const planName = (id: string) =>
    plans.find((plan) => plan.id === id)?.name ?? "Convênio";
  const savedDoctors = new Map(
    doctorIds.flatMap((userClinicId, index) => {
      const data = doctorQueries[index]?.data;
      return data ? [[userClinicId, data] as const] : [];
    }),
  );
  const doctorDirty = (userClinicId: string) => {
    const draft = doctorDrafts[userClinicId];
    const saved = savedDoctors.get(userClinicId);
    return Boolean(
      draft && saved && isDoctorDirty(draft, doctorDraftFromSaved(saved), savedClinic),
    );
  };
  const clinicDirty = Boolean(clinicDraft && isClinicDirty(clinicDraft, savedClinic));

  function doctorStatus(doctor: Member): DoctorStatus {
    const draft = doctorDrafts[doctor.userClinicId];
    if (draft && doctorDirty(doctor.userClinicId)) {
      return {
        kind: "unsaved",
        label: `${healthcarePlanModeLabels[draft.mode]} · não salvo`,
      };
    }
    const saved = savedDoctors.get(doctor.userClinicId);
    const mode = saved?.mode ?? doctor.healthcarePlanMode ?? "ClinicDefault";
    const count =
      saved?.healthcarePlanIds.length ?? doctor.effectiveHealthcarePlanCount ?? 0;
    if (count === 0) return { kind: "privateOnly" };
    return mode === "Custom"
      ? {
          kind: "custom",
          label: `${healthcarePlanModeLabels.Custom} · ${planCountLabel(count)}`,
        }
      : { kind: "default" };
  }

  const navDoctors: DoctorNavItem[] = doctors.map((doctor) => ({
    userClinicId: doctor.userClinicId,
    displayName: doctor.displayName,
    status: doctorStatus(doctor),
  }));
  const allDoctorListsLoaded = savedDoctors.size === doctorIds.length;
  const doctorCounts = allDoctorListsLoaded
    ? countDoctorsByPlan([...savedDoctors.values()].map((item) => item.healthcarePlanIds))
    : null;

  const isClinicSelected = selectedItem === CLINIC_ITEM;
  const selectedDoctorQuery = doctorQueries[doctorIds.indexOf(selectedItem)];
  const selectedSaved = savedDoctors.get(selectedItem);
  const selectedDirty = isClinicSelected ? clinicDirty : doctorDirty(selectedItem);
  const saving = saveClinic.isPending || saveDoctor.isPending;
  const saveError = isClinicSelected
    ? saveClinic.isError ? errorMessage(saveClinic.error) : null
    : saveDoctor.isError ? errorMessage(saveDoctor.error) : null;

  function editClinic(draft: ClinicDraft) {
    setSavedItem(null);
    saveClinic.reset();
    setClinicDraft(draft);
  }

  function editDoctor(draft: DoctorDraft) {
    setSavedItem(null);
    saveDoctor.reset();
    setDoctorDrafts((current) => ({ ...current, [selectedItem]: draft }));
  }

  function discard() {
    saveClinic.reset();
    saveDoctor.reset();
    if (isClinicSelected) setClinicDraft(null);
    else setDoctorDrafts((current) => withoutKey(current, selectedItem));
  }

  function save() {
    if (isClinicSelected) saveClinic.mutate({ confirmed: false });
    else {
      saveDoctor.mutate({
        userClinicId: selectedItem,
        draft: doctorDrafts[selectedItem],
      });
    }
  }

  const copySources: CopySource[] = doctors
    .filter((doctor) => doctor.userClinicId !== selectedItem)
    .flatMap((doctor) => {
      const saved = savedDoctors.get(doctor.userClinicId);
      return saved
        ? [{
            userClinicId: doctor.userClinicId,
            displayName: doctor.displayName,
            planIds: saved.healthcarePlanIds,
          }]
        : [];
    });

  const currentClinic = normalizeClinicDraft(clinicDraft ?? savedClinic);

  return (
    <Shell>
      <div className={styles.layout}>
        <PlansNavigation
          selectedItem={selectedItem}
          clinicSummary={clinicSummaryLabel(
            savedClinic.accepted.length,
            savedClinic.defaults.length,
          )}
          clinicDirty={clinicDirty}
          doctors={navDoctors}
          onSelect={select}
        />

        <section className={styles.detail} aria-labelledby="plans-detail-title">
          {isClinicSelected ? (
            <ClinicPlansDetail
              catalog={plans}
              draft={currentClinic}
              doctorCounts={doctorCounts}
              onChange={editClinic}
            />
          ) : selectedDoctorQuery?.isError ? (
            <>
              <h2 id="plans-detail-title" className="srOnly">Convênios do médico</h2>
              <ErrorBlock
                message="Não foi possível carregar os convênios deste médico."
                retry={() => void selectedDoctorQuery.refetch()}
              />
            </>
          ) : !selectedSaved ? (
            <>
              <h2 id="plans-detail-title" className="srOnly">Convênios do médico</h2>
              <LoadingBlock label="Carregando os convênios do médico…" />
            </>
          ) : (
            <DoctorPlansDetail
              doctorName={
                doctors.find((doctor) => doctor.userClinicId === selectedItem)
                  ?.displayName ?? "Médico"
              }
              plans={plans}
              clinic={savedClinic}
              draft={doctorDrafts[selectedItem] ?? doctorDraftFromSaved(selectedSaved)}
              savedCustomPlanIds={
                selectedSaved.mode === "Custom" ? selectedSaved.healthcarePlanIds : null
              }
              copySources={copySources}
              onChange={editDoctor}
              onEditClinicDefault={() => select(CLINIC_ITEM)}
            />
          )}

          {savedItem === selectedItem && !selectedDirty ? (
            <div className={styles.savedNote}>
              <SuccessNote>Convênios atualizados.</SuccessNote>
            </div>
          ) : null}
          {selectedDirty ? (
            <UnsavedChangesBar
              saving={saving && !impact}
              error={saveError}
              onDiscard={discard}
              onSave={save}
            />
          ) : null}
        </section>
      </div>

      {impact && clinicDraft ? (
        <PlansImpactDialog
          impact={impact}
          noLongerAcceptedIds={savedClinic.accepted.filter(
            (id) => !currentClinic.accepted.includes(id),
          )}
          planName={planName}
          saving={saveClinic.isPending}
          onCancel={() => setImpact(null)}
          onKeepPlan={(planId) => {
            setImpact(null);
            setClinicDraft(restoreClinicPlan(currentClinic, savedClinic, planId));
          }}
          onConfirm={() => saveClinic.mutate({ confirmed: true })}
        />
      ) : null}
    </Shell>
  );
}

/** Convênios é uma seção da configuração da clínica, exclusiva do administrador. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Configuração da clínica"
        title="Convênios"
        description="Defina os convênios aceitos pela clínica e quais deles cada médico atende. Consulta particular está sempre disponível no agendamento."
      />
      <ClinicSettingsTabs />
      <div className={styles.content}>{children}</div>
    </>
  );
}
