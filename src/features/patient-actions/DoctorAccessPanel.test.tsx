import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorAccessPanel } from "./DoctorAccessPanel";

const requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DoctorAccessPanel patientId="30000000-0000-4000-8000-000000000001" />
    </QueryClientProvider>,
  );
}

test("lista acesso ativo, pendente e revogado sem mostrar prontuário", async () => {
  requestMock.mockResolvedValue([
    {
      doctorUserId: "d1",
      doctorName: "Dra. Ana",
      hasActiveAccess: true,
      latestAction: null,
    },
    {
      doctorUserId: "d2",
      doctorName: "Dr. Bruno",
      hasActiveAccess: false,
      latestAction: {
        actionId: "a2",
        actionType: "DoctorAccess",
        status: "Pending",
        requestedAtUtc: "2026-08-24T12:00:00Z",
        expiresAtUtc: "2026-08-25T12:00:00Z",
        completedAtUtc: null,
        completionMethod: null,
        latestChallenge: {
          challengeId: "c2",
          type: "Token",
          channel: "WhatsApp",
          status: "Sent",
          attemptNumber: 1,
          expiresAtUtc: "2026-08-25T12:00:00Z",
          retryAtUtc: null,
        },
      },
    },
    {
      doctorUserId: "d3",
      doctorName: "Dra. Carla",
      hasActiveAccess: false,
      latestAction: {
        actionId: "a3",
        actionType: "DoctorAccess",
        status: "Completed",
        requestedAtUtc: "2026-08-20T12:00:00Z",
        expiresAtUtc: "2026-08-21T12:00:00Z",
        completedAtUtc: "2026-08-20T12:05:00Z",
        completionMethod: "StaffToken",
        latestChallenge: null,
      },
    },
  ]);

  renderPanel();

  expect(await screen.findByText("Dra. Ana")).toBeVisible();
  expect(screen.getByText("Acesso ativo")).toBeVisible();
  expect(screen.getByText("Aguardando paciente")).toBeVisible();
  expect(screen.getByText("Acesso revogado")).toBeVisible();
  expect(screen.queryByText(/exame|diagnóstico|prontuário/i)).not.toBeInTheDocument();
});

test("solicita novamente sem criar comandos paralelos na interface", async () => {
  const patientId = "30000000-0000-4000-8000-000000000001";
  const doctorUserId = "d3";
  let calls = 0;
  requestMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === `/patient-actions/doctor-access?patientId=${patientId}`) {
      calls += 1;
      return Promise.resolve([
        {
          doctorUserId,
          doctorName: "Dra. Carla",
          hasActiveAccess: false,
          latestAction: calls === 1
            ? { actionId: "old", actionType: "DoctorAccess", status: "Completed" }
            : { actionId: "new", actionType: "DoctorAccess", status: "Pending" },
        },
      ]);
    }
    if (path === "/patient-actions/doctor-access" && init?.method === "POST") {
      return Promise.resolve({ actionId: "new", actionType: "DoctorAccess", status: "Pending" });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const user = userEvent.setup();
  renderPanel();

  await user.click(
    await screen.findByRole("button", { name: "Solicitar novamente para Dra. Carla" }),
  );

  expect(requestMock).toHaveBeenCalledWith("/patient-actions/doctor-access", {
    method: "POST",
    body: JSON.stringify({ patientId, doctorUserId }),
  });
  await waitFor(() => expect(calls).toBe(2));
  expect(
    screen.queryByRole("button", { name: "Solicitar novamente para Dra. Carla" }),
  ).not.toBeInTheDocument();
});
