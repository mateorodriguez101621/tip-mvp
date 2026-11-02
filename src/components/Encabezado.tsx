"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SECCIONES = [
  { href: "/panel", texto: "Panel" },
  { href: "/datos", texto: "Datos" },
  { href: "/escenarios", texto: "Escenarios" },
  { href: "/noticias", texto: "Noticias" },
];

export function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={38} height={38} />
      <div>
        <b className="block text-[26px] leading-none tracking-tight text-violeta">TIP</b>
        <span className="block text-xs italic text-apagado">Tesorería inteligente para PyMEs</span>
      </div>
    </div>
  );
}

export function Encabezado({ derecha }: { derecha?: ReactNode }) {
  const ruta = usePathname();
  return (
    <header className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-7">
      <Marca />
      <div className="order-3 flex w-full items-center justify-between gap-2 sm:order-none sm:w-auto">
        <nav className="flex gap-1.5" aria-label="Secciones">
          {SECCIONES.map((s) => {
            const activa = ruta.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 font-semibold transition-colors ${
                  activa ? "bg-violeta text-white" : "text-apagado hover:bg-white/60"
                }`}
              >
                {s.texto}
              </Link>
            );
          })}
        </nav>
      </div>
      {derecha && <div className="flex items-center gap-2">{derecha}</div>}
    </header>
  );
}
