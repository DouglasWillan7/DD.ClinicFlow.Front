import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./Field.module.css";

interface FieldMessages {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Id do controle e ligação com a mensagem. O id cai para `name` (os testes e o
 * autofill contam com isso) e, sem nenhum dos dois, para um id gerado: dois
 * campos sem nome não podem dividir o mesmo `htmlFor`.
 */
function useFieldIds(id: string | undefined, name: string | undefined, { error, hint }: FieldMessages) {
  const generated = useId();
  const controlId = id ?? name ?? generated;
  const describedBy = error
    ? `${controlId}-error`
    : hint
      ? `${controlId}-hint`
      : undefined;
  return { controlId, describedBy };
}

function FieldMessage({ controlId, error, hint }: { controlId: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <small id={`${controlId}-error`} className={styles.error}>
        {error}
      </small>
    );
  }
  return hint ? <small id={`${controlId}-hint`}>{hint}</small> : null;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldMessages {}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const { controlId, describedBy } = useFieldIds(id, props.name, { label, error, hint });
    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={controlId}>{label}</label>
        <input
          ref={ref}
          id={controlId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
        <FieldMessage controlId={controlId} error={error} hint={hint} />
      </div>
    );
  },
);

Field.displayName = "Field";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldMessages {}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, id, className, children, ...props }, ref) => {
    const { controlId, describedBy } = useFieldIds(id, props.name, { label, error, hint });
    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={controlId}>{label}</label>
        <select
          ref={ref}
          id={controlId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        >
          {children}
        </select>
        <FieldMessage controlId={controlId} error={error} hint={hint} />
      </div>
    );
  },
);

SelectField.displayName = "SelectField";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldMessages {}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, id, className, rows = 4, ...props }, ref) => {
    const { controlId, describedBy } = useFieldIds(id, props.name, { label, error, hint });
    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={controlId}>{label}</label>
        <textarea
          ref={ref}
          id={controlId}
          rows={rows}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
        <FieldMessage controlId={controlId} error={error} hint={hint} />
      </div>
    );
  },
);

TextAreaField.displayName = "TextAreaField";

interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
    FieldMessages {
  /** Conteúdo ao lado do rótulo, fora do `<label>` (ex.: "Esqueci minha senha"). */
  labelAside?: ReactNode;
  /** Controla a visibilidade de fora quando dois campos dividem o mesmo botão. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** `false` esconde o botão: o campo segue a visibilidade de outro. */
  toggle?: boolean;
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      label,
      error,
      hint,
      id,
      className,
      labelAside,
      visible,
      onVisibleChange,
      toggle = true,
      showLabel = "Mostrar senha",
      hideLabel = "Ocultar senha",
      ...props
    },
    ref,
  ) => {
    const { controlId, describedBy } = useFieldIds(id, props.name, { label, error, hint });
    const [localVisible, setLocalVisible] = useState(false);
    const shown = visible ?? localVisible;

    function toggleVisibility() {
      setLocalVisible(!shown);
      onVisibleChange?.(!shown);
    }

    return (
      <div className={clsx(styles.field, className)}>
        {labelAside ? (
          <div className={styles.labelRow}>
            <label htmlFor={controlId}>{label}</label>
            {labelAside}
          </div>
        ) : (
          <label htmlFor={controlId}>{label}</label>
        )}
        <div className={clsx(styles.passwordControl, toggle && styles.withToggle)}>
          <input
            ref={ref}
            id={controlId}
            type={shown ? "text" : "password"}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            {...props}
          />
          {toggle ? (
            <button
              type="button"
              className={styles.reveal}
              aria-label={shown ? hideLabel : showLabel}
              aria-pressed={shown}
              onClick={toggleVisibility}
            >
              {shown ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
        <FieldMessage controlId={controlId} error={error} hint={hint} />
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";
