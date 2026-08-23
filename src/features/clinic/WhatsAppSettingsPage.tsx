import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { WhatsAppConfig } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { Field } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { onboardingKey } from "../onboarding/onboarding";
import styles from "./SettingsLayout.module.css";

const whatsappSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID."),
  templateName: z.string().trim().min(1, "Informe o nome do template."),
  accessToken: z.string().optional(),
  enabled: z.boolean(),
});
type WhatsAppForm = z.infer<typeof whatsappSchema>;
const whatsappKey = ["clinic", "whatsapp"] as const;

export function WhatsAppSettingsPage() {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: whatsappKey,
    queryFn: async () => {
      try {
        return await request<WhatsAppConfig>("/clinics/whatsapp-config");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<WhatsAppForm>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      phoneNumberId: "",
      templateName: "appointment_confirmation",
      accessToken: "",
      enabled: false,
    },
  });

  useEffect(() => {
    if (query.data) {
      reset({
        phoneNumberId: query.data.phoneNumberId,
        templateName: query.data.templateName,
        accessToken: "",
        enabled: query.data.enabled,
      });
    }
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: WhatsAppForm) =>
      request<WhatsAppConfig>("/clinics/whatsapp-config", {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          accessToken: values.accessToken?.trim() || null,
        }),
      }),
    onMutate: () => setSaved(false),
    onSuccess: (data) => {
      queryClient.setQueryData(whatsappKey, data);
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      setSaved(true);
      reset({ ...data, accessToken: "" });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Configuração"
        title="Confirmações por WhatsApp"
        description="Conecte a conta da Meta usada pela clínica. O token nunca é exibido depois de salvo."
      />
      <div className={styles.content}>
        {query.isLoading ? (
          <LoadingBlock label="Verificando a conexão…" />
        ) : query.isError ? (
          <ErrorBlock
            message="Não foi possível verificar a configuração do WhatsApp."
            retry={() => void query.refetch()}
          />
        ) : (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Meta Cloud API</h2>
                <p>
                  Use as credenciais do aplicativo responsável pelas
                  confirmações.
                </p>
              </div>
              <LockKeyhole size={20} color="var(--color-success-text)" />
            </div>
            <form
              className={styles.form}
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              <Field
                label="Phone Number ID"
                placeholder="ID fornecido pela Meta"
                error={errors.phoneNumberId?.message}
                {...register("phoneNumberId")}
              />
              <Field
                label="Template de confirmação"
                placeholder="appointment_confirmation"
                error={errors.templateName?.message}
                {...register("templateName")}
              />
              <Field
                className={styles.wide}
                label={query.data?.hasToken ? "Substituir token" : "Access token"}
                type="password"
                autoComplete="off"
                placeholder={
                  query.data?.hasToken
                    ? "Deixe vazio para manter o token atual"
                    : "Token permanente da Meta"
                }
                hint="Armazenado de forma protegida e usado somente pelo backend."
                error={errors.accessToken?.message}
                {...register("accessToken")}
              />
              <label className={styles.toggle}>
                <input type="checkbox" {...register("enabled")} />
                <span>
                  Ativar confirmações
                  <small>
                    O envio começa quando a configuração estiver válida.
                  </small>
                </span>
              </label>
              <div className={styles.actions}>
                {saved ? <SuccessNote>Configuração atualizada.</SuccessNote> : null}
                {mutation.isError ? (
                  <span role="alert">
                    {mutation.error instanceof ApiError
                      ? mutation.error.message
                      : "Não foi possível salvar."}
                  </span>
                ) : null}
                <Button type="submit" loading={mutation.isPending}>
                  Salvar conexão
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
