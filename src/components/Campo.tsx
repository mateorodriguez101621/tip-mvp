import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Campo({
  etiqueta,
  error,
  ayuda,
  ...props
}: { etiqueta: ReactNode; error?: string; ayuda?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const idError = props.id ? `${props.id}-error` : undefined;
  return (
    <label className="etiqueta">
      {etiqueta}
      <input className="campo" aria-invalid={error ? true : undefined} aria-describedby={error ? idError : undefined} {...props} />
      {error ? (
        <span className="error-campo block" id={idError} role="alert">{error}</span>
      ) : ayuda ? (
        <span className="mt-0.5 block text-[11px]">{ayuda}</span>
      ) : null}
    </label>
  );
}

export function Selector({
  etiqueta,
  error,
  children,
  ...props
}: { etiqueta: ReactNode; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="etiqueta">
      {etiqueta}
      <select className="campo" aria-invalid={error ? true : undefined} {...props}>
        {children}
      </select>
      {error && <span className="error-campo block" role="alert">{error}</span>}
    </label>
  );
}
