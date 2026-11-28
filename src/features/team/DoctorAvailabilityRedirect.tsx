import { useQuery } from "@tanstack/react-query";
import type { Member } from "../../api/types";
import { Redirect } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { LoadingBlock } from "../../components/Feedback";
import { clinicMembersSummaryKey } from "../clinic/healthcarePlanQueries";
import { memberProfilePath, teamPath } from "./memberProfilePaths";

/**
 * Destino de `/app/configuracoes/agenda` para a administração que não atende como
 * médico. A disponibilidade virou aba do perfil do médico em Equipe; o link antigo (e o
 * que a API ainda devolve em "Primeiros passos") abre a do primeiro médico, como a
 * página antiga fazia. Sem médico, o caminho é cadastrar um.
 */
export function DoctorAvailabilityRedirect() {
  const { request, session } = useAuth();
  const clinicId = session?.clinicId;
  const members = useQuery({
    queryKey: clinicMembersSummaryKey,
    enabled: Boolean(clinicId),
    queryFn: () => request<Member[]>(`/clinics/${clinicId}/members/summary`),
    // O resumo em cache pode ser de antes do médico recém-cadastrado: decide com a lista atual.
    refetchOnMount: "always",
  });

  if (members.isFetching) {
    return <LoadingBlock label="Abrindo a disponibilidade do médico…" />;
  }
  if (members.isError || !members.data) {
    return <Redirect to={teamPath} replace />;
  }
  const doctor = members.data.find((member) => member.role === "Doctor");
  return (
    <Redirect
      to={
        doctor
          ? memberProfilePath(doctor.userClinicId, "availability")
          : `${teamPath}/novo`
      }
      replace
    />
  );
}
