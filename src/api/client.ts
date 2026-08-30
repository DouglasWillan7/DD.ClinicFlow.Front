const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:5094").replace(
  /\/$/,
  "",
);

export interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  existingExamId?: string;
  currentVersion?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem?: ProblemDetails,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiUrl(path: string) {
  return `${apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function retryAfterSeconds(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  // FormData define o próprio Content-Type com o boundary — fixar aqui quebraria o multipart.
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(getApiUrl(path), { ...init, headers });

  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }

    const firstValidationError = problem?.errors
      ? Object.values(problem.errors).flat()[0]
      : undefined;
    throw new ApiError(
      firstValidationError ??
        problem?.detail ??
        problem?.title ??
        "Não foi possível concluir a operação.",
      response.status,
      problem,
      retryAfterSeconds(response),
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiBlobRequest(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Blob> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(getApiUrl(path), { ...init, headers });
  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }
    const firstValidationError = problem?.errors
      ? Object.values(problem.errors).flat()[0]
      : undefined;
    throw new ApiError(
      firstValidationError ?? problem?.detail ?? problem?.title ??
        "Não foi possível concluir a operação.",
      response.status,
      problem,
    );
  }
  return response.blob();
}
