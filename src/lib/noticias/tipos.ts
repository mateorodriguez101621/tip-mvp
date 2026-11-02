// Tipos de la sección Noticias. Este módulo no depende de React ni de Next.

export type Categoria = "importaciones" | "dolar" | "impuestos" | "tasas" | "actividad";

export interface Noticia {
  titulo: string;
  /** Siempre http(s). */
  enlace: string;
  /** Fecha de publicación, ISO 8601. */
  fecha: string;
  resumen: string;
  /** Nombre del medio. */
  fuente: string;
}

export interface NoticiaClasificada extends Noticia {
  categoria: Categoria;
  puntaje: number;
  /** Otros medios que publicaron la misma noticia. */
  tambienEn: string[];
}

export interface Cotizaciones {
  oficial: number | null;
  mayorista: number | null;
  mep: number | null;
  ccl: number | null;
  /** Última actualización informada por la fuente, ISO 8601. */
  actualizado: string | null;
}

export interface Indicadores {
  dolar: Cotizaciones | null;
  riesgoPais: { valor: number; fecha: string } | null;
  /** `mes` como aaaa-mm; `mensual` e `interanual` en %. */
  inflacion: { mes: string; mensual: number; interanual: number | null } | null;
  /** Mejor TNA para clientes a 30 días, en %. */
  plazoFijo: { tna: number; banco: string } | null;
}

export interface ContextoDelDia {
  noticias: NoticiaClasificada[];
  indicadores: Indicadores;
  /** Medios o indicadores que no respondieron. */
  sinRespuesta: string[];
  /** Momento en que se armó la página, ISO 8601. */
  generado: string;
}
