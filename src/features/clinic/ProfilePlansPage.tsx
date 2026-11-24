import { DoctorPlansPanel } from "./DoctorPlansPanel";
import { NoDoctorPracticeNote, ProfileSettingsFrame } from "./ProfileSettingsFrame";

/** Aba "Convênios" de Meu perfil: os convênios também são do vínculo do médico. */
export function ProfilePlansPage() {
  return (
    <ProfileSettingsFrame>
      {(profile) =>
        profile.role === "Doctor" ? (
          <DoctorPlansPanel doctorName={profile.name} />
        ) : (
          <NoDoctorPracticeNote />
        )
      }
    </ProfileSettingsFrame>
  );
}
