import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  ImageUp,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import type { TemplateFontFamily, TemplateTextAlign, TemplateZone } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, SelectField, TextAreaField } from "../../../components/Field";
import {
  elementKindLabels,
  fontFamilyLabels,
  inkSwatches,
  inputNumber,
  parseDecimal,
  TEMPLATE_LIMITS,
  templateFields,
  templateZones,
  textAlignLabels,
  toFriendlyText,
  toMachineText,
  type TemplateElement,
  type TemplateLayout,
  zoneHeightMm,
  zoneLabels,
  zoneMaxHeightMm,
  contentMarginLabels,
  contentMarginLimitsMm,
  contentMarginMinMm,
  contentMarginMm,
  contentMarginSides,
} from "./templateModel";
import type { EditorAction } from "./templateReducer";
import styles from "./ElementInspector.module.css";

interface ElementInspectorProps {
  layout: TemplateLayout;
  element: TemplateElement | null;
  /** Altura medida do texto selecionado, para avisar quando passa da área. */
  textHeightMm: number | undefined;
  uploadingImage: boolean;
  panelRef?: Ref<HTMLElement>;
  onAction(action: EditorAction): void;
  onDuplicate(id: string): void;
  onRemove(id: string): void;
  onReplaceImage(id: string): void;
}

const alignIcons: Record<TemplateTextAlign, ReactNode> = {
  Left: <AlignLeft size={18} aria-hidden="true" />,
  Center: <AlignCenter size={18} aria-hidden="true" />,
  Right: <AlignRight size={18} aria-hidden="true" />,
};

/**
 * Painel de propriedades: sem seleção mostra a página (altura das áreas); com um bloco
 * selecionado, tudo o que dá para fazer arrastando também dá para fazer aqui, em
 * centímetros, sem ponteiro.
 */
export function ElementInspector({
  layout,
  element,
  textHeightMm,
  uploadingImage,
  panelRef,
  onAction,
  onDuplicate,
  onRemove,
  onReplaceImage,
}: ElementInspectorProps) {
  const titleId = useId();
  return (
    <section ref={panelRef} className={styles.panel} aria-labelledby={titleId}>
      {element ? (
        <ElementProperties
          key={element.id}
          titleId={titleId}
          layout={layout}
          element={element}
          textHeightMm={textHeightMm}
          uploadingImage={uploadingImage}
          onAction={onAction}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onReplaceImage={onReplaceImage}
        />
      ) : (
        <PageProperties titleId={titleId} layout={layout} onAction={onAction} />
      )}
    </section>
  );
}

function PageProperties({
  titleId,
  layout,
  onAction,
}: {
  titleId: string;
  layout: TemplateLayout;
  onAction(action: EditorAction): void;
}) {
  return (
    <>
      <header className={styles.header}>
        <h2 id={titleId}>Página</h2>
        <span>A4 · 21,0 × 29,7 cm</span>
      </header>
      <div className={styles.form}>
        {templateZones.map((zone) => (
          <NumberField
            key={zone}
            id={`template-zone-${zone.toLowerCase()}`}
            label={`Altura do ${zoneLabels[zone].toLowerCase()} (cm)`}
            value={zoneHeightMm(layout, zone) / 10}
            min={0}
            max={zoneMaxHeightMm[zone] / 10}
            step={0.1}
            onValue={(cm) => onAction({ type: "setZoneHeight", zone, heightMm: cm * 10 })}
          />
        ))}
        <hr className={styles.divider} />
        <fieldset className={styles.margins}>
          <legend>Margens do conteúdo</legend>
          <div className={styles.pair}>
            {contentMarginSides.map((side) => (
              <NumberField
                key={side}
                id={`template-margin-${side.toLowerCase()}`}
                label={`${contentMarginLabels[side]} (cm)`}
                value={contentMarginMm(layout, side) / 10}
                min={contentMarginMinMm(layout, side) / 10}
                max={contentMarginLimitsMm[side].max / 10}
                step={0.1}
                onValue={(cm) => onAction({ type: "setContentMargin", side, valueMm: cm * 10 })}
              />
            ))}
          </div>
          <p className={styles.marginsHint}>
            Esquerda e direita contam da borda da folha; acima e abaixo, do cabeçalho e do rodapé.
          </p>
        </fieldset>
        <hr className={styles.divider} />
        <ul className={styles.tips}>
          <li>Clique ou toque num bloco para editar; arraste para mover.</li>
          <li>As setas do teclado movem 1 mm; com Shift, 5 mm.</li>
          <li>Puxe a alça azul na divisa para mudar a altura da área.</li>
        </ul>
      </div>
    </>
  );
}

function ElementProperties({
  titleId,
  layout,
  element,
  textHeightMm,
  uploadingImage,
  onAction,
  onDuplicate,
  onRemove,
  onReplaceImage,
}: Omit<ElementInspectorProps, "element" | "panelRef"> & {
  titleId: string;
  element: TemplateElement;
}) {
  const id = element.id;
  const update = (changes: Extract<EditorAction, { type: "update" }>["changes"]) =>
    onAction({ type: "update", id, changes });
  const zoneHeight = zoneHeightMm(layout, element.zone);
  const overflowsZone =
    element.kind === "Text" &&
    textHeightMm !== undefined &&
    element.yMm + textHeightMm > zoneHeight + 0.05;

  return (
    <>
      <header className={styles.header}>
        <h2 id={titleId}>{elementKindLabels[element.kind]}</h2>
        <span>{zoneLabels[element.zone]}</span>
      </header>
      <div className={styles.form}>
        {element.kind === "Text" ? (
          <TextProperties element={element} onChange={update} overflowsZone={overflowsZone} />
        ) : null}

        {element.kind === "Image" ? (
          <div className={styles.group}>
            <Button
              type="button"
              variant="secondary"
              loading={uploadingImage}
              onClick={() => onReplaceImage(id)}
            >
              <ImageUp size={16} aria-hidden="true" />
              Trocar imagem
            </Button>
            <p className={styles.hint}>PNG ou JPEG, até 2 MB. A proporção da imagem é mantida.</p>
          </div>
        ) : null}

        {element.kind === "Line" ? (
          <>
            <NumberField
              id="template-thickness"
              label="Espessura (pt)"
              value={element.thicknessPt ?? 1}
              min={TEMPLATE_LIMITS.thicknessMinPt}
              max={TEMPLATE_LIMITS.thicknessMaxPt}
              step={0.25}
              onValue={(thicknessPt) => update({ thicknessPt })}
            />
            <ColorPicker value={element.colorHex ?? ""} onChange={(colorHex) => update({ colorHex })} />
          </>
        ) : null}

        <hr className={styles.divider} />

        <div className={styles.row}>
          <NumberField
            id="template-x"
            label="X (cm)"
            value={element.xMm / 10}
            min={0}
            max={21}
            step={0.1}
            onValue={(cm) => update({ xMm: cm * 10 })}
          />
          <NumberField
            id="template-y"
            label="Y (cm)"
            value={element.yMm / 10}
            min={0}
            max={zoneHeight / 10}
            step={0.1}
            onValue={(cm) => update({ yMm: cm * 10 })}
          />
          <NumberField
            id="template-width"
            label={element.kind === "Line" ? "Comprimento (cm)" : "Largura (cm)"}
            value={element.widthMm / 10}
            min={element.kind === "Text" ? 1 : 0.4}
            max={21}
            step={0.1}
            onValue={(cm) => update({ widthMm: cm * 10 })}
          />
        </div>

        <SelectField
          id="template-zone"
          label="Área"
          value={element.zone}
          onChange={(event) =>
            onAction({ type: "changeZone", id, zone: event.target.value as TemplateZone })
          }
        >
          {templateZones.map((zone) => (
            <option key={zone} value={zone}>
              {zoneLabels[zone]}
            </option>
          ))}
        </SelectField>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => onDuplicate(id)}>
            <Copy size={16} aria-hidden="true" />
            Duplicar
          </Button>
          <Button type="button" variant="danger" onClick={() => onRemove(id)}>
            <Trash2 size={16} aria-hidden="true" />
            Remover
          </Button>
        </div>
      </div>
    </>
  );
}

function TextProperties({
  element,
  overflowsZone,
  onChange,
}: {
  element: TemplateElement;
  overflowsZone: boolean;
  onChange(changes: Extract<EditorAction, { type: "update" }>["changes"]): void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fieldsLabelId = useId();
  const styleLabelId = useId();
  const [textError, setTextError] = useState<string | null>(null);
  const stored = element.text ?? "";
  const remaining = TEMPLATE_LIMITS.textLength - stored.length;

  /**
   * O painel mostra `{Nome da clínica}`; o desenho guarda `{{clinic.name}}`. O limite
   * de 300 caracteres vale para a forma guardada, que é a que a API confere.
   */
  function toStoredText(friendly: string) {
    const text = toMachineText(friendly);
    if (text.length > TEMPLATE_LIMITS.textLength) {
      setTextError(`O texto passaria de ${TEMPLATE_LIMITS.textLength} caracteres.`);
      return null;
    }
    setTextError(null);
    return text;
  }

  function insertField(label: string) {
    const area = textRef.current;
    const current = area?.value ?? toFriendlyText(stored);
    const start = area?.selectionStart ?? current.length;
    const end = area?.selectionEnd ?? start;
    const token = `{${label}}`;
    const text = toStoredText(current.slice(0, start) + token + current.slice(end));
    if (text === null) return;
    // Renderiza já, para devolver o cursor logo depois do campo inserido.
    flushSync(() => onChange({ text }));
    if (!area) return;
    area.focus();
    area.setSelectionRange(start + token.length, start + token.length);
  }

  return (
    <>
      <TextAreaField
        ref={textRef}
        id="template-text"
        label="Texto"
        rows={3}
        value={toFriendlyText(stored)}
        error={textError ?? undefined}
        hint={`Restam ${Math.max(0, remaining)} caracteres. Enter quebra a linha.`}
        onChange={(event) => {
          const text = toStoredText(event.target.value);
          if (text !== null) onChange({ text });
        }}
      />

      <div className={styles.group}>
        <span id={fieldsLabelId} className={styles.label}>
          Inserir campo automático
        </span>
        <div className={styles.chips} role="group" aria-labelledby={fieldsLabelId}>
          {templateFields.map((field) => (
            <button
              key={field.token}
              type="button"
              className={styles.chip}
              onClick={() => insertField(field.label)}
            >
              {field.label}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          Em cada receita, o campo recebe o dado da clínica ou do médico que emite.
        </p>
      </div>

      {overflowsZone ? (
        <p className={styles.warning}>
          <TriangleAlert size={16} aria-hidden="true" />
          <span>O texto passa da altura da área. Aumente a área ou diminua a fonte.</span>
        </p>
      ) : null}

      <div className={styles.fontRow}>
        <SelectField
          id="template-font"
          label="Fonte"
          value={element.fontFamily ?? "Lato"}
          onChange={(event) => onChange({ fontFamily: event.target.value as TemplateFontFamily })}
        >
          {(Object.keys(fontFamilyLabels) as TemplateFontFamily[]).map((family) => (
            <option key={family} value={family}>
              {fontFamilyLabels[family]}
            </option>
          ))}
        </SelectField>
        <NumberField
          id="template-font-size"
          label="Tamanho (pt)"
          value={element.fontSizePt ?? 11}
          min={TEMPLATE_LIMITS.fontMinPt}
          max={TEMPLATE_LIMITS.fontMaxPt}
          step={1}
          onValue={(fontSizePt) => onChange({ fontSizePt })}
        />
      </div>

      <div className={styles.group}>
        <span id={styleLabelId} className={styles.label}>
          Estilo e alinhamento
        </span>
        <div className={styles.toggles}>
          <div className={styles.segmented} role="group" aria-labelledby={styleLabelId}>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={element.bold}
              onClick={() => onChange({ bold: !element.bold })}
            >
              <strong>Negrito</strong>
            </button>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={element.italic}
              onClick={() => onChange({ italic: !element.italic })}
            >
              <em>Itálico</em>
            </button>
          </div>
          <div className={styles.segmented} role="group" aria-label="Alinhamento">
            {/* Ícone inequívoco: o nome fica para o leitor de tela e para o título. */}
            {(Object.keys(textAlignLabels) as TemplateTextAlign[]).map((align) => (
              <button
                key={align}
                type="button"
                className={`${styles.toggle} ${styles.iconToggle}`}
                aria-pressed={(element.align ?? "Left") === align}
                title={textAlignLabels[align]}
                onClick={() => onChange({ align })}
              >
                {alignIcons[align]}
                <span className="srOnly">{textAlignLabels[align]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ColorPicker value={element.colorHex ?? ""} onChange={(colorHex) => onChange({ colorHex })} />
    </>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange(hex: string): void }) {
  const labelId = useId();
  const current = value.toLowerCase();
  return (
    <div className={styles.group}>
      <span id={labelId} className={styles.label}>
        Cor
      </span>
      <div className={styles.colors} role="group" aria-labelledby={labelId}>
        <input
          type="color"
          className={styles.colorInput}
          value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#16283a"}
          aria-label="Escolher outra cor"
          onChange={(event) => onChange(event.target.value.toLowerCase())}
        />
        {inkSwatches.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            className={styles.swatch}
            aria-label={swatch.label}
            aria-pressed={current === swatch.hex}
            onClick={() => onChange(swatch.hex)}
          >
            {/* Cor de tinta do documento, não do tema: vem do modelo, em hexadecimal. */}
            <span style={{ background: swatch.hex }} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Campo numérico que aceita digitação parcial ("1," ou "") sem brigar com o valor do
 * desenho: o texto digitado vale enquanto o campo tem foco; ao sair, mostra o valor
 * já recortado aos limites.
 */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onValue,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValue(value: number): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field
      id={id}
      label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? inputNumber(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = parseDecimal(event.target.value);
        if (parsed !== null) onValue(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
