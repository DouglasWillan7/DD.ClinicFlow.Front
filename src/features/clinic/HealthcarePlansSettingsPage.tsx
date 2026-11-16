import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ClinicHealthcarePlans,
  ClinicHealthcarePlansImpact,
  HealthcarePlan,
  HealthcarePlanMode,
  Member,
  UserClinicHealthcarePlans,
} from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { SelectField } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import {
  healthcarePlanModeLabels,
  planCountLabel,
  sameSelection,
} from "./healthcarePlanLabels";
import layout from "./SettingsLayout.module.css";
import styles from "./HealthcarePlansSettingsPage.module.css";

const catalogKey = ["healthcare-plans", "catalog"] as const;
const clinicPlansKey = ["healthcare-plans", "clinic"] as const;
const membersKey = ["clinic", "members"] as const;
const doctorPlansKey = (userClinicId: string) =>
  ["healthcare-plans", "doctor", userClinicId] as const;

type ClinicSelection = Pick<
  ClinicHealthcarePlans,
  "healthcarePlanIds" | "defaultHealthcarePlanIds"
>;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível salvar.";
}

/**
 * Convênios aceitos e padrão da clínica. Antes de gravar consulta o impacto: se algum médico
 * deixaria de atender um convênio, mostra quem e pede confirmação.
 */
function ClinicPlansForm({
  plans,
  initial,
  onPreview,
  onSave,
}: {
  plans: HealthcarePlan[];
  initial: ClinicSelection;
  onPreview(selection: ClinicSelection): Promise<ClinicHealthcarePlansImpact>;
  onSave(selection: ClinicSelection): Promise<unknown>;
}) {
  const [accepted, setAccepted] = useState(initial.healthcarePlanIds);
  // Web e API são implantadas separadas: uma API anterior ao padrão não manda esta lista.
  const initialDefaults = initial.defaultHealthcarePlanIds ?? [];
  const [defaults, setDefaults] = useState(initialDefaults);
  const [saved, setSaved] = useState(false);
  const [impact, setImpact] = useState<ClinicHealthcarePlansImpact | null>(null);
  // Só um convênio aceito pode ser padrão: o rascunho do padrão nunca passa dos aceitos.
  const selection: ClinicSelection = {
    healthcarePlanIds: accepted,
    defaultHealthcarePlanIds: defaults.filter((id) => accepted.includes(id)),
  };
  const dirty =
    !sameSelection(selection.healthcarePlanIds, initial.healthcarePlanIds)
    || !sameSelection(selection.defaultHealthcarePlanIds, initialDefaults);

  const save = useMutation({
    mutationFn: async ({ confirmed }: { confirmed: boolean }) => {
      if (!confirmed) {
        const preview = await onPreview(selection);
        if (preview.removals.length > 0) return preview;
      }
      await onSave(selection);
      return null;
    },
    onMutate: () => setSaved(false),
    onSuccess: (pendingImpact) => {
      setImpact(pendingImpact);
      setSaved(pendingImpact === null);
    },
  });

  function edit(change: () => void) {
    setSaved(false);
    setImpact(null);
    change();
  }

  function toggle(current: string[], id: string) {
    return current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ confirmed: false });
  }

  const planName = (id: string) =>
    plans.find((plan) => plan.id === id)?.name ?? "Convênio";

  return (
    <form className={styles.planForm} onSubmit={submit} noValidate>
      <fieldset className={styles.clinicList}>
        <legend>Convênios aceitos pela clínica</legend>
        {plans.map((plan) => {
          const isAccepted = accepted.includes(plan.id);
          return (
            <div
              className={styles.clinicRow}
              data-accepted={isAccepted || undefined}
              key={plan.id}
            >
              <label className={styles.rowAccept}>
                <input
                  type="checkbox"
                  checked={isAccepted}
                  onChange={() => edit(() => setAccepted(toggle(accepted, plan.id)))}
                />
                <span>{plan.name}</span>
              </label>
              <label className={styles.rowDefault}>
                <input
                  type="checkbox"
                  aria-label={`${plan.name} no padrão da clínica`}
                  checked={selection.defaultHealthcarePlanIds.includes(plan.id)}
                  disabled={!isAccepted}
                  onChange={() => edit(() => setDefaults(toggle(defaults, plan.id)))}
                />
                <span aria-hidden="true">Padrão</span>
              </label>
            </div>
          );
        })}
      </fieldset>

      {impact ? (
        <div className={styles.impact} role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div className={styles.impactBody}>
            <strong>Esta mudança tira convênios de médicos</strong>
            <ul>
              {impact.removals.map((removal) => (
                <li key={removal.healthcarePlanId}>
                  <span className={styles.impactPlan}>
                    {planName(removal.healthcarePlanId)}:
                  </span>{" "}
                  {removal.doctors.map((doctor) => doctor.displayName).join(", ")}
                </li>
              ))}
            </ul>
            <p>Consultas já agendadas não mudam.</p>
            <div className={styles.impactActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImpact(null)}
                disabled={save.isPending}
              >
                Voltar
              </Button>
              <Button
                type="button"
                loading={save.isPending}
                onClick={() => save.mutate({ confirmed: true })}
              >
                Salvar mesmo assim
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.formFooter}>
        {saved && !dirty ? (
          <SuccessNote>Convênios da clínica atualizados.</SuccessNote>
        ) : null}
        {save.isError ? (
          <span className={styles.formError} role="alert">
            {errorMessage(save.error)}
          </span>
        ) : null}
        {impact ? null : (
          <Button type="submit" loading={save.isPending} disabled={!dirty}>
            Salvar convênios da clínica
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Modo do médico e, em "Personalizado", a lista própria. Um plano que saiu de `plans` (a
 * clínica deixou de aceitá-lo) é ignorado no rascunho, para nunca ser reenviado.
 */
function DoctorPlansForm({
  doctorName,
  plans,
  defaultPlans,
  initial,
  onSave,
}: {
  doctorName: string | null;
  plans: HealthcarePlan[];
  defaultPlans: HealthcarePlan[];
  initial: Pick<UserClinicHealthcarePlans, "mode" | "healthcarePlanIds">;
  onSave(mode: HealthcarePlanMode, ids: string[]): Promise<unknown>;
}) {
  const [mode, setMode] = useState(initial.mode);
  // Ao personalizar, parte-se do que o médico atende hoje (a lista efetiva).
  const [draft, setDraft] = useState(initial.healthcarePlanIds);
  const [saved, setSaved] = useState(false);
  const selected = draft.filter((id) => plans.some((plan) => plan.id === id));
  const save = useMutation({
    mutationFn: () => onSave(mode, mode === "Custom" ? selected : []),
    onMutate: () => setSaved(false),
    onSuccess: () => setSaved(true),
  });
  const dirty =
    mode !== initial.mode
    || (mode === "Custom" && !sameSelection(selected, initial.healthcarePlanIds));

  function toggle(id: string) {
    setSaved(false);
    setDraft((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  const modes: Array<{ value: HealthcarePlanMode; hint: string }> = [
    {
      value: "ClinicDefault",
      hint: "Atende os convênios padrão da clínica e acompanha as mudanças.",
    },
    {
      value: "Custom",
      hint: "Tem uma lista própria, escolhida entre os convênios da clínica.",
    },
  ];

  return (
    <form className={styles.planForm} onSubmit={submit} noValidate>
      <fieldset className={styles.modeGroup}>
        <legend>
          {doctorName ? `Convênios de ${doctorName}` : "Como você atende convênios"}
        </legend>
        {modes.map((option) => (
          <label className={styles.modeOption} key={option.value}>
            <input
              type="radio"
              name="healthcare-plan-mode"
              checked={mode === option.value}
              onChange={() => {
                setSaved(false);
                setMode(option.value);
              }}
            />
            <span>
              <strong>{healthcarePlanModeLabels[option.value]}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "Custom" ? (
        <fieldset className={styles.planGrid}>
          <legend>
            {doctorName
              ? `Convênios atendidos por ${doctorName}`
              : "Convênios que você atende"}
          </legend>
          {plans.map((plan) => (
            <label className={styles.planOption} key={plan.id}>
              <input
                type="checkbox"
                checked={selected.includes(plan.id)}
                onChange={() => toggle(plan.id)}
              />
              <span>{plan.name}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className={styles.inherited}>
          <h3>Convênios padrão da clínica</h3>
          {defaultPlans.length === 0 ? (
            <p className={styles.hint}>
              A clínica ainda não tem convênios padrão; por enquanto só consulta
              particular.
            </p>
          ) : (
            <ul className={styles.inheritedList}>
              {defaultPlans.map((plan) => (
                <li key={plan.id}>{plan.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.formFooter}>
        {saved && !dirty ? (
          <SuccessNote>Convênios do médico atualizados.</SuccessNote>
        ) : null}
        {save.isError ? (
          <span className={styles.formError} role="alert">
            {errorMessage(save.error)}
          </span>
        ) : null}
        <Button type="submit" loading={save.isPending} disabled={!dirty}>
          Salvar convênios do médico
        </Button>
      </div>
    </form>
  );
}

function doctorOptionLabel(doctor: Member) {
  if (!doctor.healthcarePlanMode) return doctor.displayName;
  const count = planCountLabel(doctor.effectiveHealthcarePlanCount ?? 0);
  return `${doctor.displayName} · ${healthcarePlanModeLabels[doctor.healthcarePlanMode]} (${count})`;
}

export function HealthcarePlansSettingsPage() {
  const { request, session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const canManageClinic = can(session, "ManageHealthcarePlans");
  const isDoctor = session?.clinicRole === "Doctor";

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
    enabled: Boolean(canManageClinic && session?.clinicId),
    queryFn: () =>
      request<Member[]>(`/clinics/${session!.clinicId}/members/summary`),
  });

  const doctors = useMemo(
    () => (members.data ?? []).filter((member) => member.role === "Doctor"),
    [members.data],
  );
  // O administrador escolhe o médico; quem não é administrador só configura o próprio vínculo.
  const doctorUserClinicId = canManageClinic
    ? doctors.some((doctor) => doctor.userClinicId === selectedDoctorId)
      ? selectedDoctorId
      : (doctors.find((doctor) => doctor.userClinicId === session?.userClinicId)
          ?? doctors[0])?.userClinicId ?? ""
    : isDoctor
      ? session?.userClinicId ?? ""
      : "";

  const doctorPlans = useQuery({
    queryKey: doctorPlansKey(doctorUserClinicId),
    enabled: Boolean(session?.clinicId && doctorUserClinicId),
    queryFn: () =>
      request<UserClinicHealthcarePlans>(
        `/clinics/${session!.clinicId}/members/${doctorUserClinicId}/healthcare-plans`,
      ),
  });

  const clinicIds = clinicPlans.data?.healthcarePlanIds;
  const clinicDefaultIds = clinicPlans.data?.defaultHealthcarePlanIds;
  const acceptedByClinic = useMemo(() => {
    const ids = new Set(clinicIds ?? []);
    return (catalog.data ?? []).filter((plan) => ids.has(plan.id));
  }, [catalog.data, clinicIds]);
  const defaultPlans = useMemo(() => {
    const ids = new Set(clinicDefaultIds ?? []);
    return acceptedByClinic.filter((plan) => ids.has(plan.id));
  }, [acceptedByClinic, clinicDefaultIds]);

  async function saveClinicPlans(selection: ClinicSelection) {
    const saved = await request<ClinicHealthcarePlans>(
      "/clinics/current/healthcare-plans",
      { method: "PUT", body: JSON.stringify(selection) },
    );
    queryClient.setQueryData(clinicPlansKey, saved);
    // Aceitos e padrão mudam o que cada médico atende.
    void queryClient.invalidateQueries({ queryKey: ["healthcare-plans", "doctor"] });
    void queryClient.invalidateQueries({ queryKey: membersKey });
    void queryClient.invalidateQueries({ queryKey: ["new-appointment"] });
  }

  function previewClinicPlans(selection: ClinicSelection) {
    return request<ClinicHealthcarePlansImpact>(
      "/clinics/current/healthcare-plans/impact",
      { method: "POST", body: JSON.stringify(selection) },
    );
  }

  async function saveDoctorPlans(mode: HealthcarePlanMode, healthcarePlanIds: string[]) {
    const saved = await request<UserClinicHealthcarePlans>(
      `/clinics/${session!.clinicId}/members/${doctorUserClinicId}/healthcare-plans`,
      { method: "PUT", body: JSON.stringify({ mode, healthcarePlanIds }) },
    );
    queryClient.setQueryData(doctorPlansKey(doctorUserClinicId), saved);
    void queryClient.invalidateQueries({ queryKey: membersKey });
    void queryClient.invalidateQueries({ queryKey: ["new-appointment"] });
  }

  const loading =
    catalog.isLoading || clinicPlans.isLoading || (canManageClinic && members.isLoading);
  const loadingError = catalog.isError || clinicPlans.isError || members.isError;
  const selectedDoctor = doctors.find(
    (doctor) => doctor.userClinicId === doctorUserClinicId,
  );

  return (
    <>
      <PageHeader
        eyebrow="Configuração"
        title="Convênios"
        description="Defina os convênios aceitos pela clínica, quais formam o padrão e o que cada médico atende. Consulta particular está sempre disponível no agendamento."
      />
      <div className={layout.content}>
        {loading ? (
          <LoadingBlock label="Carregando os convênios…" />
        ) : loadingError || !clinicPlans.data ? (
          <ErrorBlock
            message="Não foi possível carregar os convênios."
            retry={() => {
              void catalog.refetch();
              void clinicPlans.refetch();
              if (canManageClinic) void members.refetch();
            }}
          />
        ) : (
          <div className={layout.sectionStack}>
            {canManageClinic ? (
              <section className={layout.panel} aria-labelledby="clinic-plans-title">
                <div className={layout.panelHeader}>
                  <div>
                    <h2 id="clinic-plans-title">Convênios da clínica</h2>
                    <p>
                      Marque os convênios que a clínica aceita e, entre eles, os
                      que formam o padrão: médicos em “Padrão da clínica” atendem
                      exatamente esses. Desmarcar um convênio também o retira do
                      padrão e das listas personalizadas.
                    </p>
                  </div>
                </div>
                <ClinicPlansForm
                  plans={catalog.data ?? []}
                  initial={clinicPlans.data}
                  onPreview={previewClinicPlans}
                  onSave={saveClinicPlans}
                />
              </section>
            ) : null}

            <section className={layout.panel} aria-labelledby="doctor-plans-title">
              <div className={layout.panelHeader}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="doctor-plans-title">
                      {canManageClinic ? "Convênios por médico" : "Meus convênios"}
                    </h2>
                    <p>
                      {canManageClinic
                        ? "Cada médico segue o padrão da clínica ou tem uma lista personalizada."
                        : "Siga o padrão da clínica ou escolha uma lista personalizada."}
                    </p>
                  </div>
                  {canManageClinic && doctors.length > 1 ? (
                    <div className={styles.doctorSelect}>
                      <SelectField
                        id="healthcare-plans-doctor"
                        label="Médico"
                        value={doctorUserClinicId}
                        onChange={(event) => setSelectedDoctorId(event.target.value)}
                      >
                        {doctors.map((doctor) => (
                          <option key={doctor.userClinicId} value={doctor.userClinicId}>
                            {doctorOptionLabel(doctor)}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  ) : null}
                </div>
              </div>

              {!doctorUserClinicId ? (
                <p className={styles.hint}>
                  Nenhum médico ativo nesta clínica ainda.
                </p>
              ) : acceptedByClinic.length === 0 ? (
                <p className={styles.hint}>
                  {canManageClinic
                    ? "Marque acima os convênios que a clínica aceita para atribuí-los aos médicos."
                    : "A clínica ainda não aceita convênios. Peça ao administrador para configurá-los."}
                </p>
              ) : doctorPlans.isLoading ? (
                <LoadingBlock label="Carregando os convênios do médico…" />
              ) : doctorPlans.isError || !doctorPlans.data ? (
                <ErrorBlock
                  message="Não foi possível carregar os convênios deste médico."
                  retry={() => void doctorPlans.refetch()}
                />
              ) : (
                <DoctorPlansForm
                  key={doctorUserClinicId}
                  doctorName={selectedDoctor?.displayName ?? null}
                  plans={acceptedByClinic}
                  defaultPlans={defaultPlans}
                  initial={doctorPlans.data}
                  onSave={saveDoctorPlans}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
