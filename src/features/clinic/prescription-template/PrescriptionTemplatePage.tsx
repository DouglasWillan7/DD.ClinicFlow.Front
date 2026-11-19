import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ApiError } from "../../../api/client";
import type {
  Clinic,
  PrescriptionTemplate,
  PrescriptionTemplateImageUpload,
  SavePrescriptionTemplateRequest,
} from "../../../api/types";
import { useUnsavedChangesGuard } from "../../../app/unsavedChanges";
import { useAuth } from "../../../auth/AuthProvider";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import {
  EmptyState,
  ErrorBlock,
  InlineError,
  LoadingBlock,
  SuccessNote,
} from "../../../components/Feedback";
import { ClinicSettingsHeader } from "../ClinicSettingsHeader";
import { UnsavedChangesBar } from "../UnsavedChangesBar";
import { ElementInspector } from "./ElementInspector";
import { TemplateBlockList } from "./TemplateBlockList";
import { TemplateCanvas } from "./TemplateCanvas";
import {
  readImageAspectRatio,
  TemplateImageStore,
  templateImagePath,
} from "./templateImages";
import {
  addedMessage,
  blankLayout,
  clinicFieldValues,
  createElementId,
  createImageElement,
  createLineElement,
  createTextElement,
  layoutFromTemplate,
  sameLayout,
  sampleLayout,
  TEMPLATE_LIMITS,
  type TemplateElement,
  type TemplateLayout,
  validateImageFile,
  validateLayout,
  type TemplateFieldValues,
} from "./templateModel";
import {
  canAddElement,
  type EditorAction,
  type EditorState,
  initialEditorState,
  selectedElement,
  templateReducer,
} from "./templateReducer";
import { TemplateToolbar } from "./TemplateToolbar";
import styles from "./PrescriptionTemplatePage.module.css";

const templatePath = "/clinics/prescription-template";
const templateKey = ["clinic", "prescription-template"] as const;
const limitMessage = `O receituário aceita até ${TEMPLATE_LIMITS.elements} blocos. Remova um para adicionar outro.`;

/** Ações que só mudam o que está selecionado ou medido, não o desenho. */
const viewActions = new Set<EditorAction["type"]>(["select", "setActiveZone", "measureTexts"]);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Aba "Receituário" da configuração da clínica: editor do cabeçalho e do rodapé que
 * saem em todas as receitas. Exclusiva da administração (`ManageClinicSettings`).
 */
export function PrescriptionTemplatePage() {
  const { request, session } = useAuth();
  // Recarregar depois de um conflito remonta o editor sobre a versão nova.
  const [reloads, setReloads] = useState(0);
  // Nome, endereço e telefone reais da clínica preenchem os campos na folha; os campos do
  // médico seguem com um exemplo, porque mudam conforme quem emite a receita.
  const clinic = useQuery({
    queryKey: ["clinic", "current"],
    queryFn: () => request<Clinic>("/clinics/current"),
  });
  // Sem os dados da clínica (ainda carregando, ou a consulta falhou) a folha usa os exemplos.
  const fieldValues = useMemo(
    () => (typeof clinic.data?.name === "string" ? clinicFieldValues(clinic.data) : undefined),
    [clinic.data],
  );
  const query = useQuery({
    queryKey: templateKey,
    queryFn: async () => {
      try {
        return await request<PrescriptionTemplate>(templatePath);
      } catch (error) {
        // 404: a clínica usa o cabeçalho padrão do sistema.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

  return (
    <>
      <ClinicSettingsHeader />
      <div className={styles.content}>
        {query.isLoading ? (
          <LoadingBlock label="Carregando o receituário…" />
        ) : query.isError ? (
          <ErrorBlock
            message="Não foi possível carregar o receituário da clínica."
            retry={() => void query.refetch()}
          />
        ) : (
          <PrescriptionTemplateEditor
            key={`${session?.userClinicId ?? ""}:${reloads}`}
            saved={query.data ?? null}
            fieldValues={fieldValues}
            onReload={async () => {
              await query.refetch();
              setReloads((current) => current + 1);
            }}
          />
        )}
      </div>
    </>
  );
}

function PrescriptionTemplateEditor({
  saved,
  fieldValues,
  onReload,
}: {
  saved: PrescriptionTemplate | null;
  fieldValues?: TemplateFieldValues;
  onReload(): Promise<void>;
}) {
  const { request, requestBlob } = useAuth();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(templateReducer, saved, (initial) =>
    initialEditorState(initial ? layoutFromTemplate(initial) : null),
  );
  const [images] = useState(
    () => new TemplateImageStore((imageId) => requestBlob(templateImagePath(imageId))),
  );
  const savedLayout = useMemo(() => (saved ? layoutFromTemplate(saved) : null), [saved]);
  const dirty = !sameLayout(state.layout, savedLayout);
  useUnsavedChangesGuard(dirty);

  const sheetRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageTargetRef = useRef<string | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  // O envio de imagem termina depois de outros cliques: lê o rascunho mais recente.
  const stateRef = useRef<EditorState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const [status, setStatus] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    images.retain();
    return () => images.release();
  }, [images]);

  const save = useMutation({
    mutationFn: (layout: TemplateLayout) => {
      const body: SavePrescriptionTemplateRequest = {
        ...layout,
        expectedVersion: saved?.version ?? null,
      };
      return request<PrescriptionTemplate>(templatePath, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (template) => {
      queryClient.setQueryData(templateKey, template);
      dispatch({ type: "saved", layout: layoutFromTemplate(template) });
      setSavedNotice(true);
      setStatus("Receituário salvo.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
    },
  });

  const restore = useMutation({
    mutationFn: async () => {
      try {
        await request<void>(templatePath, { method: "DELETE" });
      } catch (error) {
        // Já estava no padrão (outra sessão restaurou antes): o resultado é o mesmo.
        if (error instanceof ApiError && error.status === 404) return;
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(templateKey, null);
      flushSync(() => {
        dispatch({ type: "load", layout: null });
        setConfirmRestore(false);
        setSavedNotice(false);
      });
      // O botão que abriu a confirmação sumiu com o editor: o foco vai para o próximo passo.
      startButtonRef.current?.focus();
      setStatus("O receituário voltou ao cabeçalho padrão do sistema.");
    },
  });

  /** Toda mudança do desenho passa por aqui: limpa o resultado do último salvar. */
  function edit(action: EditorAction) {
    if (!viewActions.has(action.type)) {
      if (save.status !== "idle") save.reset();
      setSaveProblem(null);
      setSavedNotice(false);
    }
    dispatch(action);
  }

  const measure = useCallback(
    (heights: Record<string, number>) => dispatch({ type: "measureTexts", heights }),
    [],
  );

  function focusElement(id: string) {
    sheetRef.current
      ?.querySelector<HTMLElement>(`[data-element-id="${id}"]`)
      ?.focus();
  }

  function focusSheet() {
    sheetRef.current?.focus({ preventScroll: true });
  }

  function addElement(element: TemplateElement, snapshot: EditorState = state) {
    if (!canAddElement(snapshot)) {
      setActionError(limitMessage);
      return;
    }
    setActionError(null);
    flushSync(() => edit({ type: "add", element }));
    // O bloco novo recebe o foco: as setas já o movem.
    focusElement(element.id);
    setStatus(addedMessage(element.kind, snapshot.activeZone));
  }

  function removeElement(id: string) {
    edit({ type: "remove", id });
    setStatus("Bloco removido.");
    focusSheet();
  }

  function duplicateElement(id: string) {
    if (!canAddElement(state)) {
      setActionError(limitMessage);
      return;
    }
    setActionError(null);
    const newId = createElementId();
    flushSync(() => edit({ type: "duplicate", id, newId }));
    focusElement(newId);
    setStatus("Bloco duplicado.");
  }

  /** Enter num bloco da folha: seleciona e leva o foco ao primeiro campo do painel. */
  function editElement(id: string) {
    flushSync(() => dispatch({ type: "select", id }));
    inspectorRef.current
      ?.querySelector<HTMLElement>("textarea, input, select, button")
      ?.focus();
  }

  function start(layout: TemplateLayout, message: string) {
    setActionError(null);
    flushSync(() => edit({ type: "start", layout }));
    focusSheet();
    setStatus(message);
  }

  function pickImage(replaceId: string | null) {
    if (!replaceId && !canAddElement(state)) {
      setActionError(limitMessage);
      return;
    }
    imageTargetRef.current = replaceId;
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  /** A imagem vai para a API na hora e o desenho guarda só o id devolvido. */
  async function acceptImage(file: File) {
    const problem = validateImageFile(file);
    if (problem) {
      setActionError(problem);
      return;
    }
    const target = imageTargetRef.current;
    setActionError(null);
    setUploading(true);
    setStatus("Enviando a imagem…");
    try {
      const ratio = await readImageAspectRatio(file).catch(() => null);
      if (ratio === null) {
        setActionError("O arquivo não é uma imagem válida.");
        setStatus("");
        return;
      }
      const body = new FormData();
      body.append("file", file);
      const uploaded = await request<PrescriptionTemplateImageUpload>(`${templatePath}/images`, {
        method: "POST",
        body,
      });
      images.put(uploaded.id, file);
      if (target) {
        edit({ type: "replaceImage", id: target, imageId: uploaded.id, aspectRatio: ratio });
        setStatus("Imagem trocada.");
      } else {
        addElement(createImageElement(createElementId(), uploaded.id, ratio), stateRef.current);
      }
    } catch (error) {
      setStatus("");
      setActionError(errorMessage(error, "Não foi possível enviar a imagem. Tente novamente."));
    } finally {
      setUploading(false);
    }
  }

  // A aba nasce no clique (senão o bloqueador de pop-up a barra) e recebe o PDF depois.
  async function openPreview() {
    const layout = state.layout;
    if (!layout) return;
    const problem = validateLayout(layout);
    if (problem) {
      setActionError(problem);
      return;
    }
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setActionError("O navegador bloqueou a nova aba. Permita pop-ups para abrir a prévia.");
      return;
    }
    tab.opener = null;
    setPreviewing(true);
    try {
      const blob = await requestBlob(`${templatePath}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      tab.close();
      setActionError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : "Não foi possível gerar a prévia agora. Tente novamente.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  function submit() {
    const layout = state.layout;
    if (!layout) return;
    const problem = validateLayout(layout);
    setSaveProblem(problem);
    if (!problem) save.mutate(layout);
  }

  function discard() {
    save.reset();
    setSaveProblem(null);
    setActionError(null);
    dispatch({ type: "load", layout: savedLayout });
    setStatus("Alterações descartadas.");
  }

  async function reload() {
    setReloading(true);
    try {
      await onReload();
    } finally {
      setReloading(false);
    }
  }

  const saveError =
    saveProblem ??
    (save.isError
      ? save.error instanceof ApiError && save.error.status === 409
        ? "Outra pessoa alterou o receituário enquanto você editava."
        : errorMessage(save.error, "Não foi possível salvar o receituário.")
      : null);

  const layout = state.layout;
  const selected = selectedElement(state);

  return (
    <>
      {layout ? (
        <>
          <TemplateToolbar
            activeZone={state.activeZone}
            uploadingImage={uploading}
            previewing={previewing}
            canRestore={saved !== null}
            onZoneChange={(zone) => edit({ type: "setActiveZone", zone })}
            onAddText={() => addElement(createTextElement(createElementId()))}
            onAddImage={() => pickImage(null)}
            onAddLine={() => addElement(createLineElement(createElementId()))}
            onAddField={(token) => addElement(createTextElement(createElementId(), token))}
            onPreview={() => void openPreview()}
            onRestore={() => {
              restore.reset();
              setConfirmRestore(true);
            }}
          />
          {actionError ? <InlineError>{actionError}</InlineError> : null}

          <div className={styles.workspace}>
            <div className={styles.sheetPanel}>
              <TemplateCanvas
                layout={layout}
                selectedId={state.selectedId}
                activeZone={state.activeZone}
                images={images}
                fieldValues={fieldValues}
                sheetRef={sheetRef}
                onAction={edit}
                onMeasure={measure}
                onRemove={removeElement}
                onEdit={editElement}
              />
            </div>
            <div className={styles.side}>
              <ElementInspector
                panelRef={inspectorRef}
                layout={layout}
                element={selected}
                textHeightMm={selected ? state.textHeights[selected.id] : undefined}
                uploadingImage={uploading}
                onAction={edit}
                onDuplicate={duplicateElement}
                onRemove={removeElement}
                onReplaceImage={(id) => pickImage(id)}
              />
              <TemplateBlockList
                layout={layout}
                selectedId={state.selectedId}
                onSelect={(id) => edit({ type: "select", id })}
              />
            </div>
          </div>
        </>
      ) : (
        <section className={styles.emptyPanel} aria-label="Receituário da clínica">
          <EmptyState
            icon={FileText}
            title="A clínica usa o cabeçalho padrão"
            description="Sem um receituário próprio, a receita sai com o nome, o endereço e o telefone da clínica no topo e o número da página no rodapé."
            action={
              <div className={styles.emptyActions}>
                <Button
                  ref={startButtonRef}
                  type="button"
                  onClick={() =>
                    start(blankLayout(), "Receituário em branco. Adicione o primeiro bloco.")
                  }
                >
                  Começar um receituário
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    start(sampleLayout(), "Exemplo carregado. Ajuste os blocos e salve.")
                  }
                >
                  Partir do exemplo
                </Button>
              </div>
            }
          />
        </section>
      )}

      {savedNotice && !dirty ? (
        <div className={styles.savedNote}>
          <SuccessNote>Receituário salvo. As próximas receitas já saem com este desenho.</SuccessNote>
        </div>
      ) : null}
      {dirty ? (
        <UnsavedChangesBar
          saving={save.isPending}
          error={saveError}
          saveLabel="Salvar receituário"
          onDiscard={discard}
          onSave={submit}
        />
      ) : null}

      <p className="srOnly" role="status">
        {status}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        aria-label="Arquivo de imagem do receituário"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void acceptImage(file);
        }}
      />

      {confirmRestore ? (
        <Dialog
          size="sm"
          tone="danger"
          role="alertdialog"
          icon={<RotateCcw size={20} />}
          title="Restaurar o cabeçalho padrão?"
          description="O desenho atual será apagado e as próximas receitas saem só com o nome, o endereço e o telefone da clínica. Receitas já emitidas não mudam."
          dismissible={!restore.isPending}
          closeLabel={null}
          onClose={() => setConfirmRestore(false)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                autoFocus
                disabled={restore.isPending}
                onClick={() => setConfirmRestore(false)}
              >
                Manter receituário
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={restore.isPending}
                onClick={() => restore.mutate()}
              >
                Restaurar padrão
              </Button>
            </>
          }
        >
          {restore.isError ? (
            <InlineError>
              {errorMessage(restore.error, "Não foi possível restaurar o padrão agora.")}
            </InlineError>
          ) : null}
        </Dialog>
      ) : null}

      {conflict ? (
        <Dialog
          size="sm"
          tone="warning"
          icon={<TriangleAlert size={20} />}
          title="O receituário mudou"
          description="Outra pessoa salvou o receituário enquanto você editava. Recarregue para trabalhar sobre a versão atual; as suas alterações ainda não salvas serão perdidas."
          dismissible={!reloading}
          onClose={() => setConflict(false)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={reloading}
                onClick={() => setConflict(false)}
              >
                Continuar editando
              </Button>
              <Button type="button" loading={reloading} onClick={() => void reload()}>
                Recarregar receituário
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
