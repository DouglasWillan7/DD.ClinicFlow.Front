import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ClinicMember } from "../../api/types";
import { ClinicMemberForm, type MemberPlansSource } from "./ClinicMemberForm";

const planCatalog = [
  { id: "plan-unimed", name: "Unimed" },
  { id: "plan-amil", name: "Amil" },
  { id: "plan-bradesco", name: "Bradesco Saúde" },
];

/** A clínica aceita Unimed e Amil; só Unimed é padrão. Bradesco fica fora do teto. */
function plansSource(): MemberPlansSource {
  return {
    status: "ready",
    catalog: planCatalog,
    clinic: { accepted: ["plan-unimed", "plan-amil"], defaults: ["plan-unimed"] },
  };
}

/** Preenche o cadastro de um médico até a duração; a semana e os convênios ficam com o teste. */
async function fillNewDoctor(user: ReturnType<typeof userEvent.setup>, duration = "30") {
  await user.type(screen.getByLabelText("Nome completo"), "Rui Antunes");
  await user.type(screen.getByLabelText("Documento"), "12345678901");
  await user.type(screen.getByLabelText("E-mail na clínica"), "rui@centro.test");
  await user.type(screen.getByLabelText("Telefone"), "11999998888");
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), duration);
}

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

test("no cadastro, envia a semana só quando ela muda e barra período menor que a duração", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="create"
      timeZone="America/Sao_Paulo"
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillNewDoctor(user, "60");
  expect(screen.getByRole("heading", { name: "Disponibilidade de atendimento" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][1]).toBeUndefined();

  // O período padrão de 08:00 a 12:00 comporta 60 minutos; 08:00 a 08:45 não.
  await user.click(screen.getByRole("checkbox", { name: /Segunda-feira/ }));
  await user.clear(screen.getByLabelText("Segunda-feira, período 1, fim"));
  await user.type(screen.getByLabelText("Segunda-feira, período 1, fim"), "08:45");
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  expect(
    await screen.findByText("Em Segunda-feira, cada período deve ter ao menos 60 minutos."),
  ).toBeVisible();
  expect(onSubmit).toHaveBeenCalledOnce();

  await user.clear(screen.getByLabelText("Segunda-feira, período 1, fim"));
  await user.type(screen.getByLabelText("Segunda-feira, período 1, fim"), "12:00");
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][1]).toEqual({
    defaultAppointmentDurationMinutes: 60,
    intervals: [{ dayOfWeek: "Monday", startLocal: "08:00", endLocal: "12:00" }],
  });
});

test("na edição do médico, semana, convênios e duração ficam nas abas do perfil", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="edit"
      member={doctor}
      plans={plansSource()}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("heading", { name: "Perfil médico nesta clínica" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Disponibilidade de atendimento" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Convênios" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Duração padrão da consulta")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  // Só o vínculo vai, com a duração que já estava gravada.
  expect(onSubmit.mock.calls[0]).toHaveLength(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    role: "Doctor",
    doctorProfile: { defaultAppointmentDurationMinutes: 30 },
  });
});

test("promover a médico pede a duração no perfil médico, sem a semana", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="edit"
      member={{
        ...doctor,
        role: "Nurse",
        doctorProfile: null,
        defaultAppointmentDurationSource: null,
      }}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.queryByLabelText("Duração padrão da consulta")).not.toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  expect(screen.getByLabelText("Duração padrão da consulta")).toHaveAccessibleDescription(
    "Os horários de atendimento ficam na aba Disponibilidade, depois de salvar.",
  );
  expect(screen.queryByRole("checkbox", { name: /Segunda-feira/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  expect(await screen.findByText("Informe a duração padrão da consulta.")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();

  await user.selectOptions(screen.getByLabelText("Duração padrão da consulta"), "40");
  await user.click(screen.getByRole("button", { name: "Salvar vínculo" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0]).toHaveLength(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    role: "Doctor",
    doctorProfile: { defaultAppointmentDurationMinutes: 40 },
  });
});

test("remover os dados médicos e voltar a médico pede a duração de novo", async () => {
  const user = userEvent.setup();
  render(
    <ClinicMemberForm
      mode="edit"
      member={doctor}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("radio", { name: /Secretaria/ }));
  await user.click(screen.getByRole("button", { name: "Alterar e remover" }));
  await user.click(screen.getByRole("radio", { name: /Médico/ }));

  // A duração gravada foi removida com os dados médicos: sem o campo, não haveria como salvar.
  expect(screen.getByLabelText("Duração padrão da consulta")).toHaveValue("");
});

test("no cadastro, o médico parte do padrão da clínica e só envia os convênios quando eles mudam", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <ClinicMemberForm
      mode="create"
      plans={plansSource()}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillNewDoctor(user);

  expect(screen.getByRole("heading", { name: "Convênios" })).toBeVisible();
  expect(screen.getByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
  const group = screen.getByRole("group", {
    name: "Convênios atendidos por este médico",
  });
  // No padrão a lista vem da clínica e fica travada; o que a clínica não aceita nem aparece.
  expect(group).toBeDisabled();
  expect(within(group).getByRole("checkbox", { name: "Unimed" })).toBeChecked();
  expect(within(group).getByRole("checkbox", { name: "Amil" })).not.toBeChecked();
  expect(within(group).queryByRole("checkbox", { name: "Bradesco Saúde" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][2]).toBeUndefined();

  await user.click(screen.getByRole("radio", { name: /Personalizado/ }));
  await user.click(screen.getByRole("checkbox", { name: "Amil" }));
  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][2]).toEqual({
    mode: "Custom",
    planIds: ["plan-unimed", "plan-amil"],
  });
});

test("convênios só aparecem para o papel de médico e o cadastro avisa quando passam a valer", async () => {
  const user = userEvent.setup();
  render(
    <ClinicMemberForm
      mode="create"
      plans={plansSource()}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.queryByRole("heading", { name: "Convênios" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: /Médico/ }));
  expect(screen.getByRole("heading", { name: "Convênios" })).toBeVisible();
  expect(screen.getByRole("radio", { name: /Padrão da clínica/ })).toBeChecked();
  expect(
    screen.getByText("Os convênios passam a ser oferecidos na agenda quando o convite for aceito."),
  ).toBeVisible();
});

test("falha ao carregar os convênios não impede cadastrar o médico", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const retry = vi.fn();
  render(
    <ClinicMemberForm
      mode="create"
      plans={{ status: "error", retry }}
      pending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillNewDoctor(user);

  expect(screen.getByRole("alert")).toHaveTextContent(
    /Não foi possível carregar os convênios/,
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("button", { name: "Adicionar integrante" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0][2]).toBeUndefined();
});
