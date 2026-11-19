import { NavLink } from "../../app/navigation";
import styles from "./ClinicSettingsTabs.module.css";

export const clinicSettingsPath = "/app/configuracoes/clinica";
export const clinicHealthcarePlansPath = `${clinicSettingsPath}/convenios`;
export const clinicWhatsAppPath = `${clinicSettingsPath}/whatsapp`;
export const clinicPrescriptionTemplatePath = `${clinicSettingsPath}/receituario`;

const tabs = [
  { to: clinicSettingsPath, label: "Dados da clínica" },
  { to: clinicHealthcarePlansPath, label: "Convênios" },
  { to: clinicWhatsAppPath, label: "WhatsApp" },
  { to: clinicPrescriptionTemplatePath, label: "Receituário" },
];

/**
 * Seções da configuração da clínica, no mesmo padrão de abas das seções do paciente.
 * Cada aba é uma rota, para o link ser compartilhável.
 */
export function ClinicSettingsTabs() {
  return (
    <nav className={styles.scroller} aria-label="Configuração da clínica">
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.active}` : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
