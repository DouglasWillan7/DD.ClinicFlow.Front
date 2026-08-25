import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import type { Patient } from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
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
  return (
    <div className={styles.registrationPage}>
      <PatientRegistrationForm
          initialValue={{ ...emptyPatientForm, name: suggestedName }}
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
    </div>
  );
}
