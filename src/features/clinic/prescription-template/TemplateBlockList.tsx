import { useId } from "react";
import {
  elementKindLabels,
  elementListLabel,
  TEMPLATE_LIMITS,
  templateZones,
  type TemplateLayout,
  zoneLabels,
} from "./templateModel";
import styles from "./TemplateBlockList.module.css";

/** Lista dos blocos por área: seleciona sem ponteiro e mostra quantos cabem ainda. */
export function TemplateBlockList({
  layout,
  selectedId,
  onSelect,
}: {
  layout: TemplateLayout;
  selectedId: string | null;
  onSelect(id: string): void;
}) {
  const titleId = useId();
  const groupId = useId();

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId}>Blocos</h2>
        <span>
          {layout.elements.length} de {TEMPLATE_LIMITS.elements}
        </span>
      </header>
      {layout.elements.length === 0 ? (
        <p className={styles.empty}>Nenhum bloco ainda. Use os botões acima da folha.</p>
      ) : (
        templateZones.map((zone) => {
          const items = layout.elements.filter((element) => element.zone === zone);
          if (!items.length) return null;
          const headingId = `${groupId}-${zone}`;
          return (
            <div key={zone} className={styles.group}>
              <h3 id={headingId} className={styles.groupTitle}>
                {zoneLabels[zone]}
              </h3>
              <ul className={styles.list} aria-labelledby={headingId}>
                {items.map((element) => (
                  <li key={element.id}>
                    <button
                      type="button"
                      className={styles.item}
                      aria-current={element.id === selectedId ? "true" : undefined}
                      onClick={() => onSelect(element.id)}
                    >
                      <span className={styles.kind}>{elementKindLabels[element.kind]}</span>
                      <span className={styles.name}>{elementListLabel(element)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
