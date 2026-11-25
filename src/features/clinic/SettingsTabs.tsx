import { useEffect, useRef } from "react";
import { NavLink } from "../../app/navigation";
import styles from "./SettingsTabs.module.css";

export interface SettingsTab {
  to: string;
  label: string;
}

/**
 * Barra de abas das telas de Configurações (Clínica e Meu perfil), no mesmo padrão das
 * seções do paciente. Cada aba é uma rota, para o link ser compartilhável.
 *
 * `scrollOnPhone` é para quando as abas não cabem em 390px: em vez de espremer os
 * rótulos, cada aba mantém o próprio tamanho e a barra rola.
 */
export function SettingsTabs({
  label,
  tabs,
  scrollOnPhone = false,
}: {
  label: string;
  tabs: readonly SettingsTab[];
  scrollOnPhone?: boolean;
}) {
  const scrollerRef = useRef<HTMLElement>(null);

  // No celular a barra pode rolar: a aba atual não pode abrir escondida à direita.
  useEffect(() => {
    scrollerRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tabs.length]);

  return (
    <nav ref={scrollerRef} className={styles.scroller} aria-label={label}>
      <div
        className={
          scrollOnPhone ? `${styles.tabs} ${styles.scrollOnPhone}` : styles.tabs
        }
      >
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
