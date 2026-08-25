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
import { apiBlobRequest, apiRequest } from "../api/client";
import type {
  AccountRecoveryIdentity,
  AccountRecoveryOptions,
  AuthResponse,
  AuthV2Authenticated,
  AuthV2ClinicOption,
  AuthV2LoginOutcome,
  AuthV2LoginRequest,
  RegisterClinicOwnerRequest,
} from "../api/types";
import { getRoles } from "./roles";
import {
  clearScopedSessionStorage,
  getAuthScope,
} from "./sessionScope";

const SESSION_KEY = "clinicflow.session";

interface AuthContextValue {
  session: AuthResponse | null;
  registerClinicOwner(request: RegisterClinicOwnerRequest): Promise<AuthResponse>;
  loginWithDocument(request: AuthV2LoginRequest): Promise<AuthV2LoginOutcome>;
  selectClinic(
    selectionToken: string,
    userClinicId: string,
    rememberConnection?: boolean,
  ): Promise<AuthResponse>;
  getRecoveryOptions(
    identity: AccountRecoveryIdentity,
  ): Promise<AccountRecoveryOptions>;
  requestRecoveryChallenge(selection: string): Promise<void>;
  switchClinic(userClinicId: string): Promise<AuthResponse>;
  refreshSession(): Promise<AuthResponse>;
  logout(): void;
  updateSessionName(name: string): void;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  requestBlob(path: string, init?: RequestInit): Promise<Blob>;
}

interface RefreshOperation {
  generation: number;
  scope: string;
  promise: Promise<AuthResponse>;
}

interface SessionOperation {
  generation: number;
  scope: string;
}

class StaleSessionOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleSessionOperationError";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getPersistentSession() {
  return typeof localStorage?.getItem === "function"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}

function clearPersistentSession() {
  if (typeof localStorage?.removeItem === "function") {
    localStorage.removeItem(SESSION_KEY);
  }
}

function savePersistentSession(value: string) {
  if (typeof localStorage?.setItem === "function") {
    localStorage.setItem(SESSION_KEY, value);
    return true;
  }
  return false;
}

function normalizeSession(value: AuthResponse): AuthResponse {
  const roles = getRoles(value);
  if (roles.length === 0) {
    throw new Error("A sessão recebida não informa as permissões do usuário.");
  }

  return {
    ...value,
    roles,
  };
}

function mapAuthenticatedSession(
  value: AuthV2Authenticated,
  knownClinics?: readonly AuthV2ClinicOption[],
): AuthResponse {
  const { clinicContext } = value;
  const currentOption: AuthV2ClinicOption = {
    userClinicId: clinicContext.userClinicId,
    clinicId: clinicContext.clinicId,
    clinicName: clinicContext.clinicName,
    role: clinicContext.role,
    isAdmin: clinicContext.isAdmin,
  };
  const availableClinics = knownClinics?.length
    ? knownClinics.map((option) =>
        option.userClinicId === currentOption.userClinicId
          ? currentOption
          : { ...option },
      )
    : [currentOption];
  if (!availableClinics.some((option) => option.userClinicId === currentOption.userClinicId)) {
    availableClinics.push(currentOption);
  }
  return normalizeSession({
    userId: value.user.id,
    name: value.user.name,
    email: clinicContext.email,
    phone: clinicContext.phone,
    clinicId: clinicContext.clinicId,
    clinicName: clinicContext.clinicName,
    userClinicId: clinicContext.userClinicId,
    clinicRole: clinicContext.role,
    isAdmin: clinicContext.isAdmin,
    availableClinics,
    roles: clinicContext.isAdmin
      ? [clinicContext.role, "Admin"]
      : [clinicContext.role],
    tokens: {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
      accessTokenExpiresAtUtc: value.accessTokenExpiresAtUtc,
    },
  });
}

function readSession(): AuthResponse | null {
  try {
    const serialized = sessionStorage.getItem(SESSION_KEY) ?? getPersistentSession();
    if (!serialized) return null;
    return normalizeSession(JSON.parse(serialized) as AuthResponse);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    clearPersistentSession();
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSessionState] = useState<AuthResponse | null>(readSession);
  const sessionRef = useRef(session);
  const operationGenerationRef = useRef(0);
  const refreshOperationRef = useRef<RefreshOperation | null>(null);
  const mountedRef = useRef(true);
  const persistentSessionRef = useRef(getPersistentSession() !== null);
  const pendingClinicOptionsRef = useRef<readonly AuthV2ClinicOption[] | undefined>(
    undefined,
  );

  const saveSession = useCallback((value: AuthResponse | null) => {
    const next = value ? normalizeSession(value) : null;
    const current = sessionRef.current;
    const currentScope = current ? getAuthScope(current) : null;
    const nextScope = next ? getAuthScope(next) : null;
    if (currentScope !== nextScope) {
      queryClient.clear();
      clearScopedSessionStorage();
    }
    sessionRef.current = next;
    setSessionState(next);
    sessionStorage.removeItem(SESSION_KEY);
    clearPersistentSession();
    if (next) {
      const serialized = JSON.stringify(next);
      if (
        !persistentSessionRef.current ||
        !savePersistentSession(serialized)
      ) {
        sessionStorage.setItem(SESSION_KEY, serialized);
      }
    }
    return next;
  }, [queryClient]);

  const beginExplicitTransition = useCallback(() => {
    operationGenerationRef.current += 1;
    refreshOperationRef.current = null;
    return operationGenerationRef.current;
  }, []);

  const commitExplicitTransition = useCallback(
    (value: AuthResponse, generation: number) => {
      if (
        !mountedRef.current ||
        operationGenerationRef.current !== generation
      ) {
        throw new StaleSessionOperationError(
          "A operação de sessão foi substituída.",
        );
      }
      return saveSession(value)!;
    },
    [saveSession],
  );

  const clearSession = useCallback(() => {
    beginExplicitTransition();
    saveSession(null);
  }, [beginExplicitTransition, saveSession]);

  const logout = useCallback(() => {
    const current = sessionRef.current;
    clearSession();
    if (current?.userClinicId) {
      void apiRequest<void>("/auth/v2/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
      }).catch(() => undefined);
    }
  }, [clearSession]);

  const assertCurrentSession = useCallback((operation: SessionOperation) => {
    const current = sessionRef.current;
    if (
      !mountedRef.current ||
      operationGenerationRef.current !== operation.generation ||
      !current ||
      getAuthScope(current) !== operation.scope
    ) {
      throw new StaleSessionOperationError(
        "A operação pertence a uma sessão que não está mais ativa.",
      );
    }
    return current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationGenerationRef.current += 1;
      refreshOperationRef.current = null;
    };
  }, []);

  const loginWithDocument = useCallback(
    async (request: AuthV2LoginRequest) => {
      const generation = beginExplicitTransition();
      persistentSessionRef.current = request.rememberConnection;
      const response = await apiRequest<AuthV2LoginOutcome>("/auth/v2/login", {
        method: "POST",
        body: JSON.stringify(request),
      });
      if (response.kind === "authenticated") {
        pendingClinicOptionsRef.current = undefined;
        commitExplicitTransition(mapAuthenticatedSession(response), generation);
      } else {
        pendingClinicOptionsRef.current = response.clinics;
      }
      return response;
    },
    [beginExplicitTransition, commitExplicitTransition],
  );

  const registerClinicOwner = useCallback(
    async (request: RegisterClinicOwnerRequest) => {
      const generation = beginExplicitTransition();
      persistentSessionRef.current = true;
      const response = await apiRequest<AuthV2Authenticated>(
        "/auth/v2/register",
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      );
      pendingClinicOptionsRef.current = undefined;
      return commitExplicitTransition(
        mapAuthenticatedSession(response),
        generation,
      );
    },
    [beginExplicitTransition, commitExplicitTransition],
  );

  const selectClinic = useCallback(
    async (
      selectionToken: string,
      userClinicId: string,
      rememberConnection = false,
    ) => {
      const generation = beginExplicitTransition();
      persistentSessionRef.current = rememberConnection;
      const response = await apiRequest<AuthV2Authenticated>(
        "/auth/v2/select-clinic",
        {
          method: "POST",
          body: JSON.stringify({ selectionToken, userClinicId }),
        },
      );
      const next = mapAuthenticatedSession(
        response,
        pendingClinicOptionsRef.current,
      );
      pendingClinicOptionsRef.current = undefined;
      return commitExplicitTransition(next, generation);
    },
    [beginExplicitTransition, commitExplicitTransition],
  );

  const getRecoveryOptions = useCallback(
    (identity: AccountRecoveryIdentity) =>
      apiRequest<AccountRecoveryOptions>("/auth/v2/recovery/options", {
        method: "POST",
        body: JSON.stringify(identity),
      }),
    [],
  );

  const requestRecoveryChallenge = useCallback(
    async (selection: string) => {
      await apiRequest<{ status: "accepted" }>(
        "/auth/v2/recovery/challenges",
        {
          method: "POST",
          body: JSON.stringify({ selection }),
        },
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) throw new Error("Sessão não encontrada.");
    const operation: SessionOperation = {
      generation: operationGenerationRef.current,
      scope: getAuthScope(current),
    };
    const existing = refreshOperationRef.current;
    if (
      existing &&
      existing.generation === operation.generation &&
      existing.scope === operation.scope
    ) {
      return existing.promise;
    }

    const promise = apiRequest<AuthV2Authenticated>(
      "/auth/v2/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
      },
    )
        .then(
          (response) => {
            assertCurrentSession(operation);
            const next = mapAuthenticatedSession(
              response,
              current.availableClinics,
            );
            if (
              next.clinicId !== current.clinicId ||
              next.userId !== current.userId ||
              next.userClinicId !== current.userClinicId
            ) {
              throw new Error(
                "A atualização de sessão retornou outra identidade.",
              );
            }
            return saveSession(next)!;
          },
          (error: unknown) => {
            assertCurrentSession(operation);
            throw error;
          },
        )
        .finally(() => {
          if (refreshOperationRef.current?.promise === promise) {
            refreshOperationRef.current = null;
          }
        });
    refreshOperationRef.current = {
      generation: operation.generation,
      scope: operation.scope,
      promise,
    };
    return promise;
  }, [assertCurrentSession, saveSession]);

  const switchClinic = useCallback(
    async (userClinicId: string) => {
      const current = sessionRef.current;
      if (!current?.userClinicId) {
        throw new Error("A sessão atual não permite trocar de clínica.");
      }
      if (userClinicId === current.userClinicId) return current;

      const generation = beginExplicitTransition();
      const operation: SessionOperation = {
        generation,
        scope: getAuthScope(current),
      };

      try {
        const response = await apiRequest<AuthV2Authenticated>(
          "/auth/v2/switch-clinic",
          {
            method: "POST",
            body: JSON.stringify({
              refreshToken: current.tokens.refreshToken,
              userClinicId,
            }),
          },
        );
        assertCurrentSession(operation);
        return commitExplicitTransition(
          mapAuthenticatedSession(response, current.availableClinics),
          generation,
        );
      } catch (switchError) {
        assertCurrentSession(operation);
        const isRejectedContext =
          switchError instanceof Error &&
          "status" in switchError &&
          switchError.status === 401;
        if (!isRejectedContext) throw switchError;

        try {
          const response = await apiRequest<AuthV2Authenticated>(
            "/auth/v2/refresh",
            {
              method: "POST",
              body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
            },
          );
          assertCurrentSession(operation);
          commitExplicitTransition(
            mapAuthenticatedSession(response, current.availableClinics),
            generation,
          );
        } catch (refreshError) {
          assertCurrentSession(operation);
          if (
            refreshError instanceof Error &&
            "status" in refreshError &&
            refreshError.status === 401
          ) {
            clearSession();
          }
        }
        throw switchError;
      }
    },
    [
      assertCurrentSession,
      beginExplicitTransition,
      clearSession,
      commitExplicitTransition,
    ],
  );

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const origin = sessionRef.current;
      if (!origin) throw new Error("Sua sessão expirou. Entre novamente.");
      const operation: SessionOperation = {
        generation: operationGenerationRef.current,
        scope: getAuthScope(origin),
      };

      const refreshForOperation = async () => {
        assertCurrentSession(operation);
        try {
          await refresh();
        } catch (refreshError) {
          assertCurrentSession(operation);
          if (!(refreshError instanceof StaleSessionOperationError)) {
            clearSession();
          }
          throw refreshError;
        }
        return assertCurrentSession(operation);
      };

      let current = assertCurrentSession(operation);

      const expiresSoon =
        new Date(current.tokens.accessTokenExpiresAtUtc).getTime() <
        Date.now() + 30_000;
      if (expiresSoon) current = await refreshForOperation();

      let firstError: unknown;
      try {
        assertCurrentSession(operation);
        const response = await apiRequest<T>(
          path,
          init,
          current.tokens.accessToken,
        );
        assertCurrentSession(operation);
        return response;
      } catch (error) {
        assertCurrentSession(operation);
        firstError = error;
      }

      if (
        !(firstError instanceof Error) ||
        !("status" in firstError) ||
        firstError.status !== 401
      ) {
        throw firstError;
      }

      current = await refreshForOperation();
      assertCurrentSession(operation);
      try {
        const response = await apiRequest<T>(
          path,
          init,
          current.tokens.accessToken,
        );
        assertCurrentSession(operation);
        return response;
      } catch (retryError) {
        assertCurrentSession(operation);
        if (
          retryError instanceof Error &&
          "status" in retryError &&
          retryError.status === 401
        ) {
          clearSession();
        }
        throw retryError;
      }
    },
    [assertCurrentSession, clearSession, refresh],
  );

  const requestBlob = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const origin = sessionRef.current;
      if (!origin) throw new Error("Sua sessão expirou. Entre novamente.");
      const operation: SessionOperation = {
        generation: operationGenerationRef.current,
        scope: getAuthScope(origin),
      };

      const refreshForOperation = async () => {
        assertCurrentSession(operation);
        try {
          await refresh();
        } catch (refreshError) {
          assertCurrentSession(operation);
          if (!(refreshError instanceof StaleSessionOperationError)) clearSession();
          throw refreshError;
        }
        return assertCurrentSession(operation);
      };

      let current = assertCurrentSession(operation);
      if (
        new Date(current.tokens.accessTokenExpiresAtUtc).getTime() <
        Date.now() + 30_000
      ) {
        current = await refreshForOperation();
      }

      try {
        const response = await apiBlobRequest(path, init, current.tokens.accessToken);
        assertCurrentSession(operation);
        return response;
      } catch (error) {
        assertCurrentSession(operation);
        if (!(error instanceof Error) || !("status" in error) || error.status !== 401) {
          throw error;
        }
      }

      current = await refreshForOperation();
      try {
        const response = await apiBlobRequest(path, init, current.tokens.accessToken);
        assertCurrentSession(operation);
        return response;
      } catch (retryError) {
        assertCurrentSession(operation);
        if (retryError instanceof Error && "status" in retryError && retryError.status === 401) {
          clearSession();
        }
        throw retryError;
      }
    },
    [assertCurrentSession, clearSession, refresh],
  );

  const value = useMemo(
    () => ({
      session,
      registerClinicOwner,
      loginWithDocument,
      selectClinic,
      getRecoveryOptions,
      requestRecoveryChallenge,
      switchClinic,
      refreshSession: refresh,
      logout,
      updateSessionName: (name: string) => {
        const current = sessionRef.current;
        if (current) {
          beginExplicitTransition();
          saveSession({ ...current, name });
        }
      },
      request,
      requestBlob,
    }),
    [
      beginExplicitTransition,
      loginWithDocument,
      registerClinicOwner,
      selectClinic,
      getRecoveryOptions,
      requestRecoveryChallenge,
      switchClinic,
      refresh,
      request,
      requestBlob,
      saveSession,
      session,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// O hook compartilha o mesmo módulo para manter uma única identidade de contexto.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
