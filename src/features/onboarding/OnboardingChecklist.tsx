import clsx from "clsx";
import { ArrowRight, Check, Circle, LockKeyhole, Route } from "lucide-react";
import type { OnboardingStatus } from "../../api/types";
import { Link } from "../../app/navigation";
import {
  getNextOnboardingStep,
  getOnboardingProgress,
} from "./onboarding";
import styles from "./OnboardingChecklist.module.css";

export function OnboardingChecklist({
  status,
  compact = false,
}: {
  status: OnboardingStatus;
  compact?: boolean;
}) {
  const progress = getOnboardingProgress(status);
  const nextStep = getNextOnboardingStep(status);

  return (
    <section
      className={clsx(styles.checklist, compact && styles.compact)}
      aria-labelledby={compact ? "compact-onboarding-title" : "onboarding-title"}
    >
      <header>
        <span className={styles.routeIcon} aria-hidden="true">
          <Route size={18} />
        </span>
        <div>
          <h2 id={compact ? "compact-onboarding-title" : "onboarding-title"}>
            {status.completed ? "Clínica pronta para operar" : "Primeiros passos"}
          </h2>
          <p>
            {status.completedCount} de {status.totalCount} etapas concluídas
          </p>
        </div>
        <strong className={styles.percentage}>{progress}%</strong>
      </header>

      <div
        className={styles.progress}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Progresso da configuração"
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      {!compact ? (
        <ol>
          {status.steps.map((step) => (
            <li
              key={step.code}
              className={clsx(
                step.completed && styles.done,
                step.blocked && !step.completed && styles.blocked,
              )}
            >
              <span className={styles.marker} aria-hidden="true">
                {step.completed ? <Check size={15} /> : <Circle size={15} />}
              </span>
              {step.blocked && !step.completed ? (
                <span className={styles.blockedLabel}>
                  {step.label}
                  <small>Conclua a etapa necessária primeiro</small>
                </span>
              ) : (
                <Link to={step.path}>{step.label}</Link>
              )}
              {step.blocked && !step.completed ? (
                <LockKeyhole size={14} aria-label="Etapa bloqueada" />
              ) : !step.completed ? (
                <ArrowRight size={15} aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      ) : nextStep ? (
        <Link className={styles.nextAction} to={nextStep.path}>
          <span>
            <small>Próxima etapa</small>
            <strong>{nextStep.label}</strong>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ) : (
        <p className={styles.completeCopy}>
          As configurações essenciais estão concluídas.
        </p>
      )}
    </section>
  );
}
