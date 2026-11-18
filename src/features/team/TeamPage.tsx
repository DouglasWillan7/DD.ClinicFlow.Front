import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleOff,
  CirclePause,
  Clock3,
  Headset,
  HeartPulse,
  KeyRound,
  Mail,
  MailCheck,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ClinicMember,
  ClinicMembershipInvitationStatus,
  ClinicMembershipInvitationSummary,
  ClinicRole,
  UserClinicStatus,
} from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { roleLabels } from "../../auth/roles";
import { Button } from "../../components/Button";
import { ContextBar } from "../../components/ContextBar";
import {
  EmptyState,
  ErrorBlock,
  InlineError,
  LoadingBlock,
  SuccessNote,
} from "../../components/Feedback";
import { FilterChips } from "../../components/FilterChips";
import { StatusBadge, type StatusTone } from "../../components/StatusBadge";
import { ClinicMemberForm } from "./ClinicMemberForm";
import type { ClinicMemberPayload } from "./memberFormModel";
import { formatDateTimeInZone, useClinicTimeZone } from "../clinic/clinicTimeZone";
import styles from "./TeamPage.module.css";

const statusLabels: Record<UserClinicStatus, string> = {
  Pending: "Pendente",
  Active: "Ativo",
  Suspended: "Suspenso",
  Inactive: "Inativo",
};

// Cada estado tem ícone próprio: pendente, suspenso e inativo não se distinguem só pela cor.
const statusBadges: Record<UserClinicStatus, { tone: StatusTone; icon: LucideIcon }> = {
  Pending: { tone: "warning", icon: Clock3 },
  Active: { tone: "success", icon: CheckCircle2 },
  Suspended: { tone: "danger", icon: CirclePause },
  Inactive: { tone: "neutral", icon: CircleOff },
};

const roleIcons: Record<ClinicRole, LucideIcon> = {
  Doctor: Stethoscope,
  Nurse: HeartPulse,
  Secretary: Headset,
};

const roleFilterOptions: { value: ClinicRole | "All"; label: string }[] = [
  { value: "All", label: "Todos" },
  { value: "Doctor", label: "Médicos" },
  { value: "Nurse", label: "Enfermagem" },
  { value: "Secretary", label: "Secretaria" },
];

const statusReasons: Record<UserClinicStatus, string> = {
  Pending: "Alteração para pendente pela gestão de equipe",
  Active: "Reativação administrativa pela gestão de equipe",
  Suspended: "Suspensão administrativa pela gestão de equipe",
  Inactive: "Inativação administrativa pela gestão de equipe",
};

const invitationStatusLabels: Record<
  ClinicMembershipInvitationStatus,
  string
> = {
  Queued: "Envio aguardando",
  Sent: "Convite enviado",
  Retrying: "Nova tentativa agendada",
  Failed: "Falha na entrega",
  Expired: "Convite expirado",
  Cancelled: "Convite cancelado",
  Accepted: "Convite aceito",
};

function invitationDate(value: string, timeZone: string) {
  return (
    formatDateTimeInZone(value, timeZone, { dateStyle: "long", timeStyle: "short" }) ??
    "data indisponível"
  );
}

function invitationTiming(invitation: ClinicMembershipInvitationSummary, timeZone: string) {
  const prefix =
    invitation.status === "Expired"
      ? "Expirou em"
      : invitation.status === "Accepted" || invitation.status === "Cancelled"
        ? "Validade até"
        : "Expira em";
  return `${prefix} ${invitationDate(invitation.expiresAtUtc, timeZone)}`;
}

function safeInvitationError(error: unknown, action: "reissue" | "cancel") {
  if (error instanceof ApiError && error.status === 429) {
    const seconds = error.retryAfterSeconds ?? 30;
    return `Aguarde ${seconds} segundos antes de reenviar.`;
  }
  if (error instanceof ApiError && error.status === 403) {
    return "Você não tem permissão para administrar este convite.";
  }
  if (error instanceof ApiError && (error.status === 409 || error.status === 410)) {
    return "O estado deste convite mudou. Atualize a equipe e tente novamente.";
  }
  return action === "reissue"
    ? "Não foi possível reenviar o convite."
    : "Não foi possível cancelar o convite.";
}

function canCancelInvitation(invitation?: ClinicMembershipInvitationSummary | null) {
  return Boolean(
    invitation &&
      ["Queued", "Sent", "Retrying", "Failed"].includes(invitation.status),
  );
}

function clinicMembersKey(clinicId: string) {
  return ["clinic", clinicId, "memberships"] as const;
}

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; member: ClinicMember };

const TEAM_PATH = "/app/equipe";
// O editor mora na URL: assim "Equipe" no menu e o Voltar do navegador devolvem a listagem.
const EDITOR_PARAM = "vinculo";
const NEW_MEMBER = "novo";

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
  const timeZone = useClinicTimeZone();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editorParam = initialMode === "create" ? NEW_MEMBER : params.get(EDITOR_PARAM);
  const clinicId = session?.clinicId ?? "";
  // Remonta o formulário depois de salvar, para ele voltar a ficar "sem alterações".
  const [formRevision, setFormRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ClinicRole | "All">("All");
  const [feedback, setFeedback] = useState<string>();
  const [cancelCandidate, setCancelCandidate] = useState<string>();
  const [cooldown, setCooldown] = useState<{
    userClinicId: string;
    until: number;
  }>();
  const [cooldownClock, setCooldownClock] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setCooldownClock(now);
      if (now >= cooldown.until) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const query = useQuery({
    queryKey: clinicMembersKey(clinicId),
    queryFn: () => request<ClinicMember[]>(`/clinics/${clinicId}/members`),
    enabled: Boolean(clinicId),
  });

  const members = useMemo(() => query.data ?? [], [query.data]);
  const editor = useMemo<EditorState | undefined>(() => {
    if (!editorParam) return undefined;
    if (editorParam === NEW_MEMBER) return { mode: "create" };
    const member = members.find((item) => item.userClinicId === editorParam);
    return member ? { mode: "edit", member } : undefined;
  }, [editorParam, members]);

  // A resposta da API entra na lista em cache na hora; o editor lê o vínculo dali.
  function storeMember(updated: ClinicMember) {
    queryClient.setQueryData<ClinicMember[]>(
      clinicMembersKey(clinicId),
      (current) =>
        current?.map((item) =>
          item.userClinicId === updated.userClinicId ? updated : item,
        ),
    );
  }

  function openEditor(target: string) {
    setFeedback(undefined);
    save.reset();
    changeStatus.reset();
    navigate(`${TEAM_PATH}?${EDITOR_PARAM}=${encodeURIComponent(target)}`);
  }

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
          ? "Integrante adicionado. O convite foi enfileirado para envio por e-mail."
          : "Vínculo atualizado.",
      );
      if (result.kind === "created") {
        navigate(TEAM_PATH);
      } else {
        storeMember(result.member);
        setFormRevision((revision) => revision + 1);
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
      storeMember(updated);
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

  const reissueInvitation = useMutation({
    mutationFn: (member: ClinicMember) =>
      request<ClinicMembershipInvitationSummary>(
        `/clinics/${clinicId}/members/${member.userClinicId}/invitation/reissue`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      setFeedback("Novo convite enfileirado para envio.");
      setCooldown(undefined);
      await queryClient.invalidateQueries({
        queryKey: clinicMembersKey(clinicId),
      });
    },
    onError: (error, member) => {
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 30;
        const now = Date.now();
        setCooldownClock(now);
        setCooldown({
          userClinicId: member.userClinicId,
          until: now + seconds * 1000,
        });
      }
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: (member: ClinicMember) =>
      request(
        `/clinics/${clinicId}/members/${member.userClinicId}/invitation`,
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      setCancelCandidate(undefined);
      setFeedback("Convite cancelado.");
      await queryClient.invalidateQueries({
        queryKey: clinicMembersKey(clinicId),
      });
    },
  });

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
  const canManageInvitations = Boolean(
    session && can(session, "ManageClinicMemberships"),
  );

  // Cadastro e edição ocupam a tela sozinhos: sem listagem, resumo nem "Novo integrante".
  if (editor) {
    const editorTitle =
      editor.mode === "create" ? "Novo integrante" : memberName(editor.member);
    return (
      <div className={styles.content}>
        {/* O voltar é um link: passa pelo aviso de alterações não salvas. */}
        <ContextBar
          currentAs="h1"
          back={{ label: "Voltar para a equipe", to: TEAM_PATH }}
          crumbs={[{ label: "Equipe", to: TEAM_PATH }, { label: editorTitle }]}
        />

        {feedback ? <SuccessNote>{feedback}</SuccessNote> : null}

        <section className={styles.editorPanel} aria-label="Editor de vínculo">
          {selectedMember?.status === "Pending" ? (
            <aside className={styles.invitationEditNote}>
              <Mail aria-hidden="true" />
              <div>
                <strong>O convite acompanha o e-mail deste vínculo</strong>
                <p>
                  Se o e-mail for alterado, o convite atual será invalidado.
                  Depois de salvar, use Reenviar convite na lista para enviar um
                  novo link.
                </p>
              </div>
            </aside>
          ) : null}
          <ClinicMemberForm
            key={
              editor.mode === "edit"
                ? `${editor.member.userClinicId}:${formRevision}`
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
              setFeedback(undefined);
              navigate(TEAM_PATH);
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
                <div className={styles.lifecycleError}>
                  <InlineError>
                    {safeError(
                      changeStatus.error,
                      "Não foi possível alterar o status.",
                    )}
                  </InlineError>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <ContextBar
        currentAs="h1"
        crumbs={[
          { label: session?.clinicName ?? "Clínica atual" },
          { label: "Equipe" },
        ]}
        counter={`${filteredMembers.length} de ${members.length}`}
        action={
          <Button
            type="button"
            shape="pill"
            onClick={() => openEditor(NEW_MEMBER)}
          >
            <Plus size={16} aria-hidden="true" />
            Novo integrante
          </Button>
        }
      >
        <FilterChips<ClinicRole | "All">
          label="Filtrar por papel"
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleFilterOptions}
        />
      </ContextBar>

      {feedback ? <SuccessNote>{feedback}</SuccessNote> : null}

      <section
        className={styles.directory}
        aria-labelledby="team-directory-title"
      >
        <div className={styles.directoryHeader}>
          <div>
            <h2 id="team-directory-title">Pessoas da clínica</h2>
            {/* Os números ficam numa frase só, sem grade de cartões de métrica. */}
            <p>
              {members.length} {members.length === 1 ? "vínculo" : "vínculos"} ·{" "}
              {activeCount} {activeCount === 1 ? "ativo" : "ativos"} · {doctorCount}{" "}
              {doctorCount === 1 ? "médico" : "médicos"} · {pendingCount}{" "}
              {pendingCount === 1 ? "pendente" : "pendentes"}
            </p>
          </div>
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
        </div>

        {filteredMembers.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="Nenhum vínculo encontrado"
            description="Nenhuma pessoa corresponde à busca e ao papel escolhidos."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("All");
                }}
              >
                Limpar busca e filtro
              </Button>
            }
          />
        ) : (
          <ul className={styles.memberList}>
            {filteredMembers.map((member) => {
              const name = memberName(member);
              const eligibleForInvitationActions =
                canManageInvitations &&
                member.status === "Pending" &&
                !member.isOwner;
              const cooldownSeconds =
                cooldown?.userClinicId === member.userClinicId
                  ? Math.max(
                      0,
                      Math.ceil((cooldown.until - cooldownClock) / 1000),
                    )
                  : 0;
              const reissueError =
                reissueInvitation.isError &&
                reissueInvitation.variables?.userClinicId === member.userClinicId
                  ? reissueInvitation.error
                  : undefined;
              const cancelError =
                cancelInvitation.isError &&
                cancelInvitation.variables?.userClinicId === member.userClinicId
                  ? cancelInvitation.error
                  : undefined;
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
                    <StatusBadge tone="neutral" icon={roleIcons[member.role]}>
                      {roleLabels[member.role]}
                    </StatusBadge>
                    {member.isAdmin ? (
                      <StatusBadge tone="info" icon={ShieldCheck}>
                        Administração
                      </StatusBadge>
                    ) : null}
                    {member.isOwner ? (
                      <StatusBadge tone="neutral" icon={KeyRound}>
                        Proprietária
                      </StatusBadge>
                    ) : null}
                    <StatusBadge
                      tone={statusBadges[member.status].tone}
                      icon={statusBadges[member.status].icon}
                    >
                      {statusLabels[member.status]}
                    </StatusBadge>
                  </span>
                  <button
                    type="button"
                    className={styles.editMember}
                    aria-label={`Editar vínculo de ${name}`}
                    onClick={() => openEditor(member.userClinicId)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                  </button>
                  {member.invitation || member.status === "Pending" ? (
                    <section
                      className={styles.invitationPanel}
                      aria-label={`Convite de ${name}`}
                      data-status={member.invitation?.status ?? "Missing"}
                    >
                      <span className={styles.invitationIcon} aria-hidden="true">
                        {member.invitation?.status === "Failed" ? (
                          <TriangleAlert />
                        ) : member.invitation?.status === "Accepted" ? (
                          <CheckCircle2 />
                        ) : member.invitation?.status === "Cancelled" ? (
                          <XCircle />
                        ) : (
                          <Mail />
                        )}
                      </span>
                      <span className={styles.invitationIdentity}>
                        <strong>
                          {member.invitation
                            ? invitationStatusLabels[member.invitation.status]
                            : "Nenhum convite emitido"}
                        </strong>
                        {member.invitation ? (
                          <small className={styles.invitationMeta}>
                            <span>{member.invitation.destinationMasked}</span>
                            <span>Tentativa {member.invitation.attemptNumber}</span>
                            <span>{invitationTiming(member.invitation, timeZone)}</span>
                          </small>
                        ) : (
                          <small>Envie um novo convite para o e-mail atual.</small>
                        )}
                      </span>
                      {eligibleForInvitationActions ? (
                        <span className={styles.invitationActions}>
                          <Button
                            type="button"
                            variant="secondary"
                            className={styles.invitationAction}
                            disabled={cooldownSeconds > 0}
                            loading={
                              reissueInvitation.isPending &&
                              reissueInvitation.variables?.userClinicId ===
                                member.userClinicId
                            }
                            onClick={() => {
                              setFeedback(undefined);
                              setCancelCandidate(undefined);
                              cancelInvitation.reset();
                              reissueInvitation.reset();
                              reissueInvitation.mutate(member);
                            }}
                          >
                            <RefreshCw aria-hidden="true" />
                            {cooldownSeconds > 0
                              ? `Reenviar em ${cooldownSeconds}s`
                              : "Reenviar convite"}
                          </Button>
                          {canCancelInvitation(member.invitation) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className={styles.invitationAction}
                              onClick={() => {
                                setFeedback(undefined);
                                reissueInvitation.reset();
                                cancelInvitation.reset();
                                setCancelCandidate(member.userClinicId);
                              }}
                            >
                              Cancelar convite
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                      {reissueError || cancelError ? (
                        <p className={styles.invitationError} role="alert">
                          {safeInvitationError(
                            reissueError ?? cancelError,
                            reissueError ? "reissue" : "cancel",
                          )}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                  {cancelCandidate === member.userClinicId ? (
                    <section
                      className={styles.invitationConfirmation}
                      role="alertdialog"
                      aria-labelledby={`cancel-invitation-${member.userClinicId}`}
                    >
                      <div>
                        <strong id={`cancel-invitation-${member.userClinicId}`}>
                          Cancelar convite de {name}?
                        </strong>
                        <p>
                          O link atual deixará de funcionar. O vínculo continuará
                          pendente e poderá receber um novo convite depois.
                        </p>
                      </div>
                      <span className={styles.invitationConfirmationActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={cancelInvitation.isPending}
                          onClick={() => {
                            cancelInvitation.reset();
                            setCancelCandidate(undefined);
                          }}
                        >
                          Manter convite
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          loading={cancelInvitation.isPending}
                          onClick={() => cancelInvitation.mutate(member)}
                        >
                          Confirmar cancelamento
                        </Button>
                      </span>
                    </section>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
