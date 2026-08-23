import { CalendarCheck2, CheckCircle2, MessageCircleMore } from "lucide-react";
import type { PropsWithChildren } from "react";
import { BrandMark } from "../components/BrandMark";
import styles from "./AuthLayout.module.css";

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className={styles.layout}>
      <section className={styles.context} aria-label="Sobre o ClinicFlow">
        <BrandMark inverse />
        <div className={styles.message}>
          <span className={styles.eyebrow}>A recepção em fluxo</span>
          <h1>A rotina começa organizada.</h1>
          <p>
            Agenda, pacientes e confirmações no mesmo lugar — com contexto para
            decidir o próximo passo sem perder o ritmo da clínica.
          </p>
        </div>
        <div className={styles.flow} aria-hidden="true">
          <div>
            <CalendarCheck2 size={18} />
            <span>Agenda de hoje</span>
            <i />
          </div>
          <div>
            <CheckCircle2 size={18} />
            <span>Confirmações visíveis</span>
            <i />
          </div>
          <div>
            <MessageCircleMore size={18} />
            <span>Contato no contexto</span>
            <i />
          </div>
        </div>
        <small>ClinicFlow · Operação clínica calma, precisa e humana.</small>
      </section>

      <section className={styles.formArea}>
        <div className={styles.mobileBrand}>
          <BrandMark />
        </div>
        {children}
      </section>
    </main>
  );
}
