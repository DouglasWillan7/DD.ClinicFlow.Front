import { useQuery } from "@tanstack/react-query";
import { UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Clinic, Member } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { doctorScheduleScope } from "../../auth/permissions";
import { ButtonLink } from "../../components/ButtonLink";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { SelectField } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { fallbackTimeZone, timeZoneLabel } from "./clinicTimeZone";
import { DoctorSchedulePanel } from "./DoctorSchedulePanel";
import styles from "./ScheduleSettingsPage.module.css";

const clinicKey = ["clinic", "current"] as const;

export function ScheduleSettingsPage() {
  const { request, session } = useAuth();
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const scheduleScope = doctorScheduleScope(session);
  const isAdmin = scheduleScope === "clinic";

  const clinic = useQuery({
    queryKey: clinicKey,
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  const members = useQuery({
    queryKey: ["clinic", "members"],
    enabled: Boolean(isAdmin && session?.clinicId),
    queryFn: () =>
      request<Member[]>(`/clinics/${session!.clinicId}/members/summary`),
  });
  const doctors = useMemo(
    () => (members.data ?? []).filter((member) => member.role === "Doctor"),
    [members.data],
  );
  const preferredDoctor = doctors.find(
    (doctor) => doctor.userId === session?.userId,
  ) ?? doctors[0];
  const doctorId = isAdmin
    ? doctors.some((doctor) => doctor.userId === selectedDoctorId)
      ? selectedDoctorId
      : preferredDoctor?.userId ?? ""
    : scheduleScope === "own"
      ? session?.userId ?? ""
      : "";

  const selectedDoctor = isAdmin
    ? doctors.find((doctor) => doctor.userId === doctorId)
    : scheduleScope === "own"
      ? { displayName: session?.name ?? "Seu perfil médico" }
      : undefined;
  const noDoctors = isAdmin && !members.isLoading && doctors.length === 0;
  const loading = clinic.isLoading || (isAdmin && members.isLoading);
  const loadingError = clinic.isError || members.isError;

  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Disponibilidade de atendimento"
        description="Defina a semana padrão do médico nesta clínica. Ausências e férias continuam sendo bloqueadas diretamente na Agenda."
      />
      <div className={styles.content}>
        {loading ? (
          <LoadingBlock label="Carregando os horários de atendimento…" />
        ) : loadingError ? (
          <ErrorBlock
            message="Não foi possível carregar a configuração da agenda."
            retry={() => {
              void clinic.refetch();
              if (isAdmin) void members.refetch();
            }}
          />
        ) : noDoctors ? (
          <section className={styles.emptyState}>
            <UserRoundPlus size={24} aria-hidden="true" />
            <div>
              <h2>Adicione um médico antes de configurar horários</h2>
              <p>A disponibilidade sempre pertence ao vínculo do médico com esta clínica.</p>
            </div>
            <ButtonLink to="/app/equipe/novo">Adicionar médico</ButtonLink>
          </section>
        ) : doctorId ? (
          // A chave remonta o cartão ao trocar de médico: o rascunho de um não vaza para o outro.
          <DoctorSchedulePanel
            key={doctorId}
            doctorId={doctorId}
            eyebrow="Agenda semanal"
            title={selectedDoctor?.displayName ?? "Médico selecionado"}
            description={`Horários interpretados no fuso de ${timeZoneLabel(clinic.data?.timeZoneId ?? fallbackTimeZone)}.`}
            headerField={
              isAdmin && doctors.length > 1 ? (
                <SelectField
                  id="schedule-doctor"
                  label="Médico"
                  value={doctorId}
                  onChange={(event) => setSelectedDoctorId(event.target.value)}
                >
                  {doctors.map((doctor) => (
                    <option key={doctor.userId} value={doctor.userId}>
                      {doctor.displayName}
                    </option>
                  ))}
                </SelectField>
              ) : null
            }
          />
        ) : null}
      </div>
    </>
  );
}
