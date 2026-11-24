import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { CurrentUser } from "../../api/types";
import { useUnsavedChangesGuard } from "../../app/unsavedChanges";
import { useAuth } from "../../auth/AuthProvider";
import { roleLabels } from "../../auth/roles";
import { Button } from "../../components/Button";
import { InlineError, SuccessNote } from "../../components/Feedback";
import { Field } from "../../components/Field";
import { onboardingKey } from "../onboarding/onboarding";
import { currentUserKey } from "./profileQueries";
import { NoDoctorPracticeNote, ProfileSettingsFrame } from "./ProfileSettingsFrame";
import styles from "./SettingsLayout.module.css";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  medicalLicense: z.string().trim().max(30).nullable(),
  medicalLicenseState: z.string().trim().max(30).nullable(),
  specialty: z.string().trim().max(120).nullable(),
});

type ProfileForm = z.infer<typeof profileSchema>;

/** Aba "Conta" de Meu perfil, a entrada da tela. */
export function ProfileSettingsPage() {
  return (
    <ProfileSettingsFrame>
      {(profile) => (
        <div className={styles.sectionStack}>
          <AccountPanel profile={profile} />
          {profile.role === "Doctor" ? null : <NoDoctorPracticeNote />}
        </div>
      )}
    </ProfileSettingsFrame>
  );
}

function AccountPanel({ profile }: { profile: CurrentUser }) {
  const { request, updateSessionName } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      medicalLicense: null,
      medicalLicenseState: null,
      specialty: null,
    },
  });
  // Com abas, trocar de seção desmonta o formulário: o que foi digitado só some após confirmação.
  useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    reset({
      name: profile.name,
      medicalLicense: profile.medicalLicense,
      medicalLicenseState: profile.medicalLicenseState,
      specialty: profile.specialty,
    });
  }, [profile, reset]);

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
    onSuccess: (next) => {
      queryClient.setQueryData(currentUserKey, next);
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      updateSessionName(next.name);
      setSaved(true);
    },
  });

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Conta</h2>
          <p>
            {roleLabels[profile.role]}
            {profile.isAdmin ? " · Administração" : ""}
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
          value={profile.email}
          readOnly
          hint="Este contato pertence ao seu vínculo com a clínica atual. O acesso usa seu documento."
        />
        {profile.role === "Doctor" ? (
          <>
            <Field label="Registro profissional" {...register("medicalLicense")} />
            <Field label="Região do registro" {...register("medicalLicenseState")} />
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
            <InlineError>
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Não foi possível salvar o perfil."}
            </InlineError>
          ) : null}
          <Button type="submit" loading={mutation.isPending}>
            Salvar conta
          </Button>
        </div>
      </form>
    </section>
  );
}
