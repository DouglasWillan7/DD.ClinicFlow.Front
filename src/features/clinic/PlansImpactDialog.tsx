import { AlertTriangle, Star } from "lucide-react";
import type { ClinicHealthcarePlansImpact, HealthcarePlanMode } from "../../api/types";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { getInitials } from "../appointments/appointmentLabels";
import { healthcarePlanModeLabels, joinNames } from "./healthcarePlanLabels";
import styles from "./HealthcarePlansSettingsPage.module.css";

type Removal = ClinicHealthcarePlansImpact["removals"][number];

function DoctorGroups({ removal }: { removal: Removal }) {
  const modes: HealthcarePlanMode[] = ["ClinicDefault", "Custom"];
  return (
    <ul className={styles.impactList}>
      {modes.map((mode) => {
        const doctors = removal.doctors.filter((doctor) => doctor.mode === mode);
        if (doctors.length === 0) return null;
        return (
          <li className={styles.impactRow} key={mode}>
            <span className={styles.avatarStack} aria-hidden="true">
              {doctors.slice(0, 3).map((doctor) => (
                <span className={styles.avatar} key={doctor.userClinicId}>
                  {getInitials(doctor.displayName)}
                </span>
              ))}
            </span>
            <span className={styles.impactNames}>
              {joinNames(doctors.map((doctor) => doctor.displayName))}
            </span>
            <span className={mode === "ClinicDefault" ? styles.definedTag : styles.neutralTag}>
              {mode === "ClinicDefault" ? (
                <Star size={12} fill="currentColor" aria-hidden="true" />
              ) : null}
              {mode === "ClinicDefault" ? "Padrão" : healthcarePlanModeLabels.Custom}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Confirmação antes de gravar a clínica quando algum médico deixa de atender um convênio.
 * Com uma mudança só, fala daquele convênio e "Manter" o devolve ao estado salvo; com
 * várias, lista um bloco por convênio.
 */
export function PlansImpactDialog({
  impact,
  noLongerAcceptedIds,
  planName,
  saving,
  onCancel,
  onKeepPlan,
  onConfirm,
}: {
  impact: ClinicHealthcarePlansImpact;
  noLongerAcceptedIds: string[];
  planName(id: string): string;
  saving: boolean;
  onCancel(): void;
  onKeepPlan(planId: string): void;
  onConfirm(): void;
}) {
  const single = impact.removals.length === 1 ? impact.removals[0] : null;
  const singleName = single ? planName(single.healthcarePlanId) : "";
  const singleRemoved = single
    ? noLongerAcceptedIds.includes(single.healthcarePlanId)
    : false;

  const title = !single
    ? "Confirmar mudanças nos convênios?"
    : singleRemoved
      ? `Deixar de aceitar ${singleName}?`
      : `Tirar ${singleName} do padrão?`;
  const description = !single
    ? "Estes médicos deixam de atender os convênios abaixo. Consultas já agendadas não mudam."
    : singleRemoved
      ? `${singleName} sai da clínica, do padrão e das listas dos médicos. Consultas já agendadas não mudam.`
      : `Médicos em “Padrão da clínica” deixam de atender ${singleName}. Consultas já agendadas não mudam.`;

  // Sem botão fechar: a decisão fica nos dois botões. Enquanto salva, nem Esc
  // nem o clique no fundo dispensam o diálogo.
  return (
    <Dialog
      tone="danger"
      icon={<AlertTriangle size={20} />}
      title={title}
      description={description}
      closeLabel={null}
      dismissible={!saving}
      onClose={onCancel}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={single ? () => onKeepPlan(single.healthcarePlanId) : onCancel}
          >
            {!single
              ? "Voltar"
              : singleRemoved
                ? `Manter ${singleName}`
                : "Manter no padrão"}
          </Button>
          <Button type="button" variant="danger" loading={saving} onClick={onConfirm}>
            {!single
              ? "Salvar mudanças"
              : singleRemoved
                ? "Deixar de aceitar"
                : "Tirar do padrão"}
          </Button>
        </>
      }
    >
      <div className={styles.impactBody}>
        {single ? (
          <DoctorGroups removal={single} />
        ) : (
          impact.removals.map((removal) => (
            <section className={styles.impactSection} key={removal.healthcarePlanId}>
              <h3>
                {planName(removal.healthcarePlanId)}
                <small>
                  {noLongerAcceptedIds.includes(removal.healthcarePlanId)
                    ? "deixa de ser aceito"
                    : "sai do padrão"}
                </small>
              </h3>
              <DoctorGroups removal={removal} />
            </section>
          ))
        )}

      </div>
    </Dialog>
  );
}
