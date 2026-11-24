import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi, type Mock } from "vitest";
import { ApiError } from "../../../api/client";
import type {
  PatientExamDetail,
  PatientExamRevision,
  PatientExamSummary,
} from "../../../api/types";
import { ExamUploadComposer } from "./ExamUploadComposer";

const requestExam: PatientExamSummary = {
  id: "request-1",
  patientId: "patient-1",
  name: "Hemograma",
  category: "Laboratório",
  scheduledOn: "2026-08-15",
  status: "Solicitado",
  version: 1,
  hasDocument: false,
  averageConfidence: null,
  createdAtUtc: "2026-08-01T10:00:00Z",
  updatedAtUtc: "2026-08-01T10:00:00Z",
};

const acceptedExam = { id: "exam-new", status: "Pendente" } as PatientExamDetail;
const pdf = () => new File(["%PDF-1.7\ncontent"], "laudo.pdf", { type: "application/pdf" });

function tracked(status: PatientExamDetail["status"], overrides: Partial<PatientExamDetail> = {}) {
  return { id: "exam-new", status, draftRevision: null, error: null, ...overrides } as PatientExamDetail;
}

const revision = (overrides: Partial<PatientExamRevision> = {}) => ({
  structuredResults: [],
  narrativeSections: [],
  structuredFindings: [],
  ...overrides,
}) as PatientExamRevision;

const baseProps: React.ComponentProps<typeof ExamUploadComposer> = {
  canAttachDocument: true,
  open: true,
  patientName: "Douglas Willan",
  pendingRequests: [requestExam],
  trackedExam: null,
  onUpload: vi.fn(),
  onTrackChange: vi.fn(),
  onOpenExam: vi.fn(),
  onClose: vi.fn(),
};

/** Leva o modal até o estado de processamento com o PDF já aceito pelo backend. */
async function sendPdf(
  user: ReturnType<typeof userEvent.setup>,
  props: Partial<React.ComponentProps<typeof ExamUploadComposer>> = {},
) {
  const onUpload = (props.onUpload ?? vi.fn().mockResolvedValue(acceptedExam)) as Mock;
  const view = render(<ExamUploadComposer {...baseProps} {...props} onUpload={onUpload} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());
  await user.click(screen.getByRole("button", { name: "Enviar laudo" }));
  return { ...view, onUpload };
}

test("só existe no DOM quando aberto e com capacidade de anexar", () => {
  const { rerender } = render(<ExamUploadComposer {...baseProps} open={false} />);
  expect(screen.queryByRole("dialog", { name: "Anexar laudo" })).not.toBeInTheDocument();
  rerender(<ExamUploadComposer {...baseProps} canAttachDocument={false} />);
  expect(screen.queryByRole("dialog", { name: "Anexar laudo" })).not.toBeInTheDocument();
  rerender(<ExamUploadComposer {...baseProps} />);
  expect(screen.getByRole("dialog", { name: "Anexar laudo" })).toBeInTheDocument();
});

test("cabeçalho nomeia o paciente e avisa que os dados ficam pendentes", () => {
  render(<ExamUploadComposer {...baseProps} />);
  expect(screen.getByText(/Douglas Willan · os dados extraídos ficam pendentes até a sua revisão/))
    .toBeInTheDocument();
});

test("dropzone anuncia o limite real aceito pelo backend", () => {
  render(<ExamUploadComposer {...baseProps} />);
  expect(screen.getByText("PDF de até 10 MB · 1 laudo por envio")).toBeInTheDocument();
});

test("picker valida magic PDF e anuncia erro", async () => {
  const user = userEvent.setup();
  render(<ExamUploadComposer {...baseProps} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), new File(["texto"], "falso.pdf"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Envie um arquivo PDF válido.");
});

test("drop e picker compartilham o mesmo arquivo/status e permitem remover", async () => {
  const user = userEvent.setup();
  render(<ExamUploadComposer {...baseProps} />);
  fireEvent.drop(screen.getByTestId("exam-drop-zone"), { dataTransfer: { files: [pdf()] } });
  expect(await screen.findByRole("status")).toHaveTextContent("laudo.pdf selecionado");
  await user.click(screen.getByRole("button", { name: "Remover laudo.pdf" }));
  expect(screen.getByRole("status")).toHaveTextContent("Nenhum arquivo selecionado");
});

test("sem arquivo o envio cobra a seleção", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn();
  render(<ExamUploadComposer {...baseProps} onUpload={onUpload} />);
  await user.click(screen.getByRole("button", { name: "Enviar laudo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Selecione o PDF do laudo.");
  expect(onUpload).not.toHaveBeenCalled();
});

test("laudo avulso é o padrão e o nome vazio herda o nome do arquivo", async () => {
  const user = userEvent.setup();
  const { onUpload } = await sendPdf(user);
  await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
  const body = onUpload.mock.calls[0][0] as FormData;
  expect([body.get("name"), body.get("category")]).toEqual(["laudo", "Laboratorio"]);
  expect(body.get("requestExamId")).toBeNull();
});

test("nome informado e tipo escolhido vão no lugar do padrão", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockResolvedValue(acceptedExam);
  render(<ExamUploadComposer {...baseProps} onUpload={onUpload} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());
  await user.type(screen.getByLabelText("Nome do exame (opcional)"), "Ultrassom abdominal");
  await user.selectOptions(screen.getByLabelText("Tipo de exame"), "Imagem");
  await user.click(screen.getByRole("button", { name: "Enviar laudo" }));
  await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
  const body = onUpload.mock.calls[0][0] as FormData;
  expect([body.get("name"), body.get("category")]).toEqual(["Ultrassom abdominal", "Imagem"]);
});

test("vincular a uma solicitação troca os metadados pelo id da solicitação", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockResolvedValue(acceptedExam);
  render(<ExamUploadComposer {...baseProps} onUpload={onUpload} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());
  await user.selectOptions(screen.getByLabelText("Vincular laudo"), "request-1");
  expect(screen.queryByLabelText("Tipo de exame")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Enviar laudo" }));
  await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
  const body = onUpload.mock.calls[0][0] as FormData;
  expect(body.get("requestExamId")).toBe("request-1");
  expect(body.get("name")).toBeNull();
});

test("sem solicitações abertas o vínculo some da tela", () => {
  render(<ExamUploadComposer {...baseProps} pendingRequests={[]} />);
  expect(screen.queryByLabelText("Vincular laudo")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Tipo de exame")).toBeInTheDocument();
});

test("aceite passa a acompanhar o exame e mostra as fases reais", async () => {
  const user = userEvent.setup();
  const onTrackChange = vi.fn();
  const { rerender } = await sendPdf(user, { onTrackChange });

  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));
  const dialog = screen.getByRole("dialog", { name: "Anexar laudo" });
  expect(dialog).toHaveTextContent("Enviando arquivo");
  expect(dialog).toHaveTextContent("Na fila de processamento");
  expect(screen.queryByRole("button", { name: "Enviar laudo" })).not.toBeInTheDocument();
  expect(screen.getByText("Você pode fechar — o processamento continua e avisamos quando terminar."))
    .toBeInTheDocument();

  rerender(<ExamUploadComposer {...baseProps} onTrackChange={onTrackChange} trackedExam={tracked("Processando")} />);
  const extracting = screen.getByText(/Extraindo analitos e conferindo as referências/);
  expect(extracting.closest("li")).toHaveTextContent("em andamento");
});

test("progresso não inventa percentual", async () => {
  const user = userEvent.setup();
  await sendPdf(user);
  const progress = await screen.findByRole("progressbar", { name: "Extração do laudo em andamento" });
  expect(progress).not.toHaveAttribute("aria-valuenow");
});

test("conclusão resume as contagens da revisão em rascunho", async () => {
  const user = userEvent.setup();
  const onOpenExam = vi.fn();
  const onTrackChange = vi.fn();
  const { rerender } = await sendPdf(user, { onOpenExam, onTrackChange });
  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));

  rerender(<ExamUploadComposer
    {...baseProps}
    onOpenExam={onOpenExam}
    onTrackChange={onTrackChange}
    trackedExam={tracked("Em revisão", {
      draftRevision: revision({
        structuredResults: [
          { referenceState: "elevado", confidence: 0.5 },
          { referenceState: "baixo", confidence: 1 },
          { referenceState: "normal", confidence: 1 },
        ],
        narrativeSections: [{ confidence: 1 }],
      } as Partial<PatientExamRevision>),
    })}
  />);

  expect(screen.getByText("Extração concluída — pendente de revisão")).toBeInTheDocument();
  const counts = screen.getByRole("dialog").querySelectorAll("dd");
  expect([...counts].map((item) => item.textContent)).toEqual(["3", "2", "1", "1"]);

  await user.click(screen.getByRole("button", { name: "Revisar dados extraídos" }));
  expect(onTrackChange).toHaveBeenLastCalledWith(null);
  expect(onOpenExam).toHaveBeenCalledWith("exam-new");
});

test("anexar outro volta ao formulário e para de acompanhar", async () => {
  const user = userEvent.setup();
  const onTrackChange = vi.fn();
  const { rerender } = await sendPdf(user, { onTrackChange });
  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));

  rerender(<ExamUploadComposer
    {...baseProps}
    onTrackChange={onTrackChange}
    trackedExam={tracked("Em revisão", { draftRevision: revision() })}
  />);
  await user.click(screen.getByRole("button", { name: "Anexar outro" }));

  expect(onTrackChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("button", { name: "Enviar laudo" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Nenhum arquivo selecionado");
});

test("falha de extração oferece o caminho da recuperação", async () => {
  const user = userEvent.setup();
  const onOpenExam = vi.fn();
  const onTrackChange = vi.fn();
  const { rerender } = await sendPdf(user, { onOpenExam, onTrackChange });
  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));

  rerender(<ExamUploadComposer
    {...baseProps}
    onOpenExam={onOpenExam}
    onTrackChange={onTrackChange}
    trackedExam={tracked("Falhou", { error: "O laudo está protegido por senha." })}
  />);
  expect(await screen.findByRole("alert")).toHaveTextContent("O laudo está protegido por senha.");
  await user.click(screen.getByRole("button", { name: "Ver a falha" }));
  expect(onOpenExam).toHaveBeenCalledWith("exam-new");
});

test("fechar durante o processamento não cancela o job", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onTrackChange = vi.fn();
  await sendPdf(user, { onClose, onTrackChange });
  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));

  await user.click(screen.getByRole("button", { name: "Continuar em segundo plano" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onTrackChange).toHaveBeenLastCalledWith(null);
});

test("duplicidade mostra ação para abrir o exame existente", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockRejectedValue(new ApiError("Duplicado", 409, { existingExamId: "existing-7" }));
  const onOpenExam = vi.fn();
  await sendPdf(user, { onUpload, onOpenExam });
  expect(await screen.findByRole("alert")).toHaveTextContent("Este PDF já foi anexado");
  await user.click(screen.getByRole("button", { name: "Abrir exame existente" }));
  expect(onOpenExam).toHaveBeenCalledWith("existing-7");
});

test("erro mantém arquivo selecionado e anuncia recuperação", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockRejectedValue(new ApiError("Serviço indisponível", 503));
  await sendPdf(user, { onUpload });
  expect(await screen.findByRole("alert")).toHaveTextContent("Serviço indisponível");
  expect(screen.getByRole("status")).toHaveTextContent("laudo.pdf selecionado");
  expect(screen.getByRole("button", { name: "Substituir laudo.pdf" })).toBeInTheDocument();
});

test("fechar durante o envio aborta a requisição", async () => {
  const user = userEvent.setup();
  let capturedSignal: AbortSignal | null = null;
  const onUpload = vi.fn((_body: FormData, signal: AbortSignal) => {
    capturedSignal = signal;
    return new Promise<PatientExamDetail>(() => {});
  });
  render(<ExamUploadComposer {...baseProps} onUpload={onUpload} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());
  await user.click(screen.getByRole("button", { name: "Enviar laudo" }));
  await waitFor(() => expect(capturedSignal).not.toBeNull());

  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(capturedSignal!.aborted).toBe(true);
});

test("por padrão o envio pede a análise por IA", async () => {
  const user = userEvent.setup();
  const { onUpload } = await sendPdf(user);

  await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
  expect((onUpload.mock.calls[0][0] as FormData).get("analyze")).toBe("true");
});

test("desmarcar a análise só guarda o documento e confirma que ele foi salvo", async () => {
  const user = userEvent.setup();
  const onOpenExam = vi.fn();
  const onUpload = vi.fn().mockResolvedValue({
    id: "exam-new",
    status: "Sem análise",
    analysisHold: "NaoSolicitada",
  } as PatientExamDetail);
  render(<ExamUploadComposer {...baseProps} onUpload={onUpload} onOpenExam={onOpenExam} />);
  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());

  await user.click(screen.getByRole("checkbox", { name: "Analisar com IA" }));
  await user.click(screen.getByRole("button", { name: "Guardar documento" }));

  await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
  expect((onUpload.mock.calls[0][0] as FormData).get("analyze")).toBe("false");
  // Sem fila nem extração: o estado final aparece direto, sem a barra de processamento.
  expect(await screen.findByRole("status")).toHaveTextContent("Documento salvo");
  expect(screen.getByRole("status")).toHaveTextContent("Guardado sem análise por IA.");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Abrir exame" }));
  expect(onOpenExam).toHaveBeenCalledWith("exam-new");
});

test("com a IA indisponível a opção vem desmarcada, explica o motivo e o documento é guardado", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockResolvedValue({
    id: "exam-new",
    status: "Sem análise",
    analysisHold: "Indisponivel",
  } as PatientExamDetail);
  render(<ExamUploadComposer
    {...baseProps}
    onUpload={onUpload}
    analysisAvailability={{ available: false, reason: "SemCreditos" }}
  />);

  const option = screen.getByRole("checkbox", { name: "Analisar com IA" });
  expect(option).toBeDisabled();
  expect(option).not.toBeChecked();
  expect(option).toHaveAccessibleDescription(
    "A análise por IA está sem créditos disponíveis no momento. O documento será guardado e a análise pode ser pedida depois.",
  );

  await user.upload(screen.getByLabelText("Selecionar arquivo PDF"), pdf());
  await user.click(screen.getByRole("button", { name: "Guardar documento" }));

  await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
  expect((onUpload.mock.calls[0][0] as FormData).get("analyze")).toBe("false");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "A análise por IA está sem créditos disponíveis no momento. O PDF está guardado no histórico",
  );
});

test("falha da análise não se confunde com falha no envio", async () => {
  const user = userEvent.setup();
  const onTrackChange = vi.fn();
  const { rerender } = await sendPdf(user, { onTrackChange });
  await waitFor(() => expect(onTrackChange).toHaveBeenCalledWith("exam-new"));

  rerender(<ExamUploadComposer
    {...baseProps}
    onTrackChange={onTrackChange}
    trackedExam={tracked("Falhou", { error: "Não foi possível processar o laudo." })}
  />);

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Documento salvo, mas a análise por IA falhou");
  expect(alert).toHaveTextContent("O PDF continua disponível no exame.");
});

test("falha no envio fica no formulário e não fala de análise", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockRejectedValue(new ApiError("O PDF deve ter no máximo 10 MB.", 400));
  await sendPdf(user, { onUpload });

  expect(await screen.findByRole("alert")).toHaveTextContent("O PDF deve ter no máximo 10 MB.");
  expect(screen.getByRole("button", { name: "Enviar laudo" })).toBeInTheDocument();
  expect(screen.queryByText(/Documento salvo/)).not.toBeInTheDocument();
});
