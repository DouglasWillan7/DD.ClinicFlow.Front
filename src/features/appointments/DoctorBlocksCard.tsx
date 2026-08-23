import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { DoctorSchedule, DoctorScheduleBlock } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import styles from "./DoctorBlocksCard.module.css";

function formatBlockDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Ausências do médico — folga, congresso, férias. Vive na agenda porque é exceção do dia a dia,
 * não configuração de cadastro: bloqueia exatamente o dia que está aberto no calendário.
 */
export function DoctorBlocksCard({
  doctorId,
  doctorName,
  selectedDate,
  canEdit,
}: {
  doctorId: string;
  doctorName: string;
  /** Data em foco no calendário, em yyyy-MM-dd. */
  selectedDate: string;
  canEdit: boolean;
}) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const scheduleKey = ["doctor-schedule", doctorId] as const;

  const schedule = useQuery({
    queryKey: scheduleKey,
    queryFn: () => request<DoctorSchedule>(`/doctors/${doctorId}/schedule`),
  });

  async function refreshAgenda() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: scheduleKey }),
      queryClient.invalidateQueries({
        queryKey: ["doctor-availability", doctorId],
      }),
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    ]);
  }

  const addBlock = useMutation({
    mutationFn: () =>
      request<DoctorScheduleBlock>(`/doctors/${doctorId}/schedule/blocks`, {
        method: "POST",
        body: JSON.stringify({
          date: selectedDate,
          reason: reason.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setReason("");
      await refreshAgenda();
    },
  });

  const removeBlock = useMutation({
    mutationFn: (block: DoctorScheduleBlock) =>
      request<void>(`/doctors/${doctorId}/schedule/blocks/${block.id}`, {
        method: "DELETE",
      }),
    onSuccess: refreshAgenda,
  });

  const blocks = schedule.data?.blocks ?? [];
  const blockedToday = blocks.find((block) => block.date === selectedDate);

  return (
    <section className={styles.card} aria-labelledby="agenda-blocks-title">
      <h2 id="agenda-blocks-title" className={styles.title}>
        Ausências
      </h2>

      {canEdit ? (
        blockedToday ? (
          <p className={styles.blockedNotice}>
            <CalendarOff size={16} aria-hidden="true" />
            <span>
              {formatBlockDate(selectedDate)} está bloqueado
              {blockedToday.reason ? ` · ${blockedToday.reason}` : ""}.
            </span>
          </p>
        ) : (
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              addBlock.mutate();
            }}
          >
            <label className={styles.reason}>
              <span>Bloquear {formatBlockDate(selectedDate)}</span>
              <input
                type="text"
                value={reason}
                maxLength={240}
                placeholder="Motivo (opcional)"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className={styles.blockAction}
              disabled={addBlock.isPending}
            >
              <CalendarOff size={16} aria-hidden="true" />
              {addBlock.isPending ? "Bloqueando…" : "Bloquear dia"}
            </button>
          </form>
        )
      ) : null}

      {addBlock.isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(addBlock.error, "Não foi possível bloquear a data.")}
        </p>
      ) : null}
      {removeBlock.isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(removeBlock.error, "Não foi possível remover o bloqueio.")}
        </p>
      ) : null}

      {blocks.length > 0 ? (
        <ul className={styles.list}>
          {blocks.map((block) => {
            const formatted = formatBlockDate(block.date);
            return (
              <li key={block.id}>
                <span className={styles.blockInfo}>
                  <time dateTime={block.date}>{formatted}</time>
                  <small>{block.reason ?? "Sem motivo informado"}</small>
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    className={styles.removeAction}
                    aria-label={`Remover bloqueio de ${formatted} de ${doctorName}`}
                    disabled={removeBlock.isPending}
                    onClick={() => removeBlock.mutate(block)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>Nenhuma data futura bloqueada.</p>
      )}
    </section>
  );
}
