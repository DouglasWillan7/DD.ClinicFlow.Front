import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;
    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={inputId}>{label}</label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
        {error ? (
          <small id={`${inputId}-error`} className={styles.error}>
            {error}
          </small>
        ) : hint ? (
          <small id={`${inputId}-hint`}>{hint}</small>
        ) : null}
      </div>
    );
  },
);

Field.displayName = "Field";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, id, className, children, ...props }, ref) => {
    const selectId = id ?? props.name;
    const describedBy = error
      ? `${selectId}-error`
      : hint
        ? `${selectId}-hint`
        : undefined;
    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={selectId}>{label}</label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <small id={`${selectId}-error`} className={styles.error}>
            {error}
          </small>
        ) : hint ? (
          <small id={`${selectId}-hint`}>{hint}</small>
        ) : null}
      </div>
    );
  },
);

SelectField.displayName = "SelectField";
