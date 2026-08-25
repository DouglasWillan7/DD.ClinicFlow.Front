import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../api/client";
import type { PatientActionStatusView } from "../../api/types";
import { PatientActionTokenPanel } from "./PatientActionTokenPanel";

const requestMock = vi.fn();

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ request: requestMock }),
}));

const pending: PatientActionStatusView = {
  actionId: "10000000-0000-4000-8000-000000000001",
  actionType: "AppointmentWithDataSharing",
  status: "Pending",
  requestedAtUtc: "2026-08-24T12:00:00Z",
  expiresAtUtc: "2026-08-25T12:00:00Z",
  completedAtUtc: null,
  completionMethod: null,
  latestChallenge: {
    challengeId: "20000000-0000-4000-8000-000000000001",
    type: "Token",
    channel: "WhatsApp",
    status: "Sent",
    attemptNumber: 1,
    expiresAtUtc: "2026-08-25T12:00:00Z",
    retryAtUtc: null,
  },
};

test("valida e conclui o token sem expor informação clínica", async () => {
  requestMock.mockResolvedValue({ status: "completed" });
  const updated = vi.fn();
  const user = userEvent.setup();
  render(<PatientActionTokenPanel action={pending} onUpdated={updated} />);

  const input = screen.getByRole("textbox", { name: "Código de confirmação" });
  await user.type(input, "abc12");
  expect(input).toHaveValue("12");
  expect(screen.getByRole("button", { name: "Confirmar código" })).toBeDisabled();
  await user.type(input, "345678");
  await user.click(screen.getByRole("button", { name: "Confirmar código" }));

  expect(requestMock).toHaveBeenCalledWith(
    `/patient-actions/challenges/${pending.latestChallenge!.challengeId}/complete-token`,
    { method: "POST", body: JSON.stringify({ token: "12345678" }) },
  );
  await waitFor(() => expect(updated).toHaveBeenCalled());
  expect(screen.getByRole("status")).toHaveTextContent("Ação confirmada");
});

test("mantém a ação pendente e explica o cooldown de reenvio", async () => {
  requestMock.mockRejectedValue(
    new ApiError("A emissão do desafio está temporariamente limitada.", 429),
  );
  const user = userEvent.setup();
  render(<PatientActionTokenPanel action={pending} onUpdated={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Reenviar código" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Aguarde antes de reenviar o código",
  );
});

test.each([
  ["Completed", "Ação concluída"],
  ["Declined", "Paciente recusou o compartilhamento"],
  ["Expired", "Solicitação expirada"],
  ["Cancelled", "Solicitação cancelada"],
] as const)("apresenta o estado terminal %s", (status, copy) => {
  render(
    <PatientActionTokenPanel
      action={{ ...pending, status }}
      onUpdated={vi.fn()}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(copy);
  expect(
    screen.queryByRole("textbox", { name: "Código de confirmação" }),
  ).not.toBeInTheDocument();
});

test("troca o link por um token entregue pelo WhatsApp", async () => {
  requestMock.mockResolvedValue({
    ...pending.latestChallenge,
    challengeId: "20000000-0000-4000-8000-000000000002",
    type: "Token",
  });
  const updated = vi.fn();
  const user = userEvent.setup();
  render(
    <PatientActionTokenPanel
      action={{
        ...pending,
        latestChallenge: { ...pending.latestChallenge!, type: "Link" },
      }}
      onUpdated={updated}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Enviar código pelo WhatsApp" }),
  );

  expect(requestMock).toHaveBeenCalledWith(
    `/patient-actions/${pending.actionId}/challenges`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "Token",
        channel: "WhatsApp",
        destinationMasked: null,
        expiresAtUtc: pending.expiresAtUtc,
      }),
    },
  );
  await waitFor(() => expect(updated).toHaveBeenCalled());
});
