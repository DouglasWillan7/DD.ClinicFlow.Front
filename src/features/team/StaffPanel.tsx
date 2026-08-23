import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import type { Clinic, Invitation, Member, UserRole } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { formatRoles, getRoles } from "../../auth/roles";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { onboardingKey } from "../onboarding/onboarding";
import { MemberRolesEditor } from "./MemberRolesEditor";
import styles from "./TeamPage.module.css";
import { doctorsKey } from "./teamQueries";

const teamKey = ["clinic", "team"] as const;

/**
 * Administração e secretaria: quem não atende continua entrando por convite de e-mail.
 * Médico tem cadastro próprio em /app/equipe/novo, com CRM e agenda.
 */
const inviteSchema = z
  .object({
    email: z.email("Informe um e-mail válido."),
    admin: z.boolean(),
    secretary: z.boolean(),
  })
  .superRefine((value, context) => {
    if (!value.admin && !value.secretary) {
      context.addIssue({
        code: "custom",
        path: ["secretary"],
        message: "Selecione ao menos uma função.",
      });
    }
  });

type InviteForm = z.infer<typeof inviteSchema>;

export function StaffPanel({
  clinic,
  members,
  invitations,
  canManage,
  onRolesSaved,
}: {
  clinic: Clinic;
  members: Member[];
  invitations: Invitation[];
  canManage: boolean;
  onRolesSaved: (feedback: { message?: string; warning?: string }) => void;
}) {
  const { request } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { admin: false, secretary: true },
  });

  function invalidateTeam() {
    void queryClient.invalidateQueries({ queryKey: teamKey });
    void queryClient.invalidateQueries({ queryKey: doctorsKey });
    void queryClient.invalidateQueries({ queryKey: ["clinic", "members"] });
    void queryClient.invalidateQueries({ queryKey: onboardingKey });
  }

  const invite = useMutation({
    mutationFn: (values: InviteForm) => {
      const roles: UserRole[] = [];
      if (values.admin) roles.push("Admin");
      if (values.secretary) roles.push("Secretary");
      return request<void>("/clinics/members", {
        method: "POST",
        body: JSON.stringify({ email: values.email, roles }),
      });
    },
    onSuccess: () => {
      reset({ email: "", admin: false, secretary: true });
      invalidateTeam();
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: (id: string) =>
      request<void>(`/clinics/invitations/${id}`, { method: "DELETE" }),
    onSuccess: invalidateTeam,
  });

  return (
    <>
      <section className={styles.panel} aria-labelledby="team-staff">
        <h2 id="team-staff">Administração e secretaria</h2>
        <p className={styles.panelHint}>
          Quem não atende pacientes entra por convite de e-mail e escolhe a
          própria senha ao se cadastrar.
        </p>

        {members.length === 0 ? (
          <p className={styles.empty}>
            Nenhum membro administrativo além dos médicos.
          </p>
        ) : (
          <ul className={styles.staffList}>
            {members.map((member) => (
              <li key={member.userId}>
                <div className={styles.staffRow}>
                  <span className={styles.avatar} aria-hidden="true">
                    {(member.name ?? member.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.doctorIdentity}>
                    <strong>{member.name ?? member.email}</strong>
                    <small>{member.email}</small>
                  </span>
                  <span className={styles.role}>
                    {formatRoles(member)}
                    {member.isCreator ? " · Fundador" : ""}
                  </span>
                </div>
                {canManage ? (
                  <MemberRolesEditor
                    member={{
                      userId: member.userId,
                      email: member.email,
                      name: member.name,
                      roles: getRoles(member),
                      isCreator: member.isCreator,
                    }}
                    plan={clinic.plan}
                    onSaved={onRolesSaved}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className={styles.panel} aria-labelledby="team-invite">
          <h2 id="team-invite">Convidar para a administração</h2>
          <form
            className={styles.inviteForm}
            onSubmit={handleSubmit((values) => invite.mutate(values))}
            noValidate
          >
            <Field
              className={styles.wide}
              label="E-mail"
              type="email"
              placeholder="pessoa@clinica.com.br"
              error={errors.email?.message}
              {...register("email")}
            />
            <fieldset className={styles.roleChoices}>
              <legend>Funções</legend>
              <label>
                <input type="checkbox" {...register("secretary")} />
                <span>
                  <strong>Secretaria</strong>
                  <small>Opera agenda e pacientes de toda a clínica.</small>
                </span>
              </label>
              <label>
                <input type="checkbox" {...register("admin")} />
                <span>
                  <strong>Administração</strong>
                  <small>Gerencia equipe, clínica e integrações.</small>
                </span>
              </label>
              {errors.secretary?.message ? (
                <small className={styles.inlineError} role="alert">
                  {errors.secretary.message}
                </small>
              ) : null}
            </fieldset>
            <div className={styles.editorActions}>
              {invite.isError ? (
                <span className={styles.inlineError} role="alert">
                  {invite.error instanceof ApiError
                    ? invite.error.message
                    : "Não foi possível criar o convite."}
                </span>
              ) : null}
              <Button type="submit" loading={invite.isPending}>
                <Send size={16} aria-hidden="true" />
                Criar convite
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {invitations.length > 0 ? (
        <section className={styles.panel} aria-labelledby="team-invitations">
          <h2 id="team-invitations">Convites pendentes</h2>
          {cancelInvitation.isError ? (
            <p className={styles.inlineError} role="alert">
              {cancelInvitation.error instanceof ApiError
                ? cancelInvitation.error.message
                : "Não foi possível cancelar o convite."}
            </p>
          ) : null}
          <ul className={styles.staffList}>
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <div className={styles.staffRow}>
                  <span className={styles.avatar} aria-hidden="true">
                    {invitation.email.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.doctorIdentity}>
                    <strong>{invitation.email}</strong>
                    <small>{formatRoles(invitation)}</small>
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      className={styles.inlineAction}
                      aria-label={`Cancelar convite de ${invitation.email}`}
                      disabled={cancelInvitation.isPending}
                      onClick={() => cancelInvitation.mutate(invitation.id)}
                    >
                      <X size={15} aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : (
                    <span className={styles.role}>Pendente</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
