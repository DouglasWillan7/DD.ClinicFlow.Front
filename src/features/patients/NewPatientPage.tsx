import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { ApiError } from "../../api/client";
import type { Member, Patient } from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { hasRole } from "../../auth/roles";
import { Button } from "../../components/Button";
import { LoadingBlock } from "../../components/Feedback";
import { onboardingKey } from "../onboarding/onboarding";
import { PatientRegistrationForm } from "./PatientRegistrationForm";
import {
  emptyPatientForm,
  getSafeReturnTo,
  toPatientPayload,
  type PatientFormValue,
} from "./patientForm";
import styles from "./PatientsPage.module.css";

export function NewPatientPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = getSafeReturnTo(params.get("returnTo"));
  // A busca global manda o termo digitado em `?nome=` quando não achou ninguém.
  const suggestedName = (params.get("nome") ?? "").trim().slice(0, 120);
  const members = useQuery({
    queryKey: ["clinic", "members"],
    queryFn: () => request<Member[]>("/clinics/members"),
  });
  const mutation = useMutation({
    mutationFn: (values: PatientFormValue) =>
      request<Patient>("/patients", {
        method: "POST",
        body: JSON.stringify(toPatientPayload(values)),
      }),
    onSuccess: (patient) => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: onboardingKey });
      if (returnTo === "/app/pacientes") {
        navigate(returnTo);
        return;
      }
      const separator = returnTo.indexOf("?");
      const pathname = separator < 0 ? returnTo : returnTo.slice(0, separator);
      const returnParams = new URLSearchParams(
        separator < 0 ? "" : returnTo.slice(separator + 1),
      );
      returnParams.set("patientId", patient.id);
      navigate(`${pathname}?${returnParams.toString()}`);
    },
  });
  const doctors =
    members.data?.filter((member) => hasRole(member, "Doctor")) ?? [];

  return (
    <main className={styles.registrationPage}>
      {members.isLoading ? (
        <LoadingBlock label="Carregando os médicos…" />
      ) : doctors.length === 0 ? (
        <section className={styles.prerequisite}>
          <Stethoscope size={28} aria-hidden="true" />
          <h1>Adicione um médico antes do paciente</h1>
          <p>
            Todo paciente precisa de um médico responsável ativo na clínica.
            Convites pendentes ainda não liberam o cadastro.
          </p>
          <Button type="button" onClick={() => navigate("/app/equipe/novo")}>
            Adicionar médico
          </Button>
        </section>
      ) : (
        <PatientRegistrationForm
          initialValue={{ ...emptyPatientForm, name: suggestedName }}
          doctors={doctors}
          onSubmit={(values) => mutation.mutate(values)}
          onCancel={() => navigate(returnTo)}
          onResetServerError={mutation.reset}
          pending={mutation.isPending}
          serverError={
            mutation.isError
              ? mutation.error instanceof ApiError
                ? mutation.error.message
                : "Não foi possível cadastrar o paciente."
              : null
          }
        />
      )}
    </main>
  );
}
