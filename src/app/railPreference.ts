const RAIL_KEY_PREFIX = "clinicflow.rail:";

/**
 * O menu nasce recolhido (72px, como no handoff) e expande no hover; o alfinete
 * fixa a versão de 264px por usuário e a preferência sobrevive a novas sessões.
 */
export function readRailPinned(scope: string) {
  if (!scope) return false;
  try {
    return localStorage.getItem(`${RAIL_KEY_PREFIX}${scope}`) === "expanded";
  } catch {
    return false;
  }
}

export function saveRailPinned(scope: string, pinned: boolean) {
  if (!scope) return;
  try {
    localStorage.setItem(
      `${RAIL_KEY_PREFIX}${scope}`,
      pinned ? "expanded" : "collapsed",
    );
  } catch {
    // A navegação continua mesmo sem acesso ao storage persistente.
  }
}
