import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Member, PatientListItem } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { buildDoctorEntries, buildPatientEntries } from "./searchIndex";

/**
 * A busca da topbar responde a cada tecla: em vez de um endpoint por digitação,
 * o cadastro inteiro da clínica fica em memória e o filtro roda local, sem
 * debounce. As chaves são as mesmas da lista de pacientes e da equipe, então o
 * cache é compartilhado e a topbar não gera requisição extra depois da primeira.
 */
const INDEX_STALE_TIME = 5 * 60_000;

export function useGlobalSearchIndex() {
  const { request } = useAuth();

  const patients = useQuery({
    queryKey: ["patients", "list"],
    queryFn: () => request<PatientListItem[]>("/patients?includeInactive=true"),
    staleTime: INDEX_STALE_TIME,
  });
  const members = useQuery({
    queryKey: ["clinic", "members"],
    queryFn: () => request<Member[]>("/clinics/members"),
    staleTime: INDEX_STALE_TIME,
  });

  const patientEntries = useMemo(
    () => buildPatientEntries(patients.data ?? []),
    [patients.data],
  );
  const doctorEntries = useMemo(
    () => buildDoctorEntries(members.data ?? []),
    [members.data],
  );

  return {
    patients: patientEntries,
    doctors: doctorEntries,
    isLoading: patients.isPending || members.isPending,
    isError: patients.isError || members.isError,
    retry: () => {
      void patients.refetch();
      void members.refetch();
    },
  };
}
