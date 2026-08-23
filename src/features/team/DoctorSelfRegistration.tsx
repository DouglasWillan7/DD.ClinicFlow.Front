import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { Doctor, HealthInsurancePlan } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { onboardingKey } from "../onboarding/onboarding";
import { DoctorForm } from "./DoctorForm";
import {
  toDoctorFormValue,
  toDoctorPayload,
  type DoctorFormValue,
} from "./doctorRegistration";
import styles from "./TeamPage.module.css";
import { doctorKey, doctorsKey, healthInsurancePlansKey } from "./teamQueries";

/**
 * "Meu perfil" para quem atende: o mesmo formulário e o mesmo `PUT /clinics/doctors/{id}` usados
 * pela administração, para o registro profissional e a agenda existirem em um lugar só.
 */
export function DoctorSelfRegistration({ doctorId }: { doctorId: string }) {
  const { request } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const doctor = useQuery({
    queryKey: doctorKey(doctorId),
    queryFn: () => request<Doctor>(`/clinics/doctors/${doctorId}`),
  });
  const plans = useQuery({
    queryKey: healthInsurancePlansKey,
    queryFn: () => request<HealthInsurancePlan[]>("/health-insurance-plans"),
    staleTime: 60 * 60 * 1000,
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
      void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
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

  if (doctor.isLoading || plans.isLoading) {
    return <LoadingBlock label="Carregando seu cadastro médico…" />;
  }

  if (doctor.isError || plans.isError || !doctor.data) {
    return (
      <ErrorBlock
        message={
          doctor.error instanceof ApiError
            ? doctor.error.message
            : "Não foi possível carregar seu cadastro médico."
        }
        retry={() => {
          void doctor.refetch();
          void plans.refetch();
        }}
      />
    );
  }

  const current = doctor.data;

  return (
    <DoctorForm
      key={current.userId}
      breadcrumb={<h2 className={styles.selfHeading}>Cadastro médico</h2>}
      initialValue={toDoctorFormValue(current)}
      plans={plans.data ?? []}
      primaryLabel="Salvar cadastro"
      scheduleLabel="Salvar e ver minha agenda"
      emailReadOnly
      onSubmit={(value, intent) =>
        save.mutate(value, {
          onSuccess: () => {
            if (intent === "agenda") {
              navigate(`/app/agenda?doctorId=${doctorId}`);
            }
          },
        })
      }
      onDiscard={() => {
        setSaved(false);
        return toDoctorFormValue(current);
      }}
      onDirty={() => setSaved(false)}
      pending={save.isPending}
      serverError={
        save.isError
          ? save.error instanceof ApiError
            ? save.error.message
            : "Não foi possível salvar seu cadastro."
          : null
      }
      banner={
        saved ? (
          <p className={styles.successBanner} role="status">
            <span className={styles.successCheck} aria-hidden="true" />
            <span>Cadastro atualizado.</span>
          </p>
        ) : null
      }
    />
  );
}
