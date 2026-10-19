"use client";

/** Botão de ação destrutiva: pede confirmação antes de enviar o formulário. */
export function ConfirmButton({ message, children, className = "btn btn-danger", ...rest }: { message: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); rest.onClick?.(e); }}>
      {children}
    </button>
  );
}
