import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { ApiError } from "../../api/client";
import { PublicPatientActionPage } from "./PublicPatientActionPage";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiRequest,
}));

const reference = "opaque.reference-123";
const pendingView = {
  actionType: "AppointmentWithDataSharing",
  status: "Pending",
  termsVersion: "appointment-with-data-sharing-v1",
  snapshot: {
    action: "appointment_with_data_sharing",
    clinicName: "Clínica Horizonte",
    doctorName: "Dra. Helena Costa",
    scheduledStartUtc: "2026-08-27T12:00:00Z",
    scheduledEndUtc: "2026-08-27T12:30:00Z",
    dataSharing: "O médico terá acesso aos dados necessários ao atendimento.",
    patientDocument: "52998224725",
    patientPhone: "+5511999990000",
    internalId: "should-not-render",
  },
  requestedAtUtc: "2026-08-25T12:00:00Z",
  expiresAtUtc: "2099-08-27T12:00:00Z",
  challengeStatus: "Sent",
} as const;

function Harness({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(pendingView);
});

test("mostra somente o snapshot permitido, a consulta e a versão dos termos", async () => {
  render(
    <Harness>
      <PublicPatientActionPage reference={reference} />
    </Harness>,
  );

  expect(
    await screen.findByRole("heading", { name: "Confirme sua consulta" }),
  ).toBeVisible();
  expect(screen.getByText("Clínica Horizonte")).toBeVisible();
  expect(screen.getByText("Dra. Helena Costa")).toBeVisible();
  expect(screen.getByText(/27 de agosto de 2026/)).toBeVisible();
  expect(
    screen.getByText("O médico terá acesso aos dados necessários ao atendimento."),
  ).toBeVisible();
  expect(screen.getByText("appointment-with-data-sharing-v1")).toBeVisible();
  expect(screen.queryByText("52998224725")).not.toBeInTheDocument();
  expect(screen.queryByText("+5511999990000")).not.toBeInTheDocument();
  expect(screen.queryByText("should-not-render")).not.toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith(
    `/public/patient-actions/${encodeURIComponent(reference)}`,
  );
});

test("confirma pelo link e apresenta o resultado atômico inclusive no replay", async () => {
  const completedView = {
    ...pendingView,
    status: "Completed",
    challengeStatus: "Used",
  } as const;
  apiRequest
    .mockResolvedValueOnce(pendingView)
    .mockResolvedValueOnce({ status: "completed" })
    .mockResolvedValue(completedView);
  const user = userEvent.setup();
  render(
    <Harness>
      <PublicPatientActionPage reference={reference} />
    </Harness>,
  );

  await user.click(
    await screen.findByRole("button", { name: "Confirmar consulta e compartilhar dados" }),
  );

  expect(
    await screen.findByRole("status", {
      name: "Consulta confirmada e dados compartilhados",
    }),
  ).toBeVisible();
  expect(apiRequest).toHaveBeenCalledWith(
    `/public/patient-actions/${encodeURIComponent(reference)}/complete`,
    { method: "POST" },
  );
  expect(
    screen.queryByRole("button", { name: /Confirmar consulta/ }),
  ).not.toBeInTheDocument();
});

test("exige confirmação explícita antes de recusar e mostra o resultado", async () => {
  const declinedView = {
    ...pendingView,
    status: "Declined",
    challengeStatus: "Used",
  } as const;
  apiRequest
    .mockResolvedValueOnce(pendingView)
    .mockResolvedValueOnce({ status: "declined" })
    .mockResolvedValue(declinedView);
  const user = userEvent.setup();
  render(
    <Harness>
      <PublicPatientActionPage reference={reference} />
    </Harness>,
  );

  await user.click(await screen.findByRole("button", { name: "Recusar" }));
  const confirmation = screen.getByRole("group", { name: "Confirmar recusa" });
  expect(within(confirmation).getByText(/consulta será cancelada/i)).toBeVisible();
  await user.click(
    within(confirmation).getByRole("button", { name: "Confirmar recusa" }),
  );

  expect(
    await screen.findByRole("status", { name: "Solicitação recusada" }),
  ).toBeVisible();
  expect(apiRequest).toHaveBeenCalledWith(
    `/public/patient-actions/${encodeURIComponent(reference)}/decline`,
    { method: "POST" },
  );
});

test("bloqueia ações e explica link expirado", async () => {
  apiRequest.mockResolvedValue({
    ...pendingView,
    expiresAtUtc: "2020-01-01T00:00:00Z",
    challengeStatus: "Expired",
  });
  render(
    <Harness>
      <PublicPatientActionPage reference={reference} />
    </Harness>,
  );

  expect(
    await screen.findByRole("status", { name: "Link expirado" }),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: /Confirmar consulta/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
});

test("trata referência inválida sem revelar a causa", async () => {
  apiRequest.mockRejectedValue(new ApiError("raw backend detail", 404));
  render(
    <Harness>
      <PublicPatientActionPage reference={reference} />
    </Harness>,
  );

  expect(
    await screen.findByRole("alert", { name: "Link inválido ou indisponível" }),
  ).toBeVisible();
  expect(screen.queryByText("raw backend detail")).not.toBeInTheDocument();
});
