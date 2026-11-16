import { NavLink } from "../../app/navigation";
import styles from "./ClinicSettingsTabs.module.css";

export const clinicSettingsPath = "/app/configuracoes/clinica";
export const clinicHealthcarePlansPath = `${clinicSettingsPath}/convenios`;

const tabs = [
  { to: clinicSettingsPath, label: "Dados da clínica" },
  { to: clinicHealthcarePlansPath, label: "Convênios" },
];

/** Seções da configuração da clínica; cada uma é uma rota, para o link ser compartilhável. */
export function ClinicSettingsTabs() {
  return (
    <nav className={styles.tabs} aria-label="Configuração da clínica">
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
    </nav>
  );
}
