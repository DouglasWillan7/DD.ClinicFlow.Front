import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "../../../api/client";
import type {
  PrescriptionTemplate,
  PrescriptionTemplateElement,
  SavePrescriptionTemplateRequest,
} from "../../../api/types";
import { PrescriptionTemplatePage } from "./PrescriptionTemplatePage";

let requestMock = vi.fn();
let requestBlobMock = vi.fn();

vi.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({
    request: requestMock,
    requestBlob: requestBlobMock,
    session: { userClinicId: "uc-admin" },
  }),
}));

// O jsdom não decodifica imagens: a proporção do arquivo vem fixa em 2:1.
vi.mock("./templateImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./templateImages")>()),
  readImageAspectRatio: vi.fn(async () => 2),
}));

const templatePath = "/clinics/prescription-template";

function textElement(changes: Partial<PrescriptionTemplateElement> = {}): PrescriptionTemplateElement {
  return {
    id: "nome",
    zone: "Header",
    kind: "Text",
    xMm: 20,
    yMm: 4,
    widthMm: 90,
    heightMm: null,
    text: "{{clinic.name}}",
    fontFamily: "Lato",
    fontSizePt: 12,
    bold: false,
    italic: false,
    colorHex: "#16283a",
    align: "Left",
    thicknessPt: null,
    imageId: null,
    ...changes,
  };
}

const savedTemplate: PrescriptionTemplate = {
  headerHeightMm: 30,
  footerHeightMm: 20,
  version: 2,
  updatedAtUtc: "2026-11-10T12:00:00Z",
  elements: [
    textElement(),
    {
      ...textElement({ id: "linha", zone: "Footer", kind: "Line", yMm: 3, widthMm: 170 }),
      text: null,
      fontFamily: null,
      fontSizePt: null,
      align: null,
      thicknessPt: 1,
    },
  ],
};

// Os campos da clínica aparecem na folha com os dados reais dela.
let clinic: { name: string; address: string | null; phone: string | null };
let current: PrescriptionTemplate | null;
let putBodies: SavePrescriptionTemplateRequest[];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PrescriptionTemplatePage />
    </QueryClientProvider>,
  );
}

function sheet() {
  return screen.getByRole("group", { name: "Folha da receita em escala" });
}

function fileInput() {
  return screen.getByLabelText("Arquivo de imagem do receituário") as HTMLInputElement;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/app/configuracoes/clinica/receituario");
  current = savedTemplate;
  clinic = { name: "Clínica Horizonte", address: "Av. Paulista, 1000 · São Paulo", phone: "(11) 4000-0000" };
  putBodies = [];
  URL.createObjectURL = vi.fn(() => "blob:receituario");
  URL.revokeObjectURL = vi.fn();
  requestBlobMock = vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" }));
  requestMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (path === "/clinics/current") return clinic;
    if (path === templatePath && method === "GET") {
      if (!current) throw new ApiError("Receituário não encontrado.", 404);
      return current;
    }
    if (path === templatePath && method === "PUT") {
      const body = JSON.parse(String(init!.body)) as SavePrescriptionTemplateRequest;
      putBodies.push(body);
      const { expectedVersion, ...layout } = body;
      current = { ...layout, version: (expectedVersion ?? 0) + 1, updatedAtUtc: "2026-11-18T12:00:00Z" };
      return current;
    }
    if (path === templatePath && method === "DELETE") {
      current = null;
      return undefined;
    }
    if (path === `${templatePath}/images` && method === "POST") {
      return { id: "img-nova", contentType: "image/png", sizeBytes: 120 };
    }
    throw new Error(`Rota inesperada: ${method} ${path}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("é uma aba da configuração da clínica e, sem receituário, mostra o cabeçalho padrão", async () => {
  current = null;
  const user = userEvent.setup();
  renderPage();

  expect(await screen.findByText("A clínica usa o cabeçalho padrão")).toBeVisible();
  expect(screen.getByRole("heading", { level: 1, name: "Clínica" })).toBeVisible();
  const tabs = screen.getByRole("navigation", { name: "Configuração da clínica" });
  expect(within(tabs).getByRole("link", { name: "Receituário" })).toHaveAttribute("aria-current", "page");

  await user.click(screen.getByRole("button", { name: "Começar um receituário" }));

  // Rascunho novo: ainda não salvo e sem "Restaurar padrão" (não há o que restaurar).
  expect(screen.getByRole("region", { name: "Alterações não salvas" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Restaurar padrão" })).not.toBeInTheDocument();
  expect(screen.getByText("Nenhum bloco ainda. Use os botões acima da folha.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Texto" }));
  expect(within(sheet()).getByRole("button", { name: "Texto no cabeçalho: Novo texto" })).toHaveFocus();
  expect(screen.getByText("1 de 30")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Salvar receituário" }));

  expect(
    await screen.findByText("Receituário salvo. As próximas receitas já saem com este desenho."),
  ).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(putBodies[0]).toMatchObject({ headerHeightMm: 30, footerHeightMm: 20, expectedVersion: null });
  expect(putBodies[0].elements).toEqual([
    expect.objectContaining({ zone: "Header", kind: "Text", text: "Novo texto", xMm: 20, yMm: 2 }),
  ]);
  expect(screen.queryByRole("region", { name: "Alterações não salvas" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restaurar padrão" })).toBeVisible();
});

test("o painel edita o texto na forma legível e grava os campos e o estilo no formato da API", async () => {
  const user = userEvent.setup();
  renderPage();

  const blocks = await screen.findByRole("list", { name: "Cabeçalho" });
  await user.click(within(blocks).getByRole("button", { name: /\{Nome da clínica\}/ }));

  expect(screen.getByRole("heading", { level: 2, name: "Texto" })).toBeVisible();
  const text = screen.getByRole("textbox", { name: "Texto" });
  expect(text).toHaveValue("{Nome da clínica}");

  await user.type(text, " · ");
  await user.click(screen.getByRole("button", { name: "Telefone" }));
  expect(text).toHaveValue("{Nome da clínica} · {Telefone}");
  // Na folha o campo aparece com o valor de exemplo.
  expect(
    within(sheet()).getByRole("button", { name: "Texto no cabeçalho: {Nome da clínica} · {Telefone}" }),
  ).toHaveTextContent("Clínica Horizonte · (11) 4000-0000");

  fireEvent.change(screen.getByRole("spinbutton", { name: "Tamanho (pt)" }), { target: { value: "40" } });
  await user.selectOptions(screen.getByRole("combobox", { name: "Fonte" }), "Lora");
  await user.click(screen.getByRole("button", { name: "Negrito" }));
  await user.click(screen.getByRole("button", { name: "Centro" }));
  await user.click(screen.getByRole("button", { name: "Azul" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "X (cm)" }), { target: { value: "3.5" } });

  expect(screen.getByRole("button", { name: "Negrito" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Centro" })).toHaveAttribute("aria-pressed", "true");

  await user.click(screen.getByRole("button", { name: "Salvar receituário" }));
  await waitFor(() => expect(putBodies).toHaveLength(1));

  expect(putBodies[0].expectedVersion).toBe(2);
  expect(putBodies[0].elements[0]).toMatchObject({
    id: "nome",
    text: "{{clinic.name}} · {{clinic.phone}}",
    fontFamily: "Lora",
    fontSizePt: 36,
    bold: true,
    align: "Center",
    colorHex: "#3b5bfe",
    xMm: 35,
  });
  // O bloco não selecionado vai como estava.
  expect(putBodies[0].elements[1]).toMatchObject({ id: "linha", zone: "Footer", kind: "Line", thicknessPt: 1 });
});

test("as setas movem o bloco em milímetros e Delete remove sem precisar do ponteiro", async () => {
  const user = userEvent.setup();
  renderPage();

  const block = await within(await screen.findByRole("group", { name: "Folha da receita em escala" }))
    .findByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" });
  block.focus();

  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("spinbutton", { name: "X (cm)" })).toHaveValue(2.1);
  await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
  expect(screen.getByRole("spinbutton", { name: "Y (cm)" })).toHaveValue(0.9);
  expect(block).toHaveAttribute("aria-pressed", "true");

  await user.keyboard("{Escape}");
  expect(screen.getByRole("heading", { level: 2, name: "Página" })).toBeVisible();

  block.focus();
  await user.keyboard("{Delete}");
  expect(within(sheet()).queryByRole("button", { name: /\{Nome da clínica\}/ })).not.toBeInTheDocument();
  expect(screen.getByText("1 de 30")).toBeVisible();
  expect(sheet()).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Bloco removido.");
});

test("recusa imagem que não é PNG/JPEG ou passa de 2 MB sem enviar, mostra o erro da API e insere a válida", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("group", { name: "Folha da receita em escala" });

  await user.click(screen.getByRole("button", { name: "Imagem" }));
  fireEvent.change(fileInput(), {
    target: { files: [new File(["gif"], "logo.gif", { type: "image/gif" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Envie uma imagem PNG ou JPEG.");

  fireEvent.change(fileInput(), {
    target: {
      files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" })],
    },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("A imagem tem mais de 2 MB.");
  expect(requestMock.mock.calls.filter(([path]) => path === `${templatePath}/images`)).toEqual([]);

  // A API confere os bytes e pode recusar mesmo com o tipo certo.
  requestMock.mockImplementationOnce(async () => {
    throw new ApiError("O arquivo não é um PNG válido.", 400);
  });
  fireEvent.change(fileInput(), {
    target: { files: [new File(["png"], "logo.png", { type: "image/png" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("O arquivo não é um PNG válido.");

  const logo = new File(["png"], "logo.png", { type: "image/png" });
  fireEvent.change(fileInput(), { target: { files: [logo] } });

  const image = await within(sheet()).findByRole("button", { name: "Imagem no cabeçalho: Imagem" });
  expect(image).toHaveFocus();
  expect(image.querySelector("img")).toHaveAttribute("src", "blob:receituario");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const upload = requestMock.mock.calls.filter(([path]) => path === `${templatePath}/images`).at(-1)!;
  const body = upload[1].body as FormData;
  expect(body.get("file")).toBe(logo);
  // Proporção 2:1 do arquivo, com 3 cm de largura.
  expect(screen.getByRole("spinbutton", { name: "Largura (cm)" })).toHaveValue(3);
});

test("conflito ao salvar oferece recarregar a versão atual", async () => {
  const user = userEvent.setup();
  renderPage();

  const block = await within(await screen.findByRole("group", { name: "Folha da receita em escala" }))
    .findByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" });
  block.focus();
  await user.keyboard("{ArrowDown}");

  requestMock.mockImplementationOnce(async () => {
    current = { ...savedTemplate, version: 3, elements: [textElement({ text: "{{doctor.name}}" })] };
    throw new ApiError("O receituário foi alterado.", 409);
  });
  await user.click(screen.getByRole("button", { name: "Salvar receituário" }));

  const dialog = await screen.findByRole("dialog", { name: "O receituário mudou" });
  expect(screen.getByRole("region", { name: "Alterações não salvas" })).toHaveTextContent(
    "Outra pessoa alterou o receituário enquanto você editava.",
  );

  await user.click(within(dialog).getByRole("button", { name: "Recarregar receituário" }));

  expect(
    await within(sheet()).findByRole("button", { name: "Texto no cabeçalho: {Médico}" }),
  ).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Alterações não salvas" })).not.toBeInTheDocument();
  expect(requestMock.mock.calls.filter(([path, init]) => path === templatePath && !init)).toHaveLength(2);
});

test("erro de validação da API aparece na barra e o rascunho continua", async () => {
  const user = userEvent.setup();
  renderPage();

  const block = await within(await screen.findByRole("group", { name: "Folha da receita em escala" }))
    .findByRole("button", { name: "Texto no cabeçalho: {Nome da clínica}" });
  block.focus();
  await user.keyboard("{ArrowRight}");

  requestMock.mockImplementationOnce(async () => {
    throw new ApiError("O texto do cabeçalho passa da área.", 400);
  });
  await user.click(screen.getByRole("button", { name: "Salvar receituário" }));

  const bar = screen.getByRole("region", { name: "Alterações não salvas" });
  expect(await within(bar).findByRole("alert")).toHaveTextContent("O texto do cabeçalho passa da área.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "X (cm)" })).toHaveValue(2.1);
});

test("restaurar padrão pede confirmação e só então apaga o receituário", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Restaurar padrão" }));
  let dialog = screen.getByRole("alertdialog", { name: "Restaurar o cabeçalho padrão?" });
  await user.click(within(dialog).getByRole("button", { name: "Manter receituário" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(requestMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

  await user.click(screen.getByRole("button", { name: "Restaurar padrão" }));
  dialog = screen.getByRole("alertdialog", { name: "Restaurar o cabeçalho padrão?" });
  await user.click(within(dialog).getByRole("button", { name: "Restaurar padrão" }));

  expect(await screen.findByText("A clínica usa o cabeçalho padrão")).toBeVisible();
  expect(requestMock).toHaveBeenCalledWith(templatePath, { method: "DELETE" });
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("O receituário voltou ao cabeçalho padrão do sistema.");
  expect(screen.getByRole("button", { name: "Começar um receituário" })).toHaveFocus();
});

test("a prévia manda o desenho atual e abre o PDF real numa aba nova; erro da API aparece", async () => {
  const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
  const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Prévia PDF" }));

  await waitFor(() => expect(tab.location.href).toBe("blob:receituario"));
  expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(tab.opener).toBeNull();
  const [path, init] = requestBlobMock.mock.calls[0];
  expect(path).toBe(`${templatePath}/preview`);
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({
    headerHeightMm: 30,
    footerHeightMm: 20,
    elements: savedTemplate.elements,
  });

  requestBlobMock.mockRejectedValueOnce(new ApiError("O cabeçalho tem um campo desconhecido.", 400));
  await user.click(screen.getByRole("button", { name: "Prévia PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("O cabeçalho tem um campo desconhecido.");
  expect(tab.close).toHaveBeenCalled();
});

test("os campos da clínica mostram os dados reais e avisam quando a clínica não tem o dado", async () => {
  clinic = { name: "Clínica Aurora", address: null, phone: null };
  current = {
    ...savedTemplate,
    elements: [textElement({ text: "{{clinic.name}} · {{clinic.phone}} · {{doctor.name}}" })],
  };
  renderPage();

  const page = await screen.findByRole("group", { name: "Folha da receita em escala" });
  const block = await within(page).findByRole("button", { name: /Texto no cabeçalho/ });
  // O nome vem da clínica; o médico segue com um exemplo, porque muda a cada receita.
  await waitFor(() => expect(block).toHaveTextContent("Clínica Aurora · Telefone · Dra. Helena Costa"));
  expect(within(block).getByText("Telefone")).toHaveAttribute(
    "title",
    "A clínica não tem telefone cadastrado; este campo sai vazio na receita.",
  );
});
