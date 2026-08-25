import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  MailCheck,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ClinicMember,
  ClinicRole,
  UserClinicStatus,
} from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { roleLabels } from "../../auth/roles";
import { Button } from "../../components/Button";
import { ErrorBlock, LoadingBlock, SuccessNote } from "../../components/Feedback";
import { ClinicMemberForm } from "./ClinicMemberForm";
import type { ClinicMemberPayload } from "./memberFormModel";
import styles from "./TeamPage.module.css";

const statusLabels: Record<UserClinicStatus, string> = {
  Pending: "Pendente",
  Active: "Ativo",
  Suspended: "Suspenso",
  Inactive: "Inativo",
};

const statusReasons: Record<UserClinicStatus, string> = {
  Pending: "Alteração para pendente pela gestão de equipe",
  Active: "Reativação administrativa pela gestão de equipe",
  Suspended: "Suspensão administrativa pela gestão de equipe",
  Inactive: "Inativação administrativa pela gestão de equipe",
};

function clinicMembersKey(clinicId: string) {
  return ["clinic", clinicId, "memberships"] as const;
}

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; member: ClinicMember };

function memberName(member: ClinicMember) {
  return member.displayName?.trim() || member.email || "Integrante sem nome";
}

function initials(member: ClinicMember) {
  const words = memberName(member).split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? "?"}${words[1]?.[0] ?? ""}`.toUpperCase();
}

function safeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function TeamPage({
  initialMode,
  initialRole,
}: {
  initialMode?: "create";
  initialRole?: ClinicRole;
}) {
  const { request, session, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const clinicId = session?.clinicId ?? "";
  const [editor, setEditor] = useState<EditorState | undefined>(
    initialMode === "create" ? { mode: "create" } : undefined,
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ClinicRole | "All">("All");
  const [feedback, setFeedback] = useState<string>();

  const query = useQuery({
    queryKey: clinicMembersKey(clinicId),
    queryFn: () => request<ClinicMember[]>(`/clinics/${clinicId}/members`),
    enabled: Boolean(clinicId),
  });

  const save = useMutation({
    mutationFn: async (payload: ClinicMemberPayload) => {
      if (!editor) throw new Error("Nenhum vínculo selecionado.");
      if (editor.mode === "create") {
        await request(`/clinics/${clinicId}/members`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return { kind: "created" as const };
      }
      const member = await request<ClinicMember>(
        `/clinics/${clinicId}/members/${editor.member.userClinicId}`,
        { method: "PUT", body: JSON.stringify(payload) },
      );
      return { kind: "updated" as const, member };
    },
    onSuccess: async (result) => {
      save.reset();
      setFeedback(
        result.kind === "created"
          ? "Integrante adicionado. O vínculo permanece pendente até a confirmação de contato."
          : "Vínculo atualizado.",
      );
      if (result.kind === "created") {
        setEditor(undefined);
      } else {
        setEditor({ mode: "edit", member: result.member });
        if (result.member.userClinicId === session?.userClinicId) {
          try {
            await refreshSession();
          } catch {
            setFeedback(
              "Vínculo atualizado. Entre novamente para aplicar as permissões na sessão atual.",
            );
          }
        }
      }
      await queryClient.invalidateQueries({
        queryKey: clinicMembersKey(clinicId),
      });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({
      member,
      status,
    }: {
      member: ClinicMember;
      status: UserClinicStatus;
    }) =>
      request<ClinicMember>(
        `/clinics/${clinicId}/members/${member.userClinicId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status, reason: statusReasons[status] }),
        },
      ),
    onSuccess: async (updated) => {
      setEditor({ mode: "edit", member: updated });
      setFeedback(
        updated.status === "Active"
          ? "Vínculo reativado."
          : updated.status === "Suspended"
            ? "Vínculo suspenso e sessões invalidadas."
            : "Status do vínculo atualizado.",
      );
      await queryClient.invalidateQueries({
        queryKey: clinicMembersKey(clinicId),
      });
    },
  });

  const members = useMemo(() => query.data ?? [], [query.data]);
  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return members.filter((member) => {
      const matchesRole = roleFilter === "All" || member.role === roleFilter;
      const searchable = [memberName(member), member.email, member.phone]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesRole && (!normalized || searchable.includes(normalized));
    });
  }, [members, roleFilter, search]);

  if (query.isLoading) {
    return (
      <div className={styles.content}>
        <LoadingBlock label="Carregando a equipe…" />
      </div>
    );
  }

  if (query.isError || !clinicId) {
    return (
      <div className={styles.content}>
        <ErrorBlock
          message="Não foi possível carregar a equipe."
          retry={() => void query.refetch()}
        />
      </div>
    );
  }

  const activeCount = members.filter(
    (member) => member.status === "Active",
  ).length;
  const doctorCount = members.filter(
    (member) => member.role === "Doctor",
  ).length;
  const pendingCount = members.filter(
    (member) => member.status === "Pending",
  ).length;
  const selectedMember = editor?.mode === "edit" ? editor.member : undefined;
  const hasConfirmedContact = Boolean(
    selectedMember?.emailConfirmedAtUtc ||
      selectedMember?.phoneConfirmedAtUtc,
  );

  return (
    <main className={styles.content}>
      <header className={styles.teamHeader}>
        <div>
          <span className={styles.overline}>
            {session?.clinicName ?? "Clínica atual"}
          </span>
          <h1>Equipe</h1>
          <p>
            Um vínculo por pessoa, com papel hierárquico, administração e
            contatos próprios desta clínica.
          </p>
        </div>
        <Button
          type="button"
          className={styles.addMember}
          onClick={() => {
            setFeedback(undefined);
            setEditor({ mode: "create" });
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Novo integrante
        </Button>
      </header>

      <section className={styles.metrics} aria-label="Resumo da equipe">
        <article>
          <span className={styles.metricIcon}>
            <UsersRound aria-hidden="true" />
          </span>
          <div>
            <strong>{members.length}</strong>
            <small>vínculos</small>
          </div>
        </article>
        <article>
          <span className={styles.metricIcon}>
            <UserRoundCheck aria-hidden="true" />
          </span>
          <div>
            <strong>{activeCount}</strong>
            <small>ativos</small>
          </div>
        </article>
        <article>
          <span className={styles.metricIcon}>
            <Stethoscope aria-hidden="true" />
          </span>
          <div>
            <strong>{doctorCount}</strong>
            <small>médicos</small>
          </div>
        </article>
        <article>
          <span className={styles.metricIcon}>
            <Clock3 aria-hidden="true" />
          </span>
          <div>
            <strong>{pendingCount}</strong>
            <small>pendentes</small>
          </div>
        </article>
      </section>

      {feedback ? <SuccessNote>{feedback}</SuccessNote> : null}

      {editor ? (
        <section className={styles.editorPanel} aria-label="Editor de vínculo">
          <ClinicMemberForm
            key={
              editor.mode === "edit"
                ? editor.member.userClinicId
                : "new-member"
            }
            mode={editor.mode}
            member={selectedMember}
            initialRole={editor.mode === "create" ? initialRole : undefined}
            pending={save.isPending}
            serverError={
              save.isError
                ? safeError(
                    save.error,
                    "Não foi possível salvar o vínculo.",
                  )
                : undefined
            }
            onCancel={() => {
              save.reset();
              setEditor(undefined);
            }}
            onSubmit={(payload) => save.mutate(payload)}
          />

          {selectedMember ? (
            <section
              className={styles.lifecycle}
              aria-labelledby="membership-lifecycle-title"
            >
              <div>
                <h3 id="membership-lifecycle-title">Situação do vínculo</h3>
                <p>
                  Suspender bloqueia novas sessões neste contexto sem apagar o
                  histórico.
                </p>
              </div>
              {selectedMember.isOwner ? (
                <Button type="button" variant="danger" disabled>
                  Suspender vínculo
                </Button>
              ) : selectedMember.status === "Active" ? (
                <Button
                  type="button"
                  variant="danger"
                  loading={changeStatus.isPending}
                  onClick={() =>
                    changeStatus.mutate({
                      member: selectedMember,
                      status: "Suspended",
                    })
                  }
                >
                  Suspender vínculo
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={
                    selectedMember.status === "Pending" &&
                    !hasConfirmedContact
                  }
                  loading={changeStatus.isPending}
                  onClick={() =>
                    changeStatus.mutate({
                      member: selectedMember,
                      status: "Active",
                    })
                  }
                >
                  {selectedMember.status === "Pending"
                    ? "Ativar vínculo"
                    : "Reativar vínculo"}
                </Button>
              )}
              {selectedMember.status === "Pending" &&
              !hasConfirmedContact ? (
                <small>Confirme ao menos um contato antes de ativar.</small>
              ) : null}
              {changeStatus.isError ? (
                <p className={styles.inlineError} role="alert">
                  {safeError(
                    changeStatus.error,
                    "Não foi possível alterar o status.",
                  )}
                </p>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}

      <section
        className={styles.directory}
        aria-labelledby="team-directory-title"
      >
        <div className={styles.directoryHeader}>
          <div>
            <h2 id="team-directory-title">Pessoas da clínica</h2>
            <p>
              {filteredMembers.length} de {members.length} vínculos exibidos
            </p>
          </div>
          <div className={styles.filters}>
            <label className={styles.searchField}>
              <Search size={17} aria-hidden="true" />
              <span className="srOnly">Buscar integrante</span>
              <input
                type="search"
                value={search}
                placeholder="Buscar por nome ou contato"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className={styles.roleFilter}>
              <span className="srOnly">Filtrar por papel</span>
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as ClinicRole | "All")
                }
              >
                <option value="All">Todos os papéis</option>
                <option value="Doctor">Médicos</option>
                <option value="Nurse">Enfermagem</option>
                <option value="Secretary">Secretaria</option>
              </select>
            </label>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className={styles.emptyDirectory}>
            <UsersRound aria-hidden="true" />
            <strong>Nenhum vínculo encontrado</strong>
            <p>Ajuste a busca ou adicione uma nova pessoa à clínica.</p>
          </div>
        ) : (
          <ul className={styles.memberList}>
            {filteredMembers.map((member) => {
              const name = memberName(member);
              return (
                <li key={member.userClinicId} aria-label={name}>
                  <span className={styles.memberAvatar} aria-hidden="true">
                    {initials(member)}
                  </span>
                  <span className={styles.memberIdentity}>
                    <strong>{name}</strong>
                    <small>
                      {member.email} · {member.phone}
                    </small>
                    <span className={styles.contactState}>
                      {member.emailConfirmedAtUtc ? (
                        <span>
                          <MailCheck aria-hidden="true" /> E-mail confirmado
                        </span>
                      ) : null}
                      {member.phoneConfirmedAtUtc ? (
                        <span>
                          <PhoneCall aria-hidden="true" /> Telefone confirmado
                        </span>
                      ) : null}
                      {!member.emailConfirmedAtUtc &&
                      !member.phoneConfirmedAtUtc ? (
                        <span>
                          <Clock3 aria-hidden="true" /> Aguardando confirmação
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className={styles.membershipBadges}>
                    <span className={styles.roleBadge}>
                      {roleLabels[member.role]}
                    </span>
                    {member.isAdmin ? (
                      <span className={styles.adminBadge}>
                        <ShieldCheck aria-hidden="true" /> Administração
                      </span>
                    ) : null}
                    {member.isOwner ? (
                      <span className={styles.ownerBadge}>Proprietária</span>
                    ) : null}
                    <span
                      className={`${styles.statusBadge} ${styles[`status${member.status}`]}`}
                    >
                      {member.status === "Active" ? (
                        <CheckCircle2 aria-hidden="true" />
                      ) : null}
                      {statusLabels[member.status]}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.editMember}
                    aria-label={`Editar vínculo de ${name}`}
                    onClick={() => {
                      setFeedback(undefined);
                      save.reset();
                      changeStatus.reset();
                      setEditor({ mode: "edit", member });
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
