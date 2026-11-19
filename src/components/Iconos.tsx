import type { SVGProps } from "react";

// Íconos de trazo simple, 24×24. Heredan el color del texto.
function Base({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      {children}
    </svg>
  );
}

export const IconoCaja = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    <path d="M17 13h.01" />
  </Base>
);

export const IconoBaja = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m22 17-8.5-8.5-5 5L2 7" />
    <path d="M16 17h6v-6" />
  </Base>
);

export const IconoSube = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </Base>
);

export const IconoDolar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 2v20" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Base>
);

export const IconoRecibo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 2V2l-2 2-3-2-3 2-3-2-3 2z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Base>
);

export const IconoEntra = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M17 7 7 17" />
    <path d="M17 17H7V7" />
  </Base>
);

export const IconoSale = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </Base>
);

export const IconoRepite = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Base>
);
