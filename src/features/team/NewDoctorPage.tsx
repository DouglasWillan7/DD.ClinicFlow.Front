import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  Doctor,
  DoctorAccessInvite,
  HealthInsurancePlan,
} from "../../api/types";
import { Link, useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { onboardingKey } from "../onboarding/onboarding";
import { AccessInviteNote } from "./AccessInviteNote";
import { DoctorForm, type DoctorSubmitIntent } from "./DoctorForm";
import {
  discardedDoctorForm,
  emptyDoctorForm,
  toDoctorFormValue,
  toDoctorPayload,
  type DoctorFormValue,
} from "./doctorRegistration";
import styles from "./TeamPage.module.css";
import {
  doctorKey,
  doctorsKey,
  healthInsurancePlansKey,
} from "./teamQueries";

export function NewDoctorPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Depois de salvar, a mesma tela continua editando o médico criado.
  const [saved, setSaved] = useState<Doctor>();
  const [showBanner, setShowBanner] = useState(false);
  const [invite, setInvite] = useState<DoctorAccessInvite>();

  const plans = useQuery({
    queryKey: healthInsurancePlansKey,
    queryFn: () => request<HealthInsurancePlan[]>("/health-insurance-plans"),
    staleTime: 60 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: ({ value }: { value: DoctorFormValue; intent: DoctorSubmitIntent }) => {
      const payload = toDoctorPayload(value);
      return saved
        ? request<Doctor>(`/clinics/doctors/${saved.userId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : request<Doctor>("/clinics/doctors", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: (doctor, { intent }) => {
      setSaved(doctor);
      queryClient.setQueryData(doctorKey(doctor.userId), doctor);
      void queryClient.invalidateQueries({ queryKey: doctorsKey });
      void queryClient.invalidateQueries({ queryKey: ["clinic", "members"] });
      void queryClient.invalidateQueries({ queryKey: ["clinic", "team"] });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      if (intent === "agenda") {
        navigate(`/app/agenda?doctorId=${doctor.userId}`);
        return;
      }
      setShowBanner(true);
    },
  });

  const sendInvite = useMutation({
    mutationFn: (doctor: Doctor) =>
      request<DoctorAccessInvite>(
        `/clinics/doctors/${doctor.userId}/access-invite`,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      setInvite(result);
      void queryClient.invalidateQueries({ queryKey: doctorsKey });
    },
  });

  if (plans.isLoading) {
    return (
      <div className={styles.content}>
        <LoadingBlock label="Carregando o cadastro…" />
      </div>
    );
  }

  if (plans.isError) {
    return (
      <div className={styles.content}>
        <ErrorBlock
          message="Não foi possível carregar os convênios."
          retry={() => void plans.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <h1 className="srOnly">Novo médico</h1>
      <DoctorForm
        // Remonta o formulário com os dados salvos para o modo de edição começar coerente.
        key={saved?.userId ?? "novo"}
        breadcrumb={
          <nav className={styles.breadcrumb} aria-label="Trilha">
            <Link to="/app/equipe">Equipe médica</Link>
            <span aria-hidden="true">›</span>
            <strong aria-current="page">
              {saved ? "Editar médico" : "Novo médico"}
            </strong>
          </nav>
        }
        initialValue={saved ? toDoctorFormValue(saved) : emptyDoctorForm}
        plans={plans.data ?? []}
        primaryLabel={saved ? "Salvar alterações" : "Salvar médico"}
        scheduleLabel="Salvar e ver na agenda"
        emailReadOnly={Boolean(saved)}
        inviteAction={{
          label: sendInvite.isPending
            ? "Gerando convite…"
            : "Enviar convite de acesso",
          disabled: !saved || saved.hasAccess || sendInvite.isPending,
          onClick: () => saved && sendInvite.mutate(saved),
        }}
        onSubmit={(value, intent) => save.mutate({ value, intent })}
        onDiscard={() => {
          setShowBanner(false);
          setInvite(undefined);
          return discardedDoctorForm;
        }}
        onDirty={() => setShowBanner(false)}
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
            {showBanner && saved ? (
              <p className={styles.successBanner} role="status">
                <span className={styles.successCheck} aria-hidden="true" />
                <span>
                  Médico salvo.{" "}
                  <Link to={`/app/equipe/${saved.userId}`}>Abrir perfil</Link> ou{" "}
                  <Link to={`/app/agenda?doctorId=${saved.userId}`}>
                    ver na agenda
                  </Link>
                  .
                </span>
              </p>
            ) : null}
            {invite ? <AccessInviteNote invite={invite} /> : null}
          </>
        }
      />
    </div>
  );
}
