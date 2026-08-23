import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  Clinic,
  Doctor,
  DoctorAccessInvite,
  HealthInsurancePlan,
} from "../../api/types";
import { Link, useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { hasRole } from "../../auth/roles";
import {
  ErrorBlock,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { onboardingKey } from "../onboarding/onboarding";
import { AccessInviteNote } from "./AccessInviteNote";
import { DoctorForm } from "./DoctorForm";
import { MemberRolesEditor } from "./MemberRolesEditor";
import {
  toDoctorFormValue,
  toDoctorPayload,
  type DoctorFormValue,
} from "./doctorRegistration";
import styles from "./TeamPage.module.css";
import {
  doctorKey,
  doctorsKey,
  getAccessLabel,
  getDoctorName,
  healthInsurancePlansKey,
} from "./teamQueries";

export function DoctorDetailPage({ doctorId }: { doctorId: string }) {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(session, "Admin");
  // Médico ajusta o próprio cadastro em Meu perfil; aqui a edição é da administração.
  const canEdit = isAdmin;
  const [saved, setSaved] = useState(false);
  const [invite, setInvite] = useState<DoctorAccessInvite>();
  const [roleFeedback, setRoleFeedback] = useState<{
    message?: string;
    warning?: string;
  }>({});

  const doctor = useQuery({
    queryKey: doctorKey(doctorId),
    queryFn: () => request<Doctor>(`/clinics/doctors/${doctorId}`),
  });
  const plans = useQuery({
    queryKey: healthInsurancePlansKey,
    queryFn: () => request<HealthInsurancePlan[]>("/health-insurance-plans"),
    staleTime: 60 * 60 * 1000,
  });
  // Só o Admin edita funções, e a trava do plano Individual depende da clínica.
  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
    enabled: isAdmin,
  });

  const save = useMutation({
    mutationFn: (value: DoctorFormValue) =>
      request<Doctor>(`/clinics/doctors/${doctorId}`, {
        method: "PUT",
        body: JSON.stringify(toDoctorPayload(value)),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(doctorKey(doctorId), updated);
      void queryClient.invalidateQueries({ queryKey: doctorsKey });
      void queryClient.invalidateQueries({ queryKey: ["clinic", "members"] });
      void queryClient.invalidateQueries({ queryKey: ["clinic", "team"] });
      void queryClient.invalidateQueries({
        queryKey: ["doctor-schedule", doctorId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["doctor-availability", doctorId],
      });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      setSaved(true);
    },
  });

  const sendInvite = useMutation({
    mutationFn: () =>
      request<DoctorAccessInvite>(`/clinics/doctors/${doctorId}/access-invite`, {
        method: "POST",
      }),
    onSuccess: (result) => {
      setInvite(result);
      void queryClient.invalidateQueries({ queryKey: doctorKey(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKey });
    },
  });

  if (doctor.isLoading || plans.isLoading) {
    return (
      <div className={styles.content}>
        <LoadingBlock label="Carregando o médico…" />
      </div>
    );
  }

  if (doctor.isError || plans.isError || !doctor.data) {
    return (
      <div className={styles.content}>
        <ErrorBlock
          message={
            doctor.error instanceof ApiError
              ? doctor.error.message
              : "Não foi possível carregar o médico."
          }
          retry={() => {
            void doctor.refetch();
            void plans.refetch();
          }}
        />
      </div>
    );
  }

  const current = doctor.data;

  return (
    <div className={styles.content}>
      <h1 className="srOnly">{getDoctorName(current)}</h1>
      <DoctorForm
        key={current.userId}
        breadcrumb={
          <nav className={styles.breadcrumb} aria-label="Trilha">
            <Link to="/app/equipe">Equipe médica</Link>
            <span aria-hidden="true">›</span>
            <strong aria-current="page">{getDoctorName(current)}</strong>
            <span
              className={
                current.hasAccess ? styles.accessOk : styles.accessPending
              }
            >
              {getAccessLabel(current)}
            </span>
          </nav>
        }
        initialValue={toDoctorFormValue(current)}
        plans={plans.data ?? []}
        primaryLabel="Salvar alterações"
        scheduleLabel="Salvar e ver na agenda"
        emailReadOnly
        readOnly={!canEdit}
        inviteAction={{
          label: sendInvite.isPending
            ? "Gerando convite…"
            : current.hasPendingInvitation
              ? "Reenviar convite de acesso"
              : "Enviar convite de acesso",
          disabled: !isAdmin || current.hasAccess || sendInvite.isPending,
          onClick: () => sendInvite.mutate(),
        }}
        onSubmit={(value, intent) => {
          save.mutate(value, {
            onSuccess: () => {
              if (intent === "agenda") {
                navigate(`/app/agenda?doctorId=${current.userId}`);
              }
            },
          });
        }}
        onDiscard={() => {
          setSaved(false);
          setInvite(undefined);
          return toDoctorFormValue(current);
        }}
        onDirty={() => setSaved(false)}
        pending={save.isPending}
        serverError={
          save.isError
            ? save.error instanceof ApiError
              ? save.error.message
              : "Não foi possível salvar o médico."
            : sendInvite.isError
              ? sendInvite.error instanceof ApiError
                ? sendInvite.error.message
                : "Não foi possível gerar o convite de acesso."
              : null
        }
        banner={
          <>
            {saved ? (
              <p className={styles.successBanner} role="status">
                <span className={styles.successCheck} aria-hidden="true" />
                <span>Cadastro atualizado.</span>
              </p>
            ) : null}
            {invite ? <AccessInviteNote invite={invite} /> : null}
          </>
        }
      />

      {isAdmin && clinic.data ? (
        <section className={styles.panel} aria-labelledby="doctor-roles">
          <h2 id="doctor-roles">Funções na clínica</h2>
          <p className={styles.panelHint}>
            Remover a função Médico tira este profissional da agenda e dos
            pacientes, mas mantém a conta na clínica.
          </p>
          {roleFeedback.message ? (
            <SuccessNote>{roleFeedback.message}</SuccessNote>
          ) : null}
          {roleFeedback.warning ? (
            <p className={styles.inlineError} role="alert">
              {roleFeedback.warning}
            </p>
          ) : null}
          <MemberRolesEditor
            member={{
              userId: current.userId,
              email: current.email,
              name: current.name,
              roles: current.roles,
              isCreator: current.isCreator,
            }}
            plan={clinic.data.plan}
            onSaved={setRoleFeedback}
          />
        </section>
      ) : null}

    </div>
  );
}
