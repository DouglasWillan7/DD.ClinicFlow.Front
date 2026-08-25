import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Redirect, useLocation } from "wouter";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { LoadingBlock } from "../components/Feedback";
import { canAccessAppPath, getAppStart } from "../auth/permissions";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { ExamRealtimeProvider } from "../features/patients/exams/ExamRealtimeProvider";

const LoginPage = lazy(() =>
  import("../auth/LoginPage").then((module) => ({
    default: module.LoginPage,
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
  import("../features/clinic/ClinicSettingsPage").then((module) => ({
    default: module.ClinicSettingsPage,
  })),
);
const WhatsAppSettingsPage = lazy(() =>
  import("../features/clinic/WhatsAppSettingsPage").then((module) => ({
    default: module.WhatsAppSettingsPage,
  })),
);
const OnboardingPage = lazy(() =>
  import("../features/onboarding/OnboardingPage").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const ProfileSettingsPage = lazy(() =>
  import("../features/clinic/ProfileSettingsPage").then((module) => ({
    default: module.ProfileSettingsPage,
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
const ConsultationTranscriptionPage = lazy(() =>
  import("../features/transcription/ConsultationTranscriptionPage").then((module) => ({ default: module.ConsultationTranscriptionPage })),
);
const PublicPatientActionPage = lazy(() =>
  import("../features/public-patient-action/PublicPatientActionPage").then(
    (module) => ({ default: module.PublicPatientActionPage }),
  ),
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

  if (path === "/") {
    return <Redirect to={session ? appStart : "/entrar"} replace />;
  }

  if (path === "/entrar") {
    if (session) return <Redirect to={appStart} replace />;
    return <LoginPage />;
  }

  if (path.startsWith("/app")) {
    if (!session) return <Redirect to="/entrar" replace />;
    if (path === "/app") return <Redirect to={appStart} replace />;

    // Equipe saiu de Configuração e virou destino próprio; o link antigo continua funcionando.
    if (path === "/app/configuracoes/equipe") {
      return <Redirect to="/app/equipe" replace />;
    }

    if (!canAccessAppPath(session, path)) {
      return <Redirect to={appStart} replace />;
    }

    const adminRoutes: Record<string, React.ReactNode> = {
      "/app/onboarding": <OnboardingPage />,
      "/app/equipe/novo": <TeamPage initialMode="create" initialRole="Doctor" />,
      "/app/configuracoes/clinica": <ClinicSettingsPage />,
      "/app/configuracoes/whatsapp": <WhatsAppSettingsPage />,
    };
    const commonRoutes: Record<string, React.ReactNode> = {
      "/app/inicio": <DoctorHomePage />,
      "/app/agenda": <AgendaPage />,
      "/app/agenda/nova": <NewAppointmentPage />,
      "/app/pacientes": <PatientsPage />,
      "/app/pacientes/novo": <NewPatientPage />,
      "/app/equipe": <TeamPage />,
      "/app/configuracoes/perfil": <ProfileSettingsPage />,
    };

    // Só hexadecimal, então /equipe/novo nunca cai aqui.
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
            <Suspense fallback={<LoadingBlock label="Abrindo o ClinicFlow…" />}>
              <AppRoutes />
            </Suspense>
          </ExamRealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
