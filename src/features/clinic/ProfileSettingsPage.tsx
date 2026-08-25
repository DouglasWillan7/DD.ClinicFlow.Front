import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { CurrentUser } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { formatRoles } from "../../auth/roles";
import { Button } from "../../components/Button";
import {
  ErrorBlock,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { Field } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { onboardingKey } from "../onboarding/onboarding";
import { DoctorSelfRegistration } from "../team/DoctorSelfRegistration";
import styles from "./SettingsLayout.module.css";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
});

type ProfileForm = z.infer<typeof profileSchema>;
const profileKey = ["user", "me"] as const;

export function ProfileSettingsPage() {
  const { request, session, updateSessionName } = useAuth();
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
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (!query.data) return;
    reset({ name: query.data.name });
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      request<CurrentUser>("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: values.name,
          // CRM, UF e especialidade vivem no cadastro médico, logo abaixo.
          medicalLicense: query.data?.medicalLicense ?? null,
          medicalLicenseState: query.data?.medicalLicenseState ?? null,
          specialty: query.data?.specialty ?? null,
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

  const isDoctor = can(session, "ReadClinicalRecord");

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
                  <p>{formatRoles(query.data)}</p>
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

            {isDoctor ? (
              // Mesmo formulário e mesmo endpoint do cadastro feito pela administração:
              // registro profissional e agenda semanal existem em um lugar só no produto.
              <DoctorSelfRegistration doctorId={query.data.userId} />
            ) : (
              <section className={styles.panel}>
                <p className={styles.wide}>
                  Este perfil não possui atuação médica. As informações de CRM e
                  agenda aparecem quando a função Médico é adicionada pela
                  administração.
                </p>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
