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
      <img src="/logo.svg" alt="" width={36} height={36} />
      <div>
        <b className="block text-[22px] leading-none font-bold tracking-tight text-violeta">TIP</b>
        <span className="block text-[11px] text-apagado">Tesorería inteligente para PyMEs</span>
      </div>
    </div>
  );
}

export function Encabezado({ derecha }: { derecha?: ReactNode }) {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-20 mb-4 border-b border-white/60 bg-[#f5f2fb]/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Marca />
        <nav
          className="order-3 flex w-full gap-1 overflow-x-auto rounded-full border border-linea bg-white/80 p-1 shadow-sm sm:order-none sm:w-auto"
          aria-label="Secciones"
        >
          {SECCIONES.map((s) => {
            const activa = ruta.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`flex-1 rounded-full px-2.5 py-1.5 text-center font-semibold whitespace-nowrap transition-colors sm:flex-none sm:px-3.5 ${
                  activa ? "bg-violeta text-white shadow-sm" : "text-apagado hover:bg-lavanda hover:text-violeta-oscuro"
                }`}
              >
                {s.texto}
              </Link>
            );
          })}
        </nav>
        {derecha && <div className="flex items-center gap-2">{derecha}</div>}
      </div>
    </header>
  );
}
