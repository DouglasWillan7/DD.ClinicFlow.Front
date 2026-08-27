import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../api/client";
import type {
  AuthResponse,
  DoctorAccessStatusView,
  PatientActionChallengeView,
} from "../../api/types";
import { ClinicalAccessEmailAction } from "./ClinicalAccessEmailAction";

const requestMock = vi.fn();
const patientId = "30000000-0000-4000-8000-000000000001";
const doctorUserId = "40000000-0000-4000-8000-000000000001";

let session = {
  userId: doctorUserId,
  clinicRole: "Doctor",
} as AuthResponse;

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock, session }),
}));

function pendingAccess(
  challenge: PatientActionChallengeView | null,
): DoctorAccessStatusView[] {
  return [{
    doctorUserId,
    doctorName: "Dra. Ana",
    hasActiveAccess: false,
    latestAction: {
      actionId: "50000000-0000-4000-8000-000000000001",
      actionType: "AppointmentWithDataSharing",
      status: "Pending",
      requestedAtUtc: "2026-08-27T12:00:00Z",
      expiresAtUtc: "2026-08-28T12:00:00Z",
      completedAtUtc: null,
      completionMethod: null,
      latestChallenge: challenge,
    },
  }];
}

function renderAction() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ClinicalAccessEmailAction patientId={patientId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestMock.mockReset();
  session = { userId: doctorUserId, clinicRole: "Doctor" } as AuthResponse;
});

test("usa o médico autenticado no primeiro envio e mostra somente o destino mascarado", async () => {
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith("/patient-actions/doctor-access?")) {
      return Promise.resolve([{
        doctorUserId,
        doctorName: "Dra. Ana",
        hasActiveAccess: false,
        latestAction: null,
      }]);
    }
    if (path === "/patient-actions/doctor-access" && init?.method === "POST") {
      return Promise.resolve(pendingAccess({
        challengeId: "60000000-0000-4000-8000-000000000001",
        type: "Link",
        channel: "Email",
        destinationMasked: "p************@example.test",
        status: "Issued",
        attemptNumber: 1,
        expiresAtUtc: "2026-08-28T12:00:00Z",
        retryAtUtc: null,
      })[0].latestAction);
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const user = userEvent.setup();
  renderAction();

  await user.click(await screen.findByRole("button", {
    name: "Enviar solicitação por e-mail",
  }));

  expect(requestMock).toHaveBeenCalledWith("/patient-actions/doctor-access", {
    method: "POST",
    body: JSON.stringify({ patientId, doctorUserId }),
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "p************@example.test",
  );
  expect(screen.queryByText("patient-token@example.test")).not.toBeInTheDocument();
});

test("reenvia o desafio de e-mail mais recente", async () => {
  const challenge = {
    challengeId: "60000000-0000-4000-8000-000000000001",
    type: "Link" as const,
    channel: "Email" as const,
    destinationMasked: "p************@example.test",
    status: "Sent" as const,
    attemptNumber: 1,
    expiresAtUtc: "2026-08-28T12:00:00Z",
    retryAtUtc: null,
  };
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/patient-actions/doctor-access?")) {
      return Promise.resolve(pendingAccess(challenge));
    }
    if (path.endsWith("/reissue")) {
      return Promise.resolve({ ...challenge, attemptNumber: 2 });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const user = userEvent.setup();
  renderAction();

  await user.click(await screen.findByRole("button", { name: "Reenviar e-mail" }));

  expect(requestMock).toHaveBeenCalledWith(
    `/patient-actions/challenges/${challenge.challengeId}/reissue`,
    { method: "POST" },
  );
});

test("substitui um desafio legado por link de e-mail", async () => {
  const legacy = {
    challengeId: "60000000-0000-4000-8000-000000000001",
    type: "Token" as const,
    channel: "WhatsApp" as const,
    destinationMasked: "+351******678",
    status: "Sent" as const,
    attemptNumber: 1,
    expiresAtUtc: "2026-08-28T12:00:00Z",
    retryAtUtc: null,
  };
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/patient-actions/doctor-access?")) {
      return Promise.resolve(pendingAccess(legacy));
    }
    if (path.endsWith("/challenges")) {
      return Promise.resolve({
        ...legacy,
        type: "Link",
        channel: "Email",
        destinationMasked: "p************@example.test",
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const user = userEvent.setup();
  renderAction();

  await user.click(await screen.findByRole("button", { name: "Enviar por e-mail" }));

  expect(requestMock).toHaveBeenCalledWith(
    "/patient-actions/50000000-0000-4000-8000-000000000001/challenges",
    {
      method: "POST",
      body: JSON.stringify({
        type: "Link",
        channel: "Email",
        destinationMasked: null,
        expiresAtUtc: "2026-08-28T12:00:00Z",
      }),
    },
  );
});

test("explica o cooldown sem indicar que outro e-mail foi enviado", async () => {
  const access = pendingAccess({
    challengeId: "60000000-0000-4000-8000-000000000001",
    type: "Link",
    channel: "Email",
    destinationMasked: "p************@example.test",
    status: "Sent",
    attemptNumber: 1,
    expiresAtUtc: "2026-08-28T12:00:00Z",
    retryAtUtc: null,
  });
  requestMock.mockImplementation((path: string) =>
    path.startsWith("/patient-actions/doctor-access?")
      ? Promise.resolve(access)
      : Promise.reject(new ApiError("rate_limited", 429)),
  );
  const user = userEvent.setup();
  renderAction();

  await user.click(await screen.findByRole("button", { name: "Reenviar e-mail" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nenhum novo e-mail foi enviado",
  );
});

test("orienta atualizar o cadastro quando o paciente não possui e-mail", async () => {
  requestMock.mockImplementation((path: string) =>
    path.startsWith("/patient-actions/doctor-access?")
      ? Promise.resolve([{
          doctorUserId,
          doctorName: "Dra. Ana",
          hasActiveAccess: false,
          latestAction: null,
        }])
      : Promise.reject(new ApiError("e-mail inválido", 400)),
  );
  const user = userEvent.setup();
  renderAction();

  await user.click(await screen.findByRole("button", {
    name: "Enviar solicitação por e-mail",
  }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Atualize o e-mail do paciente no cadastro",
  );
});

test("não renderiza nem consulta em nome de um usuário que não é médico", () => {
  session = { userId: "secretary", clinicRole: "Secretary" } as AuthResponse;

  const { container } = renderAction();

  expect(container).toBeEmptyDOMElement();
  expect(requestMock).not.toHaveBeenCalled();
});
