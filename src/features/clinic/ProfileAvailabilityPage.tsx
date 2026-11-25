import { timeZoneLabel, useClinicTimeZone } from "./clinicTimeZone";
import { DoctorSchedulePanel } from "./DoctorSchedulePanel";
import { NoDoctorPracticeNote, ProfileSettingsFrame } from "./ProfileSettingsFrame";

/**
 * Aba "Disponibilidade" de Meu perfil: o médico cuida da própria semana padrão sem ir
 * a outra área. Tem salvar próprio porque conta e horários são gravados por rotas
 * diferentes.
 */
export function ProfileAvailabilityPage() {
  const timeZone = useClinicTimeZone();

  return (
    <ProfileSettingsFrame>
      {(profile) =>
        profile.role === "Doctor" ? (
          <DoctorSchedulePanel
            doctorId={profile.userId}
            title="Disponibilidade de atendimento"
            description={`Sua semana padrão nesta clínica, no fuso de ${timeZoneLabel(timeZone)}. Ausências e férias continuam sendo bloqueadas diretamente na Agenda.`}
          />
        ) : (
          <NoDoctorPracticeNote />
        )
      }
    </ProfileSettingsFrame>
  );
}
