export function Cargando({ texto = "Cargando tus datos…" }: { texto?: string }) {
  return (
    <div className="tarjeta animate-pulse text-apagado" role="status">
      {texto}
    </div>
  );
}
