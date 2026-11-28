import clsx from "clsx";
import {
  CalendarDays,
  ChevronDown,
  House,
  LogOut,
  Menu,
  Pin,
  Settings,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  type FocusEvent,
  type PropsWithChildren,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { can, getAppStart } from "../auth/permissions";
import { formatRoles, roleLabels } from "../auth/roles";
import { getAuthScope } from "../auth/sessionScope";
import { BrandMark } from "../components/BrandMark";
import { LoadingBlock } from "../components/Feedback";
import { ClinicContextSelector } from "../features/clinic-context/ClinicContextSelector";
import { GlobalSearch } from "../features/search/GlobalSearch";
import { NavLink, useNavigate } from "./navigation";
import { readRailPinned, saveRailPinned } from "./railPreference";
import { useConfirmDiscard } from "./unsavedChanges";
import styles from "./AppShell.module.css";

export function AppShell({ children }: PropsWithChildren) {
  const { session, logout, switchClinic } = useAuth();
  const navigate = useNavigate();
  const confirmDiscard = useConfirmDiscard();
  const railScope = session ? getAuthScope(session) : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [railPinned, setRailPinned] = useState(() => readRailPinned(railScope));
  const [railHovered, setRailHovered] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switchingClinicId, setSwitchingClinicId] = useState<string>();
  const [contextError, setContextError] = useState<string>();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const restoreMenuFocusRef = useRef(false);
  const userContextRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

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

  // Mesmo contrato do menu "Nova consulta" da Agenda: Esc e clique fora fecham,
  // e Esc devolve o foco ao botão que abriu.
  useEffect(() => {
    if (!userMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        userContextRef.current?.contains(event.target)
      ) {
        return;
      }
      setUserMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setUserMenuOpen(false);
      userButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  if (!session) return null;

  const displayName = session.name ?? session.email.split("@")[0];
  const roleLabel = session.clinicRole
    ? roleLabels[session.clinicRole]
    : formatRoles(session);
  const activeClinicName = session.clinicName ?? "Clínica atual";
  const adminLabel = session.isAdmin ? "Administração" : undefined;
  const accountLabel = [displayName, activeClinicName, roleLabel, adminLabel]
    .filter(Boolean)
    .join(", ");
  const availableClinics = session.availableClinics ?? [];
  const otherClinics = availableClinics.filter(
    (clinic) => clinic.userClinicId !== session.userClinicId,
  );
  // O hover é a expansão padrão do handoff; o teclado precisa do mesmo gatilho.
  const railExpanded = railPinned || railHovered || railFocused;
  const primaryNav = [
    can(session, "ReadClinicalRecord")
      ? { to: "/app/inicio", label: "Início", icon: House }
      : undefined,
    can(session, "ManagePatientDemographics")
      ? { to: "/app/pacientes", label: "Pacientes", icon: UsersRound }
      : undefined,
    can(session, "ViewSchedule")
      ? { to: "/app/agenda", label: "Agendas", icon: CalendarDays }
      : undefined,
    can(session, "ManageClinicMemberships")
      ? { to: "/app/equipe", label: "Equipe", icon: UserRoundPlus }
      : undefined,
    // A disponibilidade do médico não tem item próprio: abre por Primeiros passos,
    // pelo vínculo em Equipe e pela aba de Meu perfil.
    can(session, "ManageClinicSettings")
      ? { to: "/app/configuracoes/clinica", label: "Configuração", icon: Settings }
      : undefined,
  ].filter((item) => item !== undefined);

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

  const chooseClinic = async (userClinicId: string) => {
    setSwitchingClinicId(userClinicId);
    setContextError(undefined);
    try {
      const next = await switchClinic(userClinicId);
      setUserMenuOpen(false);
      navigate(getAppStart(next), {
        replace: true,
      });
    } catch {
      setContextError(
        `A outra clínica não está disponível. Você continua na ${activeClinicName}.`,
      );
    } finally {
      setSwitchingClinicId(undefined);
    }
  };

  const renderLink = ({
    to,
    label,
    icon: Icon,
  }: (typeof primaryNav)[number]) => (
    <NavLink
      key={to}
      to={to}
      matchChildren
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
        </nav>
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

          <div className={styles.userContext} ref={userContextRef}>
            <button
              ref={userButtonRef}
              type="button"
              className={styles.userButton}
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-label={accountLabel}
              aria-expanded={userMenuOpen}
              aria-controls="user-menu"
            >
              <span className={styles.avatar} aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.userCopy}>
                <strong>{displayName}</strong>
                <small>
                  {activeClinicName} · {roleLabel}{adminLabel ? ` · ${adminLabel}` : ""}
                </small>
              </span>
              <ChevronDown
                className={clsx(
                  styles.userChevron,
                  userMenuOpen && styles.userChevronOpen,
                )}
                aria-hidden="true"
              />
            </button>

            {userMenuOpen ? (
              <div id="user-menu" className={styles.userMenu}>
                <section className={styles.currentContext} aria-label="Contexto atual">
                  <span>Contexto atual</span>
                  <strong>{activeClinicName}</strong>
                  <small>{roleLabel}{adminLabel ? ` · ${adminLabel}` : ""}</small>
                </section>

                {otherClinics.length > 0 ? (
                  <section className={styles.contextChoices} aria-label="Trocar de clínica">
                    <span className={styles.menuLabel}>Trocar de clínica</span>
                    <ClinicContextSelector
                      clinics={otherClinics}
                      busyUserClinicId={switchingClinicId}
                      focusFirstOnMount
                      onSelect={(userClinicId) =>
                        confirmDiscard(() => void chooseClinic(userClinicId))
                      }
                    />
                  </section>
                ) : null}

                {contextError ? (
                  <p className={styles.contextError} role="alert">{contextError}</p>
                ) : null}

                {/* Conta e saída moram só aqui: o menu lateral fica com os destinos de trabalho. */}
                <div className={styles.menuActions}>
                  <NavLink
                    to="/app/configuracoes/perfil"
                    className={styles.menuAction}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <UserRound size={18} aria-hidden="true" />
                    Meu perfil
                  </NavLink>
                  <button
                    type="button"
                    className={styles.menuAction}
                    onClick={() => {
                      setUserMenuOpen(false);
                      confirmDiscard(logout);
                    }}
                  >
                    <LogOut size={18} aria-hidden="true" />
                    Sair
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className={styles.main}>
          {/* Página ainda baixando: o menu e o topo continuam na tela, só o conteúdo espera. */}
          <Suspense fallback={<LoadingBlock label="Carregando…" />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
