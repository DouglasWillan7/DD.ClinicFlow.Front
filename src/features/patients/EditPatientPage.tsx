import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import type { Patient } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
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
    documentCountryCode: patient.documentCountryCode,
    documentType: patient.documentType,
    document: patient.document,
    email: patient.email ?? "",
    bloodType: patient.bloodType,
    sexForClinicalUse: patient.sexForClinicalUse,
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

  if (patient.isLoading) {
    return <LoadingBlock label="Carregando o cadastro…" />;
  }

  if (patient.isError || !patient.data) {
    return (
      <ErrorBlock
        message="Não foi possível carregar o cadastro do paciente."
        retry={() => {
          void patient.refetch();
        }}
      />
    );
  }

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
