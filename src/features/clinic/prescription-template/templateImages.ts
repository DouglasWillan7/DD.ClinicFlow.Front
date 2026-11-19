export type TemplateImageEntry =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

export function templateImagePath(imageId: string) {
  return `/clinics/prescription-template/images/${encodeURIComponent(imageId)}`;
}

/**
 * Imagens do receituário já baixadas, uma por id, como object URL. Vive enquanto a
 * página do editor estiver aberta: `release` revoga tudo um instante depois da
 * desmontagem, e `retain` cancela isso (o StrictMode desmonta e remonta na hora).
 */
export class TemplateImageStore {
  private readonly entries = new Map<string, TemplateImageEntry>();
  private readonly listeners = new Set<() => void>();
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Muda a cada descarte: respostas de antes não criam URL que ninguém revogaria. */
  private generation = 0;
  private readonly load: (imageId: string) => Promise<Blob>;

  constructor(load: (imageId: string) => Promise<Blob>) {
    this.load = load;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (imageId: string): TemplateImageEntry | undefined => this.entries.get(imageId);

  /** Baixa a imagem se ainda não foi pedida. */
  ensure(imageId: string) {
    if (this.entries.has(imageId)) return;
    const generation = this.generation;
    this.set(imageId, { status: "loading" });
    this.load(imageId).then(
      (blob) => {
        if (generation !== this.generation) return;
        this.set(imageId, { status: "ready", url: URL.createObjectURL(blob) });
      },
      () => {
        if (generation !== this.generation) return;
        this.set(imageId, { status: "error" });
      },
    );
  }

  /** Guarda o arquivo recém-enviado: a folha mostra a imagem sem baixar de volta. */
  put(imageId: string, blob: Blob) {
    this.set(imageId, { status: "ready", url: URL.createObjectURL(blob) });
  }

  retain() {
    if (this.disposeTimer !== null) {
      clearTimeout(this.disposeTimer);
      this.disposeTimer = null;
    }
  }

  release() {
    this.retain();
    this.disposeTimer = setTimeout(() => {
      this.disposeTimer = null;
      this.dispose();
    }, 0);
  }

  private dispose() {
    this.generation += 1;
    for (const entry of this.entries.values()) {
      if (entry.status === "ready") URL.revokeObjectURL(entry.url);
    }
    this.entries.clear();
    this.emit();
  }

  private set(imageId: string, entry: TemplateImageEntry) {
    const previous = this.entries.get(imageId);
    if (previous?.status === "ready") URL.revokeObjectURL(previous.url);
    this.entries.set(imageId, entry);
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Proporção (largura ÷ altura) lida do próprio arquivo; rejeita quando o navegador
 * não consegue decodificar a imagem.
 */
export async function readImageAspectRatio(file: Blob): Promise<number> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Imagem sem dimensões.");
    return ratio;
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => {
        const ratio = probe.naturalWidth / probe.naturalHeight;
        if (Number.isFinite(ratio) && ratio > 0) resolve(ratio);
        else reject(new Error("Imagem sem dimensões."));
      };
      probe.onerror = () => reject(new Error("Imagem inválida."));
      probe.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
