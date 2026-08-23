import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { ClinicPlan, UserRole } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { onboardingKey } from "../onboarding/onboarding";
import styles from "./TeamPage.module.css";
import { doctorsKey } from "./teamQueries";

const teamKey = ["clinic", "team"] as const;

export interface RoleTarget {
  userId: string;
  email: string;
  name: string | null;
  roles: UserRole[];
  isCreator: boolean;
}

const roleLabels = [
  ["Admin", "Administração"],
  ["Doctor", "Médico"],
  ["Secretary", "Secretaria"],
] as const;

function haveSameRoles(left: UserRole[], right: UserRole[]) {
  return left.length === right.length && left.every((role) => right.includes(role));
}

/**
 * Edição de funções compartilhada pela lista de administração e pelo detalhe do médico —
 * são o mesmo PUT e as mesmas travas (fundador é Admin permanente, Médico ⊕ Secretaria).
 */
export function MemberRolesEditor({
  member,
  plan,
  onSaved,
}: {
  member: RoleTarget;
  plan: ClinicPlan;
  /** O resultado é renderizado pelo pai: mudar de função pode tirar o membro desta lista. */
  onSaved: (feedback: { message?: string; warning?: string }) => void;
}) {
  const { request, refreshSession, session } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<UserRole[]>(member.roles);
  const displayName = member.name ?? member.email;

  const save = useMutation({
    mutationFn: (next: UserRole[]) =>
      request<void>(`/clinics/members/${member.userId}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roles: next }),
      }),
    onSuccess: async () => {
      let warning: string | undefined;
      if (member.userId === session?.userId) {
        try {
          await refreshSession();
        } catch {
          warning =
            "As funções foram atualizadas, mas a sessão não foi renovada. Saia e entre novamente para aplicar as novas permissões.";
        }
      }
      setOpen(false);
      onSaved({
        message: warning ? undefined : `Funções de ${displayName} atualizadas.`,
        warning,
      });
      void queryClient.invalidateQueries({ queryKey: teamKey });
      void queryClient.invalidateQueries({ queryKey: doctorsKey });
      void queryClient.invalidateQueries({ queryKey: ["clinic", "members"] });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
    },
  });

  function startEditing() {
    const next = [...member.roles];
    if (member.isCreator && !next.includes("Admin")) next.unshift("Admin");
    if (plan === "Solo" && member.isCreator && !next.includes("Doctor")) {
      next.push("Doctor");
    }
    save.reset();
    onSaved({});
    setRoles(next);
    setOpen(true);
  }

  function toggleRole(role: UserRole, checked: boolean) {
    setRoles((current) => {
      let next = checked
        ? [...current, role]
        : current.filter((item) => item !== role);
      if (checked && role === "Doctor") {
        next = next.filter((item) => item !== "Secretary");
      }
      if (checked && role === "Secretary") {
        next = next.filter((item) => item !== "Doctor");
      }
      return [...new Set(next)];
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.inlineAction}
        aria-expanded={open}
        aria-controls={`member-roles-${member.userId}`}
        aria-label={`Editar funções de ${displayName}`}
        disabled={save.isPending}
        onClick={() => (open ? setOpen(false) : startEditing())}
      >
        <Pencil size={15} aria-hidden="true" />
        Editar funções
      </button>

      {open ? (
        <form
          id={`member-roles-${member.userId}`}
          className={styles.roleEditor}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(roles);
          }}
        >
          <fieldset className={styles.roleChoices}>
            <legend className="srOnly">Funções de {displayName}</legend>
            {roleLabels.map(([role, label]) => {
              const soloDoctorUnavailable =
                plan === "Solo" &&
                !member.isCreator &&
                !member.roles.includes("Doctor") &&
                role === "Doctor";
              const locked =
                (member.isCreator && role === "Admin") ||
                (plan === "Solo" && member.isCreator && role === "Doctor") ||
                soloDoctorUnavailable;
              return (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    disabled={locked || save.isPending}
                    onChange={(event) => toggleRole(role, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </fieldset>
          <p className={styles.panelHint}>
            {member.isCreator
              ? plan === "Solo"
                ? "No plano Individual, Administração e Médico são obrigatórios para o fundador."
                : "Como fundador, Administração permanece ativa. A atuação médica pode ser alterada."
              : "Médico e Secretaria não podem ser combinados."}
          </p>
          {roles.length === 0 ? (
            <p className={styles.inlineError} role="alert">
              Selecione ao menos uma função.
            </p>
          ) : null}
          {save.isError ? (
            <p className={styles.inlineError} role="alert">
              {save.error instanceof ApiError
                ? save.error.message
                : "Não foi possível atualizar as funções."}
            </p>
          ) : null}
          <div className={styles.editorActions}>
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={
                roles.length === 0 || haveSameRoles(roles, member.roles)
              }
            >
              Salvar funções
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
