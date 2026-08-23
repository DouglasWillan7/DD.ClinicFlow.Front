/* eslint-disable react-refresh/only-export-components -- provider and its scoped hooks form one public boundary */
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ExamStatus } from "../../../api/types";
import { useAuth } from "../../../auth/AuthProvider";
import { getAuthScope } from "../../../auth/sessionScope";
import { Button } from "../../../components/Button";
import { examKeys } from "./examQueries";
import styles from "./ExamRealtimeProvider.module.css";

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:5094").replace(/\/$/, "");

export type ExamRealtimeConnectionState = "connecting" | "connected" | "disconnected";

export interface ExamRealtimeConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  on(event: string, handler: (payload: unknown) => void): void;
  onreconnecting(handler: () => void): void;
  onreconnected(handler: () => void): void;
  onclose(handler: () => void): void;
}

export interface ExamRealtimeConnectionOptions {
  url: string;
  accessTokenFactory(): string;
}

export type ExamRealtimeConnectionFactory = (
  options: ExamRealtimeConnectionOptions,
) => ExamRealtimeConnection;

interface VisibleExam {
  id: string;
  name: string;
  status: ExamStatus;
}

interface VisiblePatientContext {
  patientId: string;
  patientName: string;
  exams: VisibleExam[];
  onSelectExam(examId: string): void;
}

interface ExamProcessingEvent {
  examId: string;
  patientId: string;
  status: string;
  version: number;
  updatedAtUtc: string;
}

interface ExamToast {
  examId: string;
  patientName: string;
  examName: string;
  status: "EmRevisao" | "Falhou";
  onSelectExam(examId: string): void;
  scope: string;
}

interface ExamRealtimeContextValue {
  connectionState: ExamRealtimeConnectionState;
  scope: string | null;
  registerVisiblePatient(value: VisiblePatientContext): () => void;
}

const ExamRealtimeContext = createContext<ExamRealtimeContextValue | null>(null);

const defaultConnectionFactory: ExamRealtimeConnectionFactory = ({ url, accessTokenFactory }) =>
  new HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.None)
    .build();

function parseProcessingEvent(payload: unknown): ExamProcessingEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (
    typeof value.examId !== "string"
    || typeof value.patientId !== "string"
    || typeof value.status !== "string"
    || typeof value.version !== "number"
    || typeof value.updatedAtUtc !== "string"
  ) return null;
  return {
    examId: value.examId,
    patientId: value.patientId,
    status: value.status,
    version: value.version,
    updatedAtUtc: value.updatedAtUtc,
  };
}

export function ExamRealtimeProvider({
  children,
  connectionFactory = defaultConnectionFactory,
}: PropsWithChildren<{ connectionFactory?: ExamRealtimeConnectionFactory }>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tokenRef = useRef(session?.tokens.accessToken ?? "");
  const visibleRef = useRef<VisiblePatientContext | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    scope: string | null;
    state: ExamRealtimeConnectionState;
  }>({ scope: null, state: "disconnected" });
  const [scopedToast, setToast] = useState<ExamToast | null>(null);
  const scope = session ? getAuthScope(session) : null;
  const connectionState = connectionStatus.scope === scope
    ? connectionStatus.state
    : scope
      ? "connecting"
      : "disconnected";
  const toast = scopedToast?.scope === scope ? scopedToast : null;

  useEffect(() => {
    tokenRef.current = session?.tokens.accessToken ?? "";
  }, [session?.tokens.accessToken]);

  const registerVisiblePatient = useCallback((value: VisiblePatientContext) => {
    visibleRef.current = value;
    return () => {
      if (visibleRef.current === value) visibleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!scope) return;

    let active = true;
    const updateConnectionState = (state: ExamRealtimeConnectionState) => {
      if (active) setConnectionStatus({ scope, state });
    };
    const connection = connectionFactory({
      url: `${apiUrl}/hubs/agenda`,
      accessTokenFactory: () => tokenRef.current,
    });

    connection.on("examUploadUpdated", (payload) => {
      if (!active) return;
      const event = parseProcessingEvent(payload);
      const visible = visibleRef.current;
      if (!event || !visible || event.patientId !== visible.patientId) return;

      void queryClient.invalidateQueries({ queryKey: examKeys.patient(event.patientId) });
      void queryClient.invalidateQueries({ queryKey: examKeys.detail(event.examId) });

      if (event.status !== "EmRevisao" && event.status !== "Falhou") return;
      const exam = visible.exams.find((item) => item.id === event.examId);
      if (!exam) return;
      setToast({
        examId: event.examId,
        patientName: visible.patientName,
        examName: exam.name,
        status: event.status,
        onSelectExam: visible.onSelectExam,
        scope,
      });
    });
    connection.onreconnecting(() => updateConnectionState("disconnected"));
    connection.onreconnected(() => updateConnectionState("connected"));
    connection.onclose(() => updateConnectionState("disconnected"));

    void connection.start().then(
      () => updateConnectionState("connected"),
      () => updateConnectionState("disconnected"),
    );

    return () => {
      active = false;
      void connection.stop();
    };
  }, [connectionFactory, queryClient, scope]);

  const context = useMemo<ExamRealtimeContextValue>(() => ({
    connectionState,
    scope,
    registerVisiblePatient,
  }), [connectionState, registerVisiblePatient, scope]);

  return (
    <ExamRealtimeContext.Provider value={context}>
      {children}
      {toast ? (
        <aside className={styles.toast} role="status" aria-label="Atualização de exame" aria-live="polite">
          <div>
            <span>{toast.patientName}</span>
            <strong>{toast.examName}</strong>
            <p>{toast.status === "EmRevisao" ? "Pronto para revisão" : "A extração falhou"}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => {
            toast.onSelectExam(toast.examId);
            setToast(null);
          }}>
            {toast.status === "EmRevisao" ? "Revisar agora" : "Ver falha"}
          </Button>
        </aside>
      ) : null}
    </ExamRealtimeContext.Provider>
  );
}

export function useExamRealtime() {
  const context = useContext(ExamRealtimeContext);
  if (!context) throw new Error("useExamRealtime deve ser usado dentro de ExamRealtimeProvider.");
  return context;
}

export function useExamRealtimeView({
  patientId,
  patientName,
  exams,
  onPoll,
  onSelectExam,
}: VisiblePatientContext & { onPoll(): void }) {
  const realtime = useExamRealtime();
  const hasActiveExam = exams.some((exam) => exam.status === "Pendente" || exam.status === "Processando");

  useEffect(
    () => realtime.registerVisiblePatient({ patientId, patientName, exams, onSelectExam }),
    [exams, onSelectExam, patientId, patientName, realtime, realtime.scope],
  );

  useEffect(() => {
    if (realtime.connectionState !== "disconnected" || !hasActiveExam) return;
    const interval = window.setInterval(onPoll, 5_000);
    return () => window.clearInterval(interval);
  }, [hasActiveExam, onPoll, realtime.connectionState, realtime.scope]);

  return realtime.connectionState;
}
