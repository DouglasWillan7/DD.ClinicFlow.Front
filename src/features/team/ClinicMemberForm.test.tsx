import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ClinicMember, DoctorSchedule } from "../../api/types";
import { ClinicMemberForm } from "./ClinicMemberForm";

const doctor: ClinicMember = {
  userClinicId: "membership-doctor",
  userId: "user-doctor",
  clinicId: "clinic-1",
  displayName: "Dra. Helena Martins",
  status: "Active",
  role: "Doctor",
  isAdmin: true,
  isOwner: false,
  email: "helena@centro.test",
  phone: "+5511999998888",
  emailConfirmedAtUtc: "2026-08-20T10:00:00Z",
  phoneConfirmedAtUtc: null,
  doctorProfile: {
    professionalAuthority: "CRM",
    professionalRegistrationNumber: "12345",
    professionalRegistrationRegion: "SP",
    professionalRegistrationCountryCode: "BR",
    specialty: "Gastroenterologia",
    practiceAreas: "Endoscopia",
    bio: "Atendimento clínico e cirúrgico.",
    defaultAppointmentDurationMinutes: 30,
  },
  defaultAppointmentDurationSource: "Configured",
  sessionVersion: 2,
  createdAtUtc: "2026-08-01T10:00:00Z",
  updatedAtUtc: "2026-08-20T10:00:00Z",
};

test("cria um vínculo com papel único, administração independente e telefone canônico", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="create"
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("radio", { name: /Enfermagem/ })).toBeEnabled();
  expect(screen.queryByRole("checkbox", { name: /Médico/ })).not.toBeInTheDocument();

  await user.type(screen.getByLabelText("Nome completo"), "Joana Ribeiro");
  await user.type(screen.getByLabelText("Documento"), "12345678901");
  await user.type(screen.getByLabelText("E-mail na clínica"), "joana@centro.test");
  await user.type(screen.getByLabelText("Telefone"), "11999998888");
  await user.click(screen.getByRole("radio", { name: /Enfermagem/ }));
  await user.click(screen.getByRole("checkbox", { name: /Administrador da clínica/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    documentCountryCode: "BR",
    documentType: "CPF",
    document: "12345678901",
    name: "Joana Ribeiro",
    email: "joana@centro.test",
    phone: "+5511999998888",
    role: "Nurse",
    isAdmin: true,
    doctorProfile: null,
  });
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("roles");
});

test("confirma antes de remover os dados médicos ao trocar o papel", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="edit"
      member={doctor}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByLabelText("Especialidade")).toHaveValue("Gastroenterologia");
  await user.click(screen.getByRole("radio", { name: /Secretaria/ }));

  const confirmation = screen.getByRole("alertdialog", {
    name: "Remover dados médicos?",
  });
  expect(within(confirmation).getByText(/serão removidos deste vínculo/i)).toBeVisible();
  expect(screen.getByLabelText("Especialidade")).toBeVisible();

  await user.click(within(confirmation).getByRole("button", { name: "Manter como médico" }));
  expect(screen.getByRole("radio", { name: /Médico/ })).toBeChecked();

  await user.click(screen.getByRole("radio", { name: /Enfermagem/ }));
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Alterar e remover",
    }),
  );
  expect(screen.queryByLabelText("Especialidade")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    role: "Nurse",
    doctorProfile: null,
  });
});

test("valida contato, duração médica e preserva a administração fora da hierarquia", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="create"
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.click(screen.getByRole("checkbox", { name: /Administrador da clínica/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));

  expect(await screen.findByText("Informe o nome completo.")).toBeVisible();
  expect(screen.getByText("Informe um CPF com 11 dígitos.")).toBeVisible();
  expect(screen.getByText("Informe um e-mail válido.")).toBeVisible();
  expect(screen.getByText("Informe o telefone com DDI e número.")).toBeVisible();
  expect(screen.getByText("Informe a duração padrão da consulta.")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: /Administrador da clínica/ })).toBeChecked();
  expect(onSubmit).not.toHaveBeenCalled();
});

const doctorSchedule: DoctorSchedule = {
  doctorUserId: "user-doctor",
  slotDurationMinutes: 30,
  blocks: [],
  intervals: [
    { id: "interval-1", dayOfWeek: "Monday", startLocal: "08:00:00", endLocal: "08:45:00" },
  ],
};

test("envia a semana só quando ela muda e barra período menor que a duração", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="edit"
      member={doctor}
      schedule={{ status: "ready", data: doctorSchedule }}
      timeZone="America/Sao_Paulo"
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("checkbox", { name: /Segunda-feira/ })).toBeChecked();
  expect(screen.getByLabelText("Duração padrão da consulta")).toHaveValue("30");

  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][1]).toBeUndefined();

  // 45 minutos de atendimento não comportam uma consulta de 60.
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "60");
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  expect(
    await screen.findByText("Em Segunda-feira, cada período deve ter ao menos 60 minutos."),
  ).toBeVisible();
  expect(onSubmit).toHaveBeenCalledOnce();

  await user.clear(screen.getByLabelText("Segunda-feira, período 1, fim"));
  await user.type(screen.getByLabelText("Segunda-feira, período 1, fim"), "12:00");
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][1]).toEqual({
    defaultAppointmentDurationMinutes: 60,
    intervals: [{ dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" }],
  });
});

test("falha ao carregar a agenda não impede salvar o vínculo nem apaga horários", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const retry = vi.fn();
  render(
    <ClinicMemberForm
      mode="edit"
      member={doctor}
      schedule={{ status: "error", retry }}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    /Não foi possível carregar os horários/,
  );
  expect(screen.queryByRole("checkbox", { name: /Segunda-feira/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][1]).toBeUndefined();
});

test("mantém selecionável uma duração gravada fora da lista padrão", () => {
  render(
    <ClinicMemberForm
      mode="edit"
      member={{
        ...doctor,
        doctorProfile: { ...doctor.doctorProfile!, defaultAppointmentDurationMinutes: 25 },
      }}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("Duração padrão da consulta")).toHaveValue("25");
});
