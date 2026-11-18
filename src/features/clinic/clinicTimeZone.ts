import { useQuery } from "@tanstack/react-query";
import type { Clinic } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";

/** Fuso usado enquanto a clínica não carrega ou quando o dado falta. */
export const fallbackTimeZone = "America/Sao_Paulo";

/** Fusos oferecidos no cadastro da clínica, com o nome que a equipe reconhece. */
export const clinicTimeZones: { id: string; label: string }[] = [
  { id: "America/Sao_Paulo", label: "Brasília (São Paulo)" },
  { id: "America/Manaus", label: "Manaus" },
  { id: "America/Cuiaba", label: "Cuiabá" },
  { id: "America/Recife", label: "Recife" },
  { id: "America/Rio_Branco", label: "Rio Branco" },
];

/**
 * Nome legível do fuso. Um identificador fora da lista (clínica no exterior)
 * mostra só a cidade, sem o prefixo do continente nem sublinhados.
 */
export function timeZoneLabel(timeZoneId: string) {
  const known = clinicTimeZones.find((zone) => zone.id === timeZoneId);
  if (known) return known.label;
  return (timeZoneId.split("/").pop() ?? timeZoneId).replaceAll("_", " ");
}

/**
 * Fuso da clínica do contexto. Compartilha a query `["clinic", "current"]` das
 * páginas, então não gera uma requisição a mais quando ela já está em cache.
 */
export function useClinicTimeZone() {
  const { request } = useAuth();
  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  return clinic.data?.timeZoneId ?? fallbackTimeZone;
}

/** Data e hora de um instante UTC no fuso informado, no formato curto pt-BR. */
export function formatDateTimeInZone(
  value: string | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone }).format(date);
}
