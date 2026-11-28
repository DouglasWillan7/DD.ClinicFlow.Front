import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Redirect, useLocation } from "wouter";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { LoadingBlock } from "../components/Feedback";
import { actsAsDoctor, canAccessAppPath, getAppStart } from "../auth/permissions";
import {
  profileAvailabilityPath,
  profilePlansPath,
  profileSettingsPath,
} from "../features/clinic/profileSettingsPaths";
import { parseMemberProfilePath } from "../features/team/memberProfilePaths";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { UnsavedChangesProvider } from "./unsavedChanges";
import { ExamRealtimeProvider } from "../features/patients/exams/ExamRealtimeProvider";

const LoginPage = lazy(() =>
  import("../auth/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../auth/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const TeamPage = lazy(() =>
  import("../features/team/TeamPage").then((module) => ({
    default: module.TeamPage,
  })),
);
const AgendaPage = lazy(() =>
  import("../features/appointments/AgendaPage").then((module) => ({
    default: module.AgendaPage,
  })),
);
const DoctorHomePage = lazy(() =>
  import("../features/dashboard/DoctorHomePage").then((module) => ({
    default: module.DoctorHomePage,
  })),
);
const NewAppointmentPage = lazy(() =>
  import("../features/appointments/NewAppointmentPage").then((module) => ({
    default: module.NewAppointmentPage,
  })),
);
const ClinicSettingsPage = lazy(() =>
  import("../features/clinic/clinicSettingsPages").then((module) => ({
    default: module.ClinicSettingsPage,
  })),
);
const PrescriptionTemplatePage = lazy(() =>
  import("../features/clinic/clinicSettingsPages").then((module) => ({
    default: module.PrescriptionTemplatePage,
  })),
);
const WhatsAppSettingsPage = lazy(() =>
  import("../features/clinic/WhatsAppSettingsPage").then((module) => ({
    default: module.WhatsAppSettingsPage,
  })),
);
const OnboardingPage = lazy(() =>
  import("../features/clinic/clinicSettingsPages").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const ProfileSettingsPage = lazy(() =>
  import("../features/clinic/profileSettingsPages").then((module) => ({
    default: module.ProfileSettingsPage,
  })),
);
const ProfileAvailabilityPage = lazy(() =>
  import("../features/clinic/profileSettingsPages").then((module) => ({
    default: module.ProfileAvailabilityPage,
  })),
);
const ProfilePlansPage = lazy(() =>
  import("../features/clinic/profileSettingsPages").then((module) => ({
    default: module.ProfilePlansPage,
  })),
);
const HealthcarePlansSettingsPage = lazy(() =>
  import("../features/clinic/clinicSettingsPages").then((module) => ({
    default: module.HealthcarePlansSettingsPage,
  })),
);
const DoctorAvailabilityRedirect = lazy(() =>
  import("../features/team/DoctorAvailabilityRedirect").then((module) => ({
    default: module.DoctorAvailabilityRedirect,
  })),
);
const NewPatientPage = lazy(() =>
  import("../features/patients/NewPatientPage").then((module) => ({
    default: module.NewPatientPage,
  })),
);
const EditPatientPage = lazy(() =>
  import("../features/patients/EditPatientPage").then((module) => ({
    default: module.EditPatientPage,
  })),
);
const PatientsPage = lazy(() =>
  import("../features/patients/PatientsPage").then((module) => ({
    default: module.PatientsPage,
  })),
);
const PatientDetailPage = lazy(() =>
  import("../features/patients/PatientDetailPage").then((module) => ({
    default: module.PatientDetailPage,
  })),
);
const PatientAssessmentsPage = lazy(() =>
  import("../features/patients/PatientAssessmentsPage").then((module) => ({
    default: module.PatientAssessmentsPage,
  })),
);
const PatientExamsPage = lazy(() =>
  import("../features/patients/PatientExamsPage").then((module) => ({
    default: module.PatientExamsPage,
  })),
);
const PatientPrescriptionsPage = lazy(() =>
  import("../features/patients/PatientPrescriptionsPage").then((module) => ({
    default: module.PatientPrescriptionsPage,
  })),
);
const ConsultationTranscriptionPage = lazy(() =>
  import("../features/transcription/ConsultationTranscriptionPage").then((module) => ({ default: module.ConsultationTranscriptionPage })),
);
const PublicPatientActionPage = lazy(() =>
  import("../features/public-patient-action/PublicPatientActionPage").then(
    (module) => ({ default: module.PublicPatientActionPage }),
  ),
);
const ClinicMembershipInvitationPage = lazy(() =>
  import(
    "../features/clinic-invitation/ClinicMembershipInvitationPage"
  ).then((module) => ({ default: module.ClinicMembershipInvitationPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

function AppRoutes() {
  const { session } = useAuth();
  const [location] = useLocation();
  const path = location.split("?")[0];
  const appStart = getAppStart(session);

  const publicActionMatch = path.match(/^\/acao-paciente\/([^/]+)$/i);
  if (publicActionMatch) {
    let reference: string;
    try {
      reference = decodeURIComponent(publicActionMatch[1]);
    } catch {
      reference = "";
    }
    return <PublicPatientActionPage reference={reference} />;
  }

  const clinicInvitationMatch = path.match(/^\/convite-medico\/([^/]+)$/i);
  if (clinicInvitationMatch) {
    let reference: string;
    try {
      reference = decodeURIComponent(clinicInvitationMatch[1]);
    } catch {
      reference = "";
    }
    return <ClinicMembershipInvitationPage reference={reference} />;
  }

  if (path === "/") {
    return <Redirect to={session ? appStart : "/entrar"} replace />;
  }

  if (path === "/entrar" || path === "/cadastro") {
    if (session) return <Redirect to={appStart} replace />;
    return path === "/entrar" ? <LoginPage /> : <RegisterPage />;
  }

  if (path.startsWith("/app")) {
    if (!session) return <Redirect to="/entrar" replace />;
    if (path === "/app") return <Redirect to={appStart} replace />;

    // Equipe saiu de Configuração e virou destino próprio; o link antigo continua funcionando.
    if (path === "/app/configuracoes/equipe") {
      return <Redirect to="/app/equipe" replace />;
    }

    // Convênios passou para dentro da configuração da clínica; o link antigo continua valendo.
    if (path === "/app/configuracoes/convenios") {
      return (
        <Redirect
          to={`/app/configuracoes/clinica/convenios${window.location.search}`}
          replace
        />
      );
    }

    // WhatsApp virou aba da configuração da clínica; o link antigo (inclusive o
    // que a API devolve em "Primeiros passos") continua valendo.
    if (path === "/app/configuracoes/whatsapp") {
      return (
        <Redirect
          to={`/app/configuracoes/clinica/whatsapp${window.location.search}`}
          replace
        />
      );
    }

    // "Primeiros passos" virou a entrada da configuração da clínica; o link antigo
    // continua valendo. O destino é decidido aqui porque dois <Redirect> em sequência
    // não funcionam: o do roteador só navega ao montar.
    if (path === "/app/onboarding") {
      const clinicSettings = "/app/configuracoes/clinica";
      return (
        <Redirect
          to={canAccessAppPath(session, clinicSettings) ? clinicSettings : appStart}
          replace
        />
      );
    }

    // Disponibilidade e Convênios de Meu perfil são do vínculo de médico; os demais
    // papéis ficam na aba Conta, que é o perfil inteiro deles.
    if (
      (path === profileAvailabilityPath || path === profilePlansPath) &&
      !actsAsDoctor(session)
    ) {
      return <Redirect to={profileSettingsPath} replace />;
    }

    if (!canAccessAppPath(session, path)) {
      return <Redirect to={appStart} replace />;
    }

    // A disponibilidade virou aba do perfil do médico. O link antigo, que "Primeiros
    // passos" ainda recebe da API, leva o médico à própria aba em Meu perfil e a
    // administração ao perfil de um médico em Equipe.
    if (path === "/app/configuracoes/agenda") {
      return actsAsDoctor(session) ? (
        <Redirect to={profileAvailabilityPath} replace />
      ) : (
        <AppShell>
          <DoctorAvailabilityRedirect />
        </AppShell>
      );
    }

    const adminRoutes: Record<string, React.ReactNode> = {
      "/app/equipe/novo": <TeamPage initialMode="create" initialRole="Doctor" />,
      "/app/configuracoes/clinica": <OnboardingPage />,
      "/app/configuracoes/clinica/dados": <ClinicSettingsPage />,
      "/app/configuracoes/clinica/convenios": <HealthcarePlansSettingsPage />,
      "/app/configuracoes/clinica/whatsapp": <WhatsAppSettingsPage />,
      "/app/configuracoes/clinica/receituario": <PrescriptionTemplatePage />,
    };
    const commonRoutes: Record<string, React.ReactNode> = {
      "/app/inicio": <DoctorHomePage />,
      "/app/agenda": <AgendaPage />,
      "/app/agenda/nova": <NewAppointmentPage />,
      "/app/pacientes": <PatientsPage />,
      "/app/pacientes/novo": <NewPatientPage />,
      "/app/equipe": <TeamPage />,
      [profileSettingsPath]: <ProfileSettingsPage />,
      [profileAvailabilityPath]: <ProfileAvailabilityPage />,
      [profilePlansPath]: <ProfilePlansPage />,
    };

    // Perfil de um integrante em Equipe, uma rota por aba. A TeamPage lê o caminho e
    // continua montada ao ir da lista ao perfil, com os avisos de salvar.
    if (parseMemberProfilePath(path)) {
      return (
        <AppShell>
          <TeamPage />
        </AppShell>
      );
    }

    const editPatientMatch = path.match(/^\/app\/pacientes\/([0-9a-f-]+)\/editar$/i);
    if (editPatientMatch) {
      return (
        <AppShell>
          <EditPatientPage patientId={editPatientMatch[1]} />
        </AppShell>
      );
    }

    const assessmentsMatch = path.match(
      /^\/app\/pacientes\/([0-9a-f-]+)\/avaliacoes$/i,
    );
    if (assessmentsMatch) {
      return (
        <AppShell>
          <PatientAssessmentsPage patientId={assessmentsMatch[1]} />
        </AppShell>
      );
    }

    const examsMatch = path.match(
      /^\/app\/pacientes\/([0-9a-f-]+)\/exames$/i,
    );
    if (examsMatch) {
      return (
        <AppShell>
          <PatientExamsPage patientId={examsMatch[1]} />
        </AppShell>
      );
    }

    const prescriptionsMatch = path.match(
      /^\/app\/pacientes\/([0-9a-f-]+)\/receitas$/i,
    );
    if (prescriptionsMatch) {
      return (
        <AppShell>
          <PatientPrescriptionsPage patientId={prescriptionsMatch[1]} />
        </AppShell>
      );
    }

    // O padrão só aceita hexadecimal, então /pacientes/novo não cai aqui.
    const patientDetailMatch = path.match(/^\/app\/pacientes\/([0-9a-f-]+)$/i);
    if (patientDetailMatch) {
      return (
        <AppShell>
          <PatientDetailPage patientId={patientDetailMatch[1]} />
        </AppShell>
      );
    }

    const consultationMatch = path.match(/^\/app\/consultas\/([0-9a-f-]+)$/i);
    if (consultationMatch) {
      return <AppShell><ConsultationTranscriptionPage appointmentId={consultationMatch[1]} /></AppShell>;
    }

    const page = commonRoutes[path] ?? adminRoutes[path];
    return page ? <AppShell>{page}</AppShell> : <NotFoundPage />;
  }

  return <NotFoundPage />;
}

export function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ExamRealtimeProvider>
            <UnsavedChangesProvider>
              <Suspense fallback={<LoadingBlock label="Abrindo o ClinicFlow…" />}>
                <AppRoutes />
              </Suspense>
            </UnsavedChangesProvider>
          </ExamRealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
