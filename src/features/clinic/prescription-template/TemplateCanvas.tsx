import clsx from "clsx";
import { ImageOff } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import type { TemplateZone } from "../../../api/types";
import "./templateFonts";
import type { TemplateImageStore } from "./templateImages";
import {
  elementKindLabels,
  elementListLabel,
  fontFamilyStacks,
  fontSizeMm,
  formatCm,
  lineThicknessMm,
  PAGE_HEIGHT_MM,
  pxPerMm,
  pxToMm,
  segmentText,
  templateZones,
  type TemplateElement,
  type TemplateFieldValues,
  type TemplateLayout,
  zoneHeightMm,
  zoneLabels,
  zoneMaxHeightMm,
  zoneTopMm,
} from "./templateModel";
import type { EditorAction } from "./templateReducer";
import styles from "./TemplateCanvas.module.css";

interface TemplateCanvasProps {
  layout: TemplateLayout;
  selectedId: string | null;
  activeZone: TemplateZone;
  images: TemplateImageStore;
  /** Dados reais da clínica para os campos; sem eles a folha mostra valores de exemplo. */
  fieldValues?: TemplateFieldValues;
  sheetRef: RefObject<HTMLDivElement | null>;
  /** Ações da pessoa sobre a folha (selecionar, mover, redimensionar, alturas). */
  onAction(action: EditorAction): void;
  /** Alturas dos textos na folha, em mm, sempre que alguma caixa muda de tamanho. */
  onMeasure(heights: Record<string, number>): void;
  onRemove(id: string): void;
  /** Enter num bloco: abre as propriedades dele no painel. */
  onEdit(id: string): void;
}

type DragState =
  | {
      mode: "move" | "resize";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      origin: { xMm: number; yMm: number; widthMm: number };
      scale: number;
    }
  | {
      mode: "zone";
      zone: TemplateZone;
      pointerId: number;
      startY: number;
      originMm: number;
      scale: number;
    };

/** Medida da folha: tudo dentro dela é `var(--u)` (px por mm) vezes milímetros. */
function mm(value: number) {
  return `calc(var(--u) * ${Math.round(value * 1000) / 1000})`;
}

function elementStyle(element: TemplateElement, topMm: number): CSSProperties {
  const style: CSSProperties = {
    left: mm(element.xMm),
    top: mm(topMm),
    width: mm(element.widthMm),
  };
  if (element.kind === "Text") {
    return {
      ...style,
      // Fonte em escala com a folha; inline porque o tamanho é de cada bloco.
      fontFamily: fontFamilyStacks[element.fontFamily ?? "Lato"],
      fontSize: mm(fontSizeMm(element.fontSizePt ?? 11)),
      fontWeight: element.bold ? 700 : 400,
      fontStyle: element.italic ? "italic" : "normal",
      color: element.colorHex ?? undefined,
      textAlign: element.align === "Center" ? "center" : element.align === "Right" ? "right" : "left",
    };
  }
  if (element.kind === "Image") return { ...style, height: mm(element.heightMm ?? 0) };
  return {
    ...style,
    height: mm(lineThicknessMm(element.thicknessPt ?? 1)),
    background: element.colorHex ?? undefined,
  };
}

const arrowMoves: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Folha A4 em escala com as áreas de cabeçalho e rodapé. Os blocos se movem com o
 * ponteiro (mouse, caneta ou toque) e com as setas; a altura de cada área muda pela
 * alça na divisa. O corpo da receita aparece esmaecido só como referência.
 */
export function TemplateCanvas({
  layout,
  selectedId,
  activeZone,
  images,
  fieldValues,
  sheetRef,
  onAction,
  onMeasure,
  onRemove,
  onEdit,
}: TemplateCanvasProps) {
  const helpId = useId();
  const dragRef = useRef<DragState | null>(null);

  // Mede os textos na folha: a altura real depende da fonte carregada e da quebra de linha.
  const textIds = layout.elements
    .filter((element) => element.kind === "Text")
    .map((element) => element.id)
    .join("|");
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = sheet.getBoundingClientRect().width;
      if (!width) return;
      const scale = pxPerMm(width);
      const heights: Record<string, number> = {};
      sheet.querySelectorAll<HTMLElement>("[data-text-id]").forEach((node) => {
        heights[node.dataset.textId!] = Math.round(pxToMm(node.offsetHeight, scale) * 100) / 100;
      });
      onMeasure(heights);
    });
    observer.observe(sheet);
    sheet.querySelectorAll("[data-text-id]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [onMeasure, sheetRef, textIds]);

  function currentScale() {
    return pxPerMm(sheetRef.current?.getBoundingClientRect().width ?? 0);
  }

  function capture(event: PointerEvent<HTMLElement>) {
    // jsdom não implementa captura; no navegador ela mantém o arrasto fora do bloco.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function startElementDrag(
    event: PointerEvent<HTMLElement>,
    element: TemplateElement,
    mode: "move" | "resize",
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (selectedId !== element.id) onAction({ type: "select", id: element.id });
    capture(event);
    const button = event.currentTarget.closest<HTMLElement>("[data-element-id]");
    button?.focus({ preventScroll: true });
    dragRef.current = {
      mode,
      id: element.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { xMm: element.xMm, yMm: element.yMm, widthMm: element.widthMm },
      scale: currentScale(),
    };
  }

  function startZoneDrag(event: PointerEvent<HTMLElement>, zone: TemplateZone) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event);
    event.currentTarget.focus({ preventScroll: true });
    dragRef.current = {
      mode: "zone",
      zone,
      pointerId: event.pointerId,
      startY: event.clientY,
      originMm: zoneHeightMm(layout, zone),
      scale: currentScale(),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dyMm = pxToMm(event.clientY - drag.startY, drag.scale);
    if (drag.mode === "zone") {
      // Descer a divisa aumenta o cabeçalho e diminui o rodapé.
      const heightMm = drag.zone === "Header" ? drag.originMm + dyMm : drag.originMm - dyMm;
      onAction({ type: "setZoneHeight", zone: drag.zone, heightMm });
      return;
    }
    const dxMm = pxToMm(event.clientX - drag.startX, drag.scale);
    if (drag.mode === "move") {
      onAction({ type: "move", id: drag.id, xMm: drag.origin.xMm + dxMm, yMm: drag.origin.yMm + dyMm });
    } else {
      onAction({ type: "resize", id: drag.id, widthMm: drag.origin.widthMm + dxMm });
    }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  // Toque no fundo: tira a seleção e escolhe a área onde os próximos blocos entram.
  function handleBackgroundPointerDown(event: PointerEvent<HTMLDivElement>) {
    const zone = (event.target as HTMLElement).closest<HTMLElement>("[data-zone]")?.dataset.zone;
    if (zone === "Header" || zone === "Footer") onAction({ type: "setActiveZone", zone });
    if (selectedId) onAction({ type: "select", id: null });
  }

  function handleElementKey(event: KeyboardEvent<HTMLButtonElement>, element: TemplateElement) {
    const move = arrowMoves[event.key];
    if (move) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      if (selectedId !== element.id) onAction({ type: "select", id: element.id });
      onAction({ type: "nudge", id: element.id, dxMm: move[0] * step, dyMm: move[1] * step });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(element.id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onEdit(element.id);
    } else if (event.key === "Escape" && selectedId) {
      event.preventDefault();
      onAction({ type: "select", id: null });
    }
  }

  function handleGripKey(event: KeyboardEvent<HTMLDivElement>, zone: TemplateZone) {
    const step = event.shiftKey ? 5 : 1;
    const current = zoneHeightMm(layout, zone);
    let delta: number;
    // Setas verticais seguem a divisa na folha; as horizontais aumentam e diminuem.
    if (event.key === "ArrowDown") delta = zone === "Header" ? step : -step;
    else if (event.key === "ArrowUp") delta = zone === "Header" ? -step : step;
    else if (event.key === "ArrowRight") delta = step;
    else if (event.key === "ArrowLeft") delta = -step;
    else if (event.key === "Home") delta = -current;
    else if (event.key === "End") delta = zoneMaxHeightMm[zone] - current;
    else return;
    event.preventDefault();
    onAction({ type: "setZoneHeight", zone, heightMm: current + delta });
  }

  const ordered = templateZones.flatMap((zone) =>
    layout.elements.filter((element) => element.zone === zone),
  );

  return (
    <div className={styles.frame}>
      <p id={helpId} className="srOnly">
        Setas movem o bloco 1 mm; com Shift, 5 mm. Enter abre as propriedades, Delete
        remove e Esc tira a seleção.
      </p>
      <div
        ref={sheetRef}
        className={styles.sheet}
        tabIndex={-1}
        role="group"
        aria-label="Folha da receita em escala"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {templateZones.map((zone) => {
          const height = zoneHeightMm(layout, zone);
          return (
            <div
              key={zone}
              data-zone={zone}
              className={clsx(
                styles.zone,
                zone === "Header" ? styles.headerZone : styles.footerZone,
                zone === activeZone && styles.activeZone,
              )}
              style={{ height: mm(height) }}
            >
              <span className={styles.zoneTag}>
                {zoneLabels[zone]} · {formatCm(height)} cm
              </span>
            </div>
          );
        })}

        <SampleBody layout={layout} />

        {ordered.map((element) => (
          <ElementView
            key={element.id}
            element={element}
            topMm={zoneTopMm(layout, element.zone) + element.yMm}
            selected={element.id === selectedId}
            images={images}
            fieldValues={fieldValues}
            helpId={helpId}
            onPointerDown={(event) => startElementDrag(event, element, "move")}
            onResizeStart={(event) => startElementDrag(event, element, "resize")}
            onKeyDown={(event) => handleElementKey(event, element)}
            onSelect={() => {
              if (selectedId !== element.id) onAction({ type: "select", id: element.id });
            }}
          />
        ))}

        {templateZones.map((zone) => {
          const height = zoneHeightMm(layout, zone);
          const label = zoneLabels[zone].toLowerCase();
          return (
            <div
              key={zone}
              role="slider"
              tabIndex={0}
              className={styles.grip}
              style={{ top: mm(zone === "Header" ? height : PAGE_HEIGHT_MM - height) }}
              aria-label={`Altura do ${label}`}
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={zoneMaxHeightMm[zone]}
              aria-valuenow={height}
              aria-valuetext={`${formatCm(height)} centímetros`}
              onPointerDown={(event) => startZoneDrag(event, zone)}
              onKeyDown={(event) => handleGripKey(event, zone)}
            >
              <span className={styles.gripBar} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElementView({
  element,
  topMm,
  selected,
  images,
  fieldValues,
  helpId,
  onPointerDown,
  onResizeStart,
  onKeyDown,
  onSelect,
}: {
  element: TemplateElement;
  topMm: number;
  selected: boolean;
  images: TemplateImageStore;
  fieldValues?: TemplateFieldValues;
  helpId: string;
  onPointerDown(event: PointerEvent<HTMLButtonElement>): void;
  onResizeStart(event: PointerEvent<HTMLSpanElement>): void;
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
  onSelect(): void;
}) {
  const zone = zoneLabels[element.zone].toLowerCase();
  return (
    <button
      type="button"
      className={clsx(
        styles.element,
        element.kind === "Text" && styles.text,
        element.kind === "Image" && styles.image,
        element.kind === "Line" && styles.line,
        selected && styles.selected,
      )}
      style={elementStyle(element, topMm)}
      data-element-id={element.id}
      data-text-id={element.kind === "Text" ? element.id : undefined}
      aria-label={`${elementKindLabels[element.kind]} no ${zone}: ${elementListLabel(element)}`}
      aria-describedby={helpId}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={onSelect}
    >
      {element.kind === "Text" ? (
        <TextContent text={element.text ?? ""} fieldValues={fieldValues} />
      ) : null}
      {element.kind === "Image" && element.imageId ? (
        <TemplateImage store={images} imageId={element.imageId} />
      ) : null}
      {selected ? (
        <span
          className={clsx(styles.handle, element.kind === "Image" ? styles.handleCorner : styles.handleSide)}
          aria-hidden="true"
          onPointerDown={onResizeStart}
        />
      ) : null}
    </button>
  );
}

/**
 * Campos aparecem como etiqueta destacada. Os da clínica mostram o dado real; os do médico,
 * um exemplo, porque mudam conforme quem emite a receita.
 */
function TextContent({ text, fieldValues }: { text: string; fieldValues?: TemplateFieldValues }) {
  if (!text) return <span className={styles.emptyText}>Texto</span>;
  return (
    <>
      {segmentText(text).map((segment, index) => {
        if (segment.kind !== "field") return <span key={index}>{segment.value}</span>;
        const value = fieldValues?.[segment.field.token];
        // Dado que a clínica não cadastrou: na receita o campo sai vazio.
        if (value === "") {
          return (
            <span
              key={index}
              className={clsx(styles.token, styles.tokenMissing)}
              title={`A clínica não tem ${segment.field.label.toLocaleLowerCase("pt-BR")} cadastrado; este campo sai vazio na receita.`}
            >
              {segment.field.label}
            </span>
          );
        }
        return (
          <span key={index} className={styles.token}>
            {value ?? segment.field.sample}
          </span>
        );
      })}
    </>
  );
}

function TemplateImage({ store, imageId }: { store: TemplateImageStore; imageId: string }) {
  const entry = useSyncExternalStore(store.subscribe, () => store.get(imageId));
  useEffect(() => {
    store.ensure(imageId);
  }, [store, imageId]);

  if (entry?.status === "ready") {
    return <img className={styles.picture} src={entry.url} alt="" draggable={false} />;
  }
  if (entry?.status === "error") {
    return (
      <span className={styles.imageMissing} title="Imagem indisponível">
        <ImageOff aria-hidden="true" />
      </span>
    );
  }
  return <span className={styles.imageLoading} aria-hidden="true" />;
}

/**
 * Corpo de exemplo, montado pelo sistema na receita real (paciente e médico fictícios).
 * Fica entre o cabeçalho e o rodapé só para dar a medida do espaço que sobra.
 */
function SampleBody({ layout }: { layout: TemplateLayout }) {
  return (
    <>
      <div
        className={styles.body}
        style={{ top: mm(layout.headerHeightMm), bottom: mm(layout.footerHeightMm) }}
        aria-hidden="true"
      >
        <div className={styles.bodyTitle}>Receita médica</div>
        <div className={styles.bodyPatient}>
          <span>Paciente: </span>
          <b>Marina Duarte</b>
        </div>
        <div className={styles.bodyContent}>
          {"Losartana 50 mg — 60 comprimidos\nTomar 1 comprimido a cada 12 horas.\n\nSinvastatina 20 mg — 30 comprimidos\nTomar 1 comprimido à noite."}
        </div>
        <div className={styles.bodyDate}>18/11/2026</div>
        <div className={styles.bodySignature}>
          <b>Dra. Helena Costa</b>
          <small>CRM-SP 123456</small>
        </div>
      </div>
      <span
        className={styles.bodyLabel}
        style={{
          top: mm(
            layout.headerHeightMm +
              (PAGE_HEIGHT_MM - layout.footerHeightMm - layout.headerHeightMm) * 0.74,
          ),
        }}
        aria-hidden="true"
      >
        Corpo da receita, montado pelo sistema
      </span>
    </>
  );
}
