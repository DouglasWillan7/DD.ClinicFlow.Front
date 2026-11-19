import { ExternalLink, ImagePlus, Minus, RotateCcw, Type } from "lucide-react";
import { useId } from "react";
import type { TemplateZone } from "../../../api/types";
import { Button } from "../../../components/Button";
import { templateFields, templateZones, zoneLabels } from "./templateModel";
import styles from "./TemplateToolbar.module.css";

interface TemplateToolbarProps {
  activeZone: TemplateZone;
  uploadingImage: boolean;
  previewing: boolean;
  /** Só com receituário salvo: antes disso, descartar o rascunho já volta ao padrão. */
  canRestore: boolean;
  onZoneChange(zone: TemplateZone): void;
  onAddText(): void;
  onAddImage(): void;
  onAddLine(): void;
  onAddField(token: string): void;
  onPreview(): void;
  onRestore(): void;
}

/** Ações do editor: onde e o que adicionar, prévia em PDF real e volta ao padrão. */
export function TemplateToolbar({
  activeZone,
  uploadingImage,
  previewing,
  canRestore,
  onZoneChange,
  onAddText,
  onAddImage,
  onAddLine,
  onAddField,
  onPreview,
  onRestore,
}: TemplateToolbarProps) {
  const zoneLabelId = useId();
  const fieldSelectId = useId();

  return (
    <section className={styles.toolbar} aria-label="Ferramentas do receituário">
      <div className={styles.group}>
        <span id={zoneLabelId} className={styles.inlineLabel}>
          Adicionar em
        </span>
        <div className={styles.segmented} role="group" aria-labelledby={zoneLabelId}>
          {templateZones.map((zone) => (
            <button
              key={zone}
              type="button"
              className={styles.segment}
              aria-pressed={activeZone === zone}
              onClick={() => onZoneChange(zone)}
            >
              {zoneLabels[zone]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <Button type="button" variant="secondary" onClick={onAddText}>
          <Type size={16} aria-hidden="true" />
          Texto
        </Button>
        <Button type="button" variant="secondary" loading={uploadingImage} onClick={onAddImage}>
          <ImagePlus size={16} aria-hidden="true" />
          Imagem
        </Button>
        <Button type="button" variant="secondary" onClick={onAddLine}>
          <Minus size={16} aria-hidden="true" />
          Linha
        </Button>
        <label htmlFor={fieldSelectId} className="srOnly">
          Adicionar campo automático
        </label>
        {/* Funciona como menu: escolher um campo cria a caixa de texto e volta ao início. */}
        <select
          id={fieldSelectId}
          className={styles.fieldSelect}
          value=""
          onChange={(event) => {
            if (event.target.value) onAddField(event.target.value);
          }}
        >
          <option value="">+ Campo automático</option>
          {templateFields.map((field) => (
            <option key={field.token} value={field.token}>
              {field.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" loading={previewing} onClick={onPreview}>
          <ExternalLink size={16} aria-hidden="true" />
          Prévia PDF
        </Button>
        {canRestore ? (
          <Button type="button" variant="danger" onClick={onRestore}>
            <RotateCcw size={16} aria-hidden="true" />
            Restaurar padrão
          </Button>
        ) : null}
      </div>
    </section>
  );
}
