import type { Categoria, Noticia, NoticiaClasificada } from "./tipos";

/** En empate de puntaje gana la que aparece primero. */
export const ORDEN: Categoria[] = ["importaciones", "dolar", "impuestos", "tasas", "actividad"];

export const CATEGORIAS: Record<Categoria, { nombre: string; porque: string }> = {
  importaciones: {
    nombre: "Importaciones",
    porque: "Cambios en aranceles, licencias, la aduana o los fletes mueven el costo y los plazos de tus compras al exterior.",
  },
  dolar: {
    nombre: "Dólar y BCRA",
    porque: "El tipo de cambio define cuántos pesos vas a necesitar para pagarles a tus proveedores del exterior.",
  },
  impuestos: {
    nombre: "Impuestos",
    porque: "Vencimientos, retenciones y regímenes nuevos cambian cuánto y cuándo le pagás al fisco.",
  },
  tasas: {
    nombre: "Tasas e inflación",
    porque: "Definen cuánto te cuesta un crédito si te falta caja y cuánto rinde lo que te sobra.",
  },
  actividad: {
    nombre: "Actividad",
    porque: "Anticipan si tus clientes van a comprar más o menos, y si te van a pagar a tiempo.",
  },
};

// Patrones sobre texto normalizado (minúsculas, sin tildes).
const PALABRAS: Record<Categoria, RegExp[]> = {
  importaciones: [
    /\bimporta(cion|ciones|dor|dores|dora|doras|r|n)\b/,
    /\baduan/,
    /\barancel/,
    /\bcomercio exterior\b/,
    /\bcomex\b/,
    /\bcontenedor/,
    /\bflete/,
    /\bpuertos?\b/,
    /\bcourier\b/,
    /\bmercosur\b/,
    /\bbalanza comercial\b/,
    /\bexporta(cion|ciones|dor|dores|doras|r)\b/,
    /\blicencias? (no automaticas|de importacion)\b/,
  ],
  dolar: [
    /\bdolar(es)?\b/,
    /\btipo de cambio\b/,
    /\bcambiari[oa]s?\b/,
    /\bbcra\b/,
    /\bbanco central\b/,
    /\breservas\b/,
    /\bdevalua/,
    /\bfmi\b/,
    /\briesgo pais\b/,
    /\bcepo\b/,
    /\bliquid(o|aron|acion)\b/,
    /\b(apreci|depreci)a/,
  ],
  impuestos: [
    /\barca\b/,
    /\bafip\b/,
    /\biva\b/,
    /\bingresos brutos\b/,
    /\bimpuest/,
    /\bretenciones\b/, // en singular suele ser "retención de fondos", no un impuesto
    /\bpercepcion/,
    /\bmonotribut/,
    /\bfacturas? de credito electronica/,
    /\btributari/,
    /\bfiscal/,
    /\barba\b/,
    /\bagip\b/,
  ],
  tasas: [
    /\binflacion/,
    /\bipc\b/,
    /\bindec\b/,
    /\btasas?\b/,
    /\bplazos? fijos?\b/,
    /\blecaps?\b/,
    /\bcaucion/,
    /\bcreditos?\b/,
    /\bfinanciamiento/,
    /\bprestamos?\b/,
    /\bpymes?\b/,
    /\bcarry trade\b/,
  ],
  actividad: [
    /\bindustri/,
    /\buia\b/,
    /\bactividad\b/,
    /\brecesion/,
    /\bconsumo\b/,
    /\bventas\b/,
    /\bpbi\b/,
    /\bcrec(e|en|io|ieron|imiento|era|eria)\b/,
    /\bempleo\b/,
    /\bdemanda\b/,
    /\bparitaria/,
    /\bmorosidad/,
    /\bcheques? rechazados?\b/,
  ],
};

// Títulos que hablan de economía pero no ayudan a decidir a una PyME.
const EXCLUIR: RegExp[] = [
  /\banses\b/,
  /\bjubila/,
  /\bauh\b/,
  /\basignacion(es)? (universal|familiar)/,
  /\bpensiones\b/,
  /\bpuam\b/,
  /\bsuaf\b/,
  /\bcyber ?monday\b/,
  /\bblack friday\b/,
  /\bhot sale\b/,
  /\bbitcoin\b/,
  /\bbinance\b/,
  /\bcripto/,
  /\beuro hoy\b/,
  /\boutlet\b/,
  /\bdescuentos?\b/,
  /\bpromociones\b/,
  /\bofertas\b/,
  /\bdolar blue hoy\b/,
  /\ba cuanto (cotiza|opera)\b/,
  /\bminuto a minuto\b/,
  /\bcuanto cobr/,
  /\bcobrar(a|an)\b/,
];

/** Pesos de cada coincidencia: el título dice de qué trata la nota; el resumen solo suma. */
const PESO_TITULO = 3;
const PESO_RESUMEN = 1;
/** Hace falta al menos una coincidencia en el título, o tres en el resumen. */
export const PUNTAJE_MINIMO = 3;

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const coincidencias = (texto: string, patrones: RegExp[]) =>
  patrones.reduce((n, p) => n + (p.test(texto) ? 1 : 0), 0);

/** La categoría con más puntaje, o null si la noticia no es relevante para una PyME importadora. */
export function clasificar(n: Pick<Noticia, "titulo" | "resumen">): { categoria: Categoria; puntaje: number } | null {
  const titulo = normalizar(n.titulo);
  if (EXCLUIR.some((p) => p.test(titulo))) return null;
  const resumen = normalizar(n.resumen);
  let mejor: { categoria: Categoria; puntaje: number } | null = null;
  for (const categoria of ORDEN) {
    const puntaje =
      PESO_TITULO * coincidencias(titulo, PALABRAS[categoria]) + PESO_RESUMEN * coincidencias(resumen, PALABRAS[categoria]);
    if (puntaje >= PUNTAJE_MINIMO && (!mejor || puntaje > mejor.puntaje)) mejor = { categoria, puntaje };
  }
  return mejor;
}

const VACIAS = new Set([
  "para", "como", "cuanto", "cuando", "desde", "este", "esta", "estos", "sobre", "entre", "tras", "hasta",
  "porque", "pero", "todo", "todos", "hace", "segun", "ante", "cual", "cuales", "donde", "quien", "quienes",
]);

/** Palabras significativas de un título, para reconocer la misma noticia en distintos medios. */
export function palabrasClave(titulo: string): Set<string> {
  const t = normalizar(titulo).replace(/(\d)[.,](?=\d)/g, "$1"); // "2.880" y "2880" son lo mismo
  return new Set(t.split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !VACIAS.has(p)));
}

/** Dos títulos cuentan la misma noticia si comparten al menos tres palabras y la mitad de las del más corto. */
export function mismaNoticia(a: Set<string>, b: Set<string>): boolean {
  let comunes = 0;
  for (const p of a) if (b.has(p)) comunes++;
  return comunes >= 3 && comunes / Math.min(a.size, b.size) >= 0.5;
}

export const VENTANA_HORAS = 48;
export const MAX_NOTICIAS = 40;
const HORA_MS = 3_600_000;

/**
 * Las noticias relevantes de las últimas 48 horas, de la más nueva a la más vieja,
 * sin repetir la misma nota publicada por varios medios.
 */
export function seleccionarNoticias(noticias: Noticia[], ahora: Date): NoticiaClasificada[] {
  const desde = ahora.getTime() - VENTANA_HORAS * HORA_MS;
  // Una hora de tolerancia por relojes adelantados; más que eso es una fecha mal cargada.
  const hasta = ahora.getTime() + HORA_MS;
  const candidatas = noticias
    .filter((n) => {
      const t = Date.parse(n.fecha);
      return t >= desde && t <= hasta;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const elegidas: NoticiaClasificada[] = [];
  const claves: Set<string>[] = [];
  const enlaces = new Set<string>();
  for (const n of candidatas) {
    if (enlaces.has(n.enlace)) continue;
    const c = clasificar(n);
    if (!c) continue;
    const propias = palabrasClave(n.titulo);
    const i = claves.findIndex((k) => mismaNoticia(k, propias));
    if (i >= 0) {
      const igual = elegidas[i];
      if (igual.fuente !== n.fuente && !igual.tambienEn.includes(n.fuente)) igual.tambienEn.push(n.fuente);
      continue;
    }
    enlaces.add(n.enlace);
    elegidas.push({ ...n, ...c, tambienEn: [] });
    claves.push(propias);
  }
  return elegidas.slice(0, MAX_NOTICIAS);
}
