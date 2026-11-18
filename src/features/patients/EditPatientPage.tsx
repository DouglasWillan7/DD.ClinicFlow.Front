import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import type { Patient } from "../../api/types";
import { useNavigate } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { ContextBar } from "../../components/ContextBar";
import { ErrorBlock, LoadingBlock } from "../../components/Feedback";

import { DoctorAccessPanel } from "../patient-actions/DoctorAccessPanel";
// A extensão distingue PatientForm.tsx de patientForm.ts em discos sem diferença de caixa.
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
      <ContextBar
        currentAs="h1"
        back={{ label: "Voltar para a lista de pacientes", to: "/app/pacientes" }}
        crumbs={[
          { label: "Pacientes", to: "/app/pacientes" },
          // Só quem lê o prontuário tem a ficha como destino.
          can(session, "ReadClinicalRecord")
            ? { label: patient.data.name, to: `/app/pacientes/${patientId}`, truncate: true }
            : { label: patient.data.name, truncate: true },
          { label: "Editar cadastro" },
        ]}
      />
      <div className={styles.editContent}>
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
