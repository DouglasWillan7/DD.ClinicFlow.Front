import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import styles from "./PublicLayout.module.css";

/**
 * Casco das telas fora do app (cadastro, convite, ação do paciente, erro):
 * fundo do aplicativo, a marca oficial no topo e o conteúdo centralizado.
 */
export function PublicLayout({
  children,
  note,
}: {
  children: ReactNode;
  /** Frase de privacidade ou contexto abaixo do conteúdo. */
  note?: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <a className={styles.brand} href="/" aria-label="ClinicFlow — início">
        <BrandMark />
      </a>
      {children}
      {note ? <p className={styles.note}>{note}</p> : null}
    </main>
  );
}
