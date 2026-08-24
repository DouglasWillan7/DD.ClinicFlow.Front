import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { Clinic, ClinicPlan } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { Field, SelectField } from "../../components/Field";
import { InternationalPhoneField } from "../../components/InternationalPhoneField";
import { PageHeader } from "../../components/PageHeader";
import { onboardingKey } from "../onboarding/onboarding";
import styles from "./SettingsLayout.module.css";

const clinicSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da clínica."),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => isPossiblePhoneNumber(value),
      "Informe um telefone válido para o país selecionado.",
    ),
  address: z.string().trim().min(5, "Informe o endereço da clínica.").max(300),
  timeZoneId: z.string().min(1),
  defaultAppointmentDurationMinutes: z.number().min(5).max(480),
});

type ClinicForm = z.infer<typeof clinicSchema>;
const clinicKey = ["clinic", "current"] as const;

export function ClinicSettingsPage() {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: clinicKey,
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ClinicForm>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      timeZoneId: "America/Sao_Paulo",
      defaultAppointmentDurationMinutes: 30,
    },
  });

  useEffect(() => {
    if (query.data) {
      reset({
        name: query.data.name,
        phone: query.data.phone ?? "",
        address: query.data.address ?? "",
        timeZoneId: query.data.timeZoneId,
        defaultAppointmentDurationMinutes:
          query.data.defaultAppointmentDurationMinutes,
      });
    }
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: ClinicForm) =>
      request<Clinic>("/clinics/current", {
        method: "PUT",
        body: JSON.stringify(values),
      }),
    onSuccess: (clinic) => {
      queryClient.setQueryData(clinicKey, clinic);
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      setSaved(true);
    },
    onMutate: () => setSaved(false),
  });
  const planMutation = useMutation({
    mutationFn: (plan: ClinicPlan) =>
      request<Clinic>("/clinics/current/plan", {
        method: "PUT",
        body: JSON.stringify({ plan }),
      }),
    onSuccess: (clinic) => {
      queryClient.setQueryData(clinicKey, clinic);
      void queryClient.invalidateQueries({ queryKey: ["clinic", "team"] });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <>
      <PageHeader
        eyebrow="Configuração"
        title="Dados da clínica"
        description="Estas informações orientam horários, comunicação e identificação da unidade."
      />
      <div className={styles.content}>
        {query.isLoading ? (
          <LoadingBlock label="Carregando a clínica…" />
        ) : query.isError ? (
          <ErrorBlock
            message="Não foi possível carregar os dados da clínica."
            retry={() => void query.refetch()}
          />
        ) : (
          <div className={styles.sectionStack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Perfil operacional</h2>
                  <p>Use os dados que a secretaria reconhece no dia a dia.</p>
                </div>
              </div>
              <form className={styles.form} onSubmit={submit} noValidate>
                <Field
                  className={styles.wide}
                  label="Nome da clínica"
                  placeholder="Ex.: Clínica Horizonte"
                  error={errors.name?.message}
                  {...register("name")}
                />
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <InternationalPhoneField
                      ref={field.ref}
                      name={field.name}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      label="Telefone"
                      countrySelectLabel="País ou região do telefone"
                      hint="Selecione o país e digite o número com DDD."
                      error={errors.phone?.message}
                    />
                  )}
                />
                <SelectField
                  label="Fuso horário"
                  error={errors.timeZoneId?.message}
                  {...register("timeZoneId")}
                >
                  <option value="America/Sao_Paulo">
                    Brasília (São Paulo)
                  </option>
                  <option value="America/Manaus">Manaus</option>
                  <option value="America/Cuiaba">Cuiabá</option>
                  <option value="America/Recife">Recife</option>
                  <option value="America/Rio_Branco">Rio Branco</option>
                </SelectField>
                <Field
                  className={styles.wide}
                  label="Endereço"
                  placeholder="Rua, número, complemento, bairro e cidade"
                  error={errors.address?.message}
                  {...register("address")}
                />
                <Field
                  label="Duração padrão da consulta"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  hint="Em minutos. Pode ser ajustada ao agendar."
                  error={errors.defaultAppointmentDurationMinutes?.message}
                  {...register("defaultAppointmentDurationMinutes", {
                    valueAsNumber: true,
                  })}
                />
                <div className={styles.actions}>
                  {saved ? <SuccessNote>Dados atualizados.</SuccessNote> : null}
                  {mutation.isError ? (
                    <span role="alert">
                      {mutation.error instanceof ApiError
                        ? mutation.error.message
                        : "Não foi possível salvar."}
                    </span>
                  ) : null}
                  <Button type="submit" loading={mutation.isPending}>
                    Salvar dados
                  </Button>
                </div>
              </form>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Plano e capacidade</h2>
                  <p>
                    O plano limita médicos, não as responsabilidades
                    administrativas.
                  </p>
                </div>
              </div>
              <div className={styles.planOptions}>
                <button
                  type="button"
                  className={
                    query.data?.plan === "Solo" ? styles.planActive : undefined
                  }
                  aria-pressed={query.data?.plan === "Solo"}
                  disabled={planMutation.isPending}
                  onClick={() => planMutation.mutate("Solo")}
                >
                  <strong>Individual</strong>
                  <span>Um médico fundador, com administração completa.</span>
                  <small>
                    {query.data?.plan === "Solo"
                      ? "Plano atual"
                      : "Mudar para Individual"}
                  </small>
                </button>
                <button
                  type="button"
                  className={
                    query.data?.plan === "Clinic"
                      ? styles.planActive
                      : undefined
                  }
                  aria-pressed={query.data?.plan === "Clinic"}
                  disabled={planMutation.isPending}
                  onClick={() => planMutation.mutate("Clinic")}
                >
                  <strong>Clínica</strong>
                  <span>Múltiplos médicos e funções acumuláveis.</span>
                  <small>
                    {query.data?.plan === "Clinic"
                      ? "Plano atual"
                      : "Mudar para Clínica"}
                  </small>
                </button>
              </div>
              {planMutation.isError ? (
                <p className={styles.fieldError} role="alert">
                  {planMutation.error instanceof ApiError
                    ? planMutation.error.message
                    : "Não foi possível alterar o plano."}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
