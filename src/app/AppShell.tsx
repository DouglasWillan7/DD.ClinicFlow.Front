import clsx from "clsx";
import {
  Building2,
  CalendarDays,
  LogOut,
  Menu,
  MessageCircleMore,
  Pin,
  Stethoscope,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  type FocusEvent,
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { formatRoles, hasRole } from "../auth/roles";
import { getAuthScope } from "../auth/sessionScope";
import { BrandMark } from "../components/BrandMark";
import { GlobalSearch } from "../features/search/GlobalSearch";
import { NavLink } from "./navigation";
import { readRailPinned, saveRailPinned } from "./railPreference";
import styles from "./AppShell.module.css";

export function AppShell({ children }: PropsWithChildren) {
  const { session, logout } = useAuth();
  const railScope = session ? getAuthScope(session) : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [railPinned, setRailPinned] = useState(() => readRailPinned(railScope));
  const [railHovered, setRailHovered] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const restoreMenuFocusRef = useRef(false);

  useEffect(() => {
    const target = menuOpen
      ? drawerRef.current
      : restoreMenuFocusRef.current
        ? menuTriggerRef.current
        : null;
    if (!target) return;

    restoreMenuFocusRef.current = false;
    const focusFrame = requestAnimationFrame(() => target.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      restoreMenuFocusRef.current = true;
      setMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  if (!session) return null;

  const displayName = session.name ?? session.email.split("@")[0];
  const roleLabel = formatRoles(session);
  // O hover é a expansão padrão do handoff; o teclado precisa do mesmo gatilho.
  const railExpanded = railPinned || railHovered || railFocused;
  const primaryNav = [
    { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/app/pacientes", label: "Pacientes", icon: UsersRound },
    { to: "/app/equipe", label: "Equipe médica", icon: UserRoundPlus },
    { to: "/app/configuracoes/perfil", label: "Meu perfil", icon: UserRound },
  ];
  const adminNav = [
    { to: "/app/onboarding", label: "Primeiros passos", icon: Stethoscope },
    {
      to: "/app/configuracoes/clinica",
      label: "Clínica",
      icon: Building2,
    },
    {
      to: "/app/configuracoes/whatsapp",
      label: "WhatsApp",
      icon: MessageCircleMore,
    },
  ];

  function toggleRailPin() {
    setRailPinned((pinned) => {
      saveRailPinned(railScope, !pinned);
      return !pinned;
    });
  }

  function releaseRailFocus(event: FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setRailFocused(false);
  }

  const closeDrawer = (restoreFocus = false) => {
    restoreMenuFocusRef.current = restoreFocus;
    setMenuOpen(false);
  };

  const renderLink = ({
    to,
    label,
    icon: Icon,
  }: (typeof primaryNav)[number]) => (
    <NavLink
      key={to}
      to={to}
      onClick={() => closeDrawer()}
      className={({ isActive }) =>
        clsx(styles.railItem, styles.navLink, isActive && styles.active)
      }
    >
      <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
      <span className={styles.railItemText}>{label}</span>
    </NavLink>
  );

  return (
    <div className={clsx(styles.shell, railExpanded && styles.shellExpanded)}>
      <aside
        ref={drawerRef}
        className={clsx(styles.sidebar, menuOpen && styles.sidebarOpen)}
        tabIndex={-1}
        onMouseEnter={() => setRailHovered(true)}
        onMouseLeave={() => setRailHovered(false)}
        onFocus={() => setRailFocused(true)}
        onBlur={releaseRailFocus}
      >
        <div className={styles.brandRow}>
          <span className={styles.brandLogo} aria-hidden="true">
            <BrandMark compact />
          </span>
          <span className={styles.wordmark}>ClinicFlow</span>

          <button
            type="button"
            className={clsx(styles.pinButton, railPinned && styles.pinActive)}
            onClick={toggleRailPin}
            aria-label={railPinned ? "Desafixar menu" : "Fixar menu"}
            aria-pressed={railPinned}
            aria-controls="rail-navigation"
          >
            <Pin size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={styles.closeButton}
            onClick={() => closeDrawer(true)}
            aria-label="Fechar navegação"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav
          id="rail-navigation"
          className={styles.navigation}
          aria-label="Navegação principal"
        >
          {primaryNav.map(renderLink)}

          {hasRole(session, "Admin") ? (
            <>
              <span className={styles.navLabel}>Configuração</span>
              {adminNav.map(renderLink)}
            </>
          ) : null}
        </nav>

        <button
          type="button"
          className={clsx(styles.railItem, styles.logoutButton)}
          onClick={logout}
          aria-label="Sair"
        >
          <LogOut size={20} strokeWidth={1.7} aria-hidden="true" />
          <span className={styles.railItemText}>Sair</span>
        </button>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          onClick={() => closeDrawer(true)}
          aria-label="Fechar menu sobreposto"
        />
      ) : null}

      <div className={styles.workspace} inert={menuOpen}>
        <header className={styles.topbar}>
          <button
            ref={menuTriggerRef}
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir navegação"
            aria-expanded={menuOpen}
          >
            <Menu size={21} aria-hidden="true" />
          </button>

          {/* A chave remonta a busca ao trocar de identidade: termo digitado e
              itens recentes nunca atravessam sessões. */}
          <GlobalSearch key={railScope} />

          <span className={styles.topbarSpacer} />

          <div className={styles.userContext}>
            <button
              type="button"
              className={styles.userButton}
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-label={`${displayName}, ${roleLabel}`}
              aria-expanded={userMenuOpen}
              aria-controls="user-menu"
            >
              <span className={styles.avatar} aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.userCopy}>
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </span>
            </button>

            {userMenuOpen ? (
              <div id="user-menu" className={styles.userMenu}>
                <NavLink
                  to="/app/configuracoes/perfil"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Meu perfil
                </NavLink>
              </div>
            ) : null}
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
