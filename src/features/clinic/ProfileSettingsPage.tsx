import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { CurrentUser } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { roleLabels } from "../../auth/roles";
import { Button } from "../../components/Button";
import {
  ErrorBlock,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { Field } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { onboardingKey } from "../onboarding/onboarding";
import styles from "./SettingsLayout.module.css";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  medicalLicense: z.string().trim().max(30).nullable(),
  medicalLicenseState: z.string().trim().max(30).nullable(),
  specialty: z.string().trim().max(120).nullable(),
});

type ProfileForm = z.infer<typeof profileSchema>;
const profileKey = ["user", "me"] as const;

export function ProfileSettingsPage() {
  const { request, updateSessionName } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: profileKey,
    queryFn: () => request<CurrentUser>("/users/me"),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      medicalLicense: null,
      medicalLicenseState: null,
      specialty: null,
    },
  });

  useEffect(() => {
    if (!query.data) return;
    reset({
      name: query.data.name,
      medicalLicense: query.data.medicalLicense,
      medicalLicenseState: query.data.medicalLicenseState,
      specialty: query.data.specialty,
    });
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      request<CurrentUser>("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: values.name,
          medicalLicense: values.medicalLicense || null,
          medicalLicenseState: values.medicalLicenseState || null,
          specialty: values.specialty || null,
        }),
      }),
    onMutate: () => setSaved(false),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      updateSessionName(profile.name);
      setSaved(true);
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Mantenha sua identificação profissional clara para a equipe e para os atendimentos."
      />
      <div className={styles.content}>
        {query.isLoading ? (
          <LoadingBlock label="Carregando seu perfil…" />
        ) : query.isError ? (
          <ErrorBlock
            message="Não foi possível carregar seu perfil."
            retry={() => void query.refetch()}
          />
        ) : query.data ? (
          <div className={styles.sectionStack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Conta</h2>
                  <p>
                    {roleLabels[query.data.role]}
                    {query.data.isAdmin ? " · Administração" : ""}
                  </p>
                </div>
              </div>
              <form
                className={styles.form}
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
                noValidate
              >
                <Field
                  className={styles.wide}
                  label="Nome"
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register("name")}
                />
                <Field
                  id="profile-clinic-email"
                  className={styles.wide}
                  label="E-mail nesta clínica"
                  value={query.data.email}
                  readOnly
                  hint="Este contato pertence ao seu vínculo com a clínica atual. O acesso usa seu documento."
                />
                {query.data.role === "Doctor" ? (
                  <>
                    <Field
                      label="Registro profissional"
                      {...register("medicalLicense")}
                    />
                    <Field
                      label="Região do registro"
                      {...register("medicalLicenseState")}
                    />
                    <Field
                      className={styles.wide}
                      label="Especialidade"
                      {...register("specialty")}
                    />
                  </>
                ) : null}
                <div className={styles.actions}>
                  {saved ? <SuccessNote>Perfil atualizado.</SuccessNote> : null}
                  {mutation.isError ? (
                    <span role="alert">
                      {mutation.error instanceof ApiError
                        ? mutation.error.message
                        : "Não foi possível salvar o perfil."}
                    </span>
                  ) : null}
                  <Button type="submit" loading={mutation.isPending}>
                    Salvar conta
                  </Button>
                </div>
              </form>
            </section>

            {query.data.role !== "Doctor" ? (
              <section className={styles.panel}>
                <p className={styles.wide}>
                  Este perfil não possui atuação médica. As informações de CRM e
                  agenda aparecem quando a função Médico é adicionada pela
                  administração.
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
