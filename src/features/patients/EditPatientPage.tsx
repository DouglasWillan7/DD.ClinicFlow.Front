import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import type { Member, Patient } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { hasRole } from "../../auth/roles";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";
import { PageHeader } from "../../components/PageHeader";
import { DoctorAccessPanel } from "../patient-actions/DoctorAccessPanel";
import { PatientForm } from "./PatientForm.tsx";
import { formatMedicalRecord } from "./patientFormatters";
import { toPatientPayload, type PatientFormValue } from "./patientForm";
import styles from "./PatientsPage.module.css";

function toPatientFormValue(patient: Patient): PatientFormValue {
  return {
    name: patient.name,
    phone: patient.phone,
    cpf: patient.cpf,
    bloodType: patient.bloodType,
    sexForClinicalUse: patient.sexForClinicalUse,
    doctorUserId: patient.doctorUserId,
    birthDate: patient.birthDate ?? "",
    notes: patient.notes ?? "",
  };
}

export function EditPatientPage({ patientId }: { patientId: string }) {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => request<Patient>(`/patients/${patientId}`),
  });
  const members = useQuery({
    queryKey: ["clinic", "members"],
    queryFn: () => request<Member[]>("/clinics/members"),
  });
  const mutation = useMutation({
    mutationFn: (values: PatientFormValue) =>
      request<Patient>(`/patients/${patientId}`, {
        method: "PUT",
        body: JSON.stringify(toPatientPayload(values)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      navigate("/app/pacientes");
    },
  });

  if (patient.isLoading || members.isLoading) {
    return <LoadingBlock label="Carregando o cadastro…" />;
  }

  if (patient.isError || !patient.data || members.isError) {
    return (
      <ErrorBlock
        message="Não foi possível carregar o cadastro do paciente."
        retry={() => {
          void patient.refetch();
          void members.refetch();
        }}
      />
    );
  }

  const doctors =
    members.data?.filter((member) => hasRole(member, "Doctor")) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Pacientes"
        title="Editar cadastro"
        description="Atualize os dados necessários para o próximo atendimento."
      />
      <div className={styles.content}>
        <section className={styles.formPanel}>
          <dl className={styles.medicalRecord}>
            <dt>Prontuário</dt>
            <dd>{formatMedicalRecord(patient.data.medicalRecordNumber)}</dd>
          </dl>
          <PatientForm
            initialValue={toPatientFormValue(patient.data)}
            doctors={doctors}
            submitLabel="Salvar alterações"
            onSubmit={(values) => mutation.mutate(values)}
            onCancel={() => navigate("/app/pacientes")}
            pending={mutation.isPending}
            serverError={
              mutation.isError
                ? mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Não foi possível salvar as alterações."
                : null
            }
          />
        </section>
        {can(session, "ManageClinicMemberships") ||
        can(session, "ReadClinicalRecord") ? (
          <DoctorAccessPanel patientId={patientId} />
        ) : null}
      </div>
    </>
  );
}
