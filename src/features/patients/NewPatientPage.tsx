import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type {
  ExistingPatientPreview,
  Patient,
  PatientDemographic,
  PatientDocumentLookup,
} from "../../api/types";
import { useNavigate, useSearchParams } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { documentTypesFor } from "../../auth/documentIdentity";
import { can } from "../../auth/permissions";
import { Button } from "../../components/Button";
import { ContextBar } from "../../components/ContextBar";
import { ExistingPatientConfirmation } from "./ExistingPatientConfirmation";
import { PatientDocumentStep } from "./PatientDocumentStep";
import { PatientRegistrationForm } from "./PatientRegistrationForm";
import {
  emptyPatientDocument,
  emptyPatientForm,
  getSafeReturnTo,
  toPatientDocumentPayload,
  toPatientPayload,
  type PatientDocumentValue,
  type PatientFormValue,
} from "./patientForm";
import { formatPatientDocument } from "./patientFormatters";
import registrationStyles from "./PatientRegistrationForm.module.css";
import styles from "./PatientsPage.module.css";

/**
 * O cadastro começa pelo documento. A consulta decide o caminho: pessoa nova segue
 * o formulário completo; pessoa que já existe no ClinicFlow é só confirmada e
 * vinculada a esta clínica; quem já é paciente daqui não é cadastrado de novo.
 */
type Phase =
  | { kind: "document" }
  | { kind: "register"; document: PatientDocumentValue }
  | { kind: "confirm"; document: PatientDocumentValue; patient: ExistingPatientPreview };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function documentLabel(document: PatientDocumentValue) {
  const type =
    documentTypesFor(document.documentCountryCode).find(
      (item) => item.code === document.documentType,
    )?.label ?? document.documentType;
  return `${type} ${formatPatientDocument(
    document.documentCountryCode,
    document.documentType,
    document.document,
  )}`;
}

export function NewPatientPage() {
  const { request, session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = getSafeReturnTo(params.get("returnTo"));
  // A busca global manda o termo digitado em `?nome=` quando não achou ninguém.
  const suggestedName = (params.get("nome") ?? "").trim().slice(0, 120);
  const [phase, setPhase] = useState<Phase>({ kind: "document" });
  const [lastDocument, setLastDocument] = useState<PatientDocumentValue>(emptyPatientDocument);
  const [alreadyLinkedId, setAlreadyLinkedId] = useState<string | null>(null);

  /** Mesmo destino para o cadastro novo e para o vínculo de um paciente existente. */
  function finish(patientId: string) {
    void queryClient.invalidateQueries({ queryKey: ["patients"] });
    if (returnTo === "/app/pacientes") {
      navigate(returnTo);
      return;
    }
    const separator = returnTo.indexOf("?");
    const pathname = separator < 0 ? returnTo : returnTo.slice(0, separator);
    const returnParams = new URLSearchParams(
      separator < 0 ? "" : returnTo.slice(separator + 1),
    );
    returnParams.set("patientId", patientId);
    navigate(`${pathname}?${returnParams.toString()}`);
  }

  const lookup = useMutation({
    mutationFn: (document: PatientDocumentValue) =>
      request<PatientDocumentLookup>("/patients/lookup", {
        method: "POST",
        body: JSON.stringify(toPatientDocumentPayload(document)),
      }),
    onSuccess: (result, document) => {
      setLastDocument(document);
      if (result.status === "Found" && result.patient) {
        setAlreadyLinkedId(null);
        setPhase({ kind: "confirm", document, patient: result.patient });
        return;
      }
      if (result.status === "AlreadyLinked" && result.patientId) {
        setAlreadyLinkedId(result.patientId);
        setPhase({ kind: "document" });
        return;
      }
      setAlreadyLinkedId(null);
      setPhase({ kind: "register", document });
    },
  });

  const create = useMutation({
    mutationFn: (values: PatientFormValue) =>
      request<Patient>("/patients", {
        method: "POST",
        body: JSON.stringify(toPatientPayload(values)),
      }),
    onSuccess: (patient) => finish(patient.id),
    onError: (error, values) => {
      // Alguém cadastrou o mesmo documento entre a consulta e o envio: consultar de
      // novo leva à confirmação do cadastro que agora existe.
      if (error instanceof ApiError && error.status === 409) {
        lookup.mutate({
          documentCountryCode: values.documentCountryCode,
          documentType: values.documentType,
          document: values.document,
        });
      }
    },
  });

  const link = useMutation({
    mutationFn: (document: PatientDocumentValue) =>
      request<PatientDemographic>("/patients/clinic-link", {
        method: "POST",
        body: JSON.stringify(toPatientDocumentPayload(document)),
      }),
    onSuccess: (patient) => finish(patient.id),
  });

  function backToDocument() {
    lookup.reset();
    create.reset();
    link.reset();
    setAlreadyLinkedId(null);
    setPhase({ kind: "document" });
  }

  function openLinkedPatient(patientId: string) {
    if (returnTo !== "/app/pacientes") {
      finish(patientId);
      return;
    }
    // Só quem lê o prontuário tem a ficha como destino; os demais vão ao cadastro.
    navigate(
      `/app/pacientes/${encodeURIComponent(patientId)}${
        can(session, "ReadClinicalRecord") ? "" : "/editar"
      }`,
    );
  }

  return (
    <>
      {/* O título da tela é o passo atual do assistente, dentro do cartão. */}
      <ContextBar
        back={{ label: "Voltar sem cadastrar", onClick: () => navigate(returnTo) }}
        crumbs={[{ label: "Pacientes", to: "/app/pacientes" }, { label: "Novo paciente" }]}
      />
      <div className={styles.registrationPage}>
        {phase.kind === "document" ? (
          <PatientDocumentStep
            initialValue={lastDocument}
            onSubmit={(document) => lookup.mutate(document)}
            onCancel={() => navigate(returnTo)}
            onChange={() => {
              if (alreadyLinkedId) setAlreadyLinkedId(null);
              if (lookup.isError) lookup.reset();
            }}
            pending={lookup.isPending}
            serverError={
              lookup.isError
                ? errorMessage(lookup.error, "Não foi possível consultar o documento.")
                : null
            }
            notice={
              alreadyLinkedId ? (
                <div className={registrationStyles.lockedDocument} role="status">
                  <p className={registrationStyles.note}>
                    Este documento já é de um paciente desta clínica. Não é preciso cadastrar de novo.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openLinkedPatient(alreadyLinkedId)}
                  >
                    {returnTo === "/app/pacientes" ? "Abrir cadastro" : "Usar este paciente"}
                  </Button>
                </div>
              ) : null
            }
          />
        ) : null}

        {phase.kind === "register" ? (
          <PatientRegistrationForm
            initialValue={{ ...emptyPatientForm, ...phase.document, name: suggestedName }}
            onSubmit={(values) => create.mutate(values)}
            onCancel={() => navigate(returnTo)}
            onResetServerError={create.reset}
            pending={create.isPending || lookup.isPending}
            serverError={
              create.isError
                ? errorMessage(create.error, "Não foi possível cadastrar o paciente.")
                : null
            }
            documentLocked
            onChangeDocument={backToDocument}
          />
        ) : null}

        {phase.kind === "confirm" ? (
          <ExistingPatientConfirmation
            patient={phase.patient}
            documentLabel={documentLabel(phase.document)}
            onConfirm={() => link.mutate(phase.document)}
            onBack={backToDocument}
            onCancel={() => navigate(returnTo)}
            pending={link.isPending}
            serverError={
              link.isError
                ? errorMessage(link.error, "Não foi possível vincular o paciente.")
                : null
            }
          />
        ) : null}
      </div>
    </>
  );
}
