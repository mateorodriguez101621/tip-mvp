import type { Noticia } from "./tipos";

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  hellip: "…", ndash: "–", mdash: "—", deg: "°",
};

export function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : todo;
    }
    return ENTIDADES[e] ?? ENTIDADES[e.toLowerCase()] ?? todo;
  });
}

// Algunos medios meten scripts de analítica (dentro de un iframe) en la descripción.
const sinEtiquetas = (html: string) =>
  html.replace(/<(script|style|iframe)\b[\s\S]*?(<\/\1>|$)/gi, " ").replace(/<[^>]*>/g, " ");

/** Texto plano: sin CDATA ni HTML, con las entidades decodificadas y los espacios colapsados. */
export function textoPlano(crudo: string): string {
  const sinCdata = crudo.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return sinEtiquetas(decodificar(sinEtiquetas(sinCdata)))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\]+$/, ""); // algunos medios dejan "]]" sueltos al final del título
}

/** Corta en la última palabra entera antes de `max` caracteres. */
export function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf(" ", max - 1);
  return texto.slice(0, corte > 0 ? corte : max - 1).replace(/[\s,;:.]+$/, "") + "…";
}

function etiqueta(item: string, nombre: string): string {
  const m = item.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m ? textoPlano(m[1]) : "";
}

export const LARGO_RESUMEN = 220;

/** Lee los ítems de un feed RSS 2.0. Descarta los que no tienen título, enlace http(s) o fecha válida. */
export function leerRss(xml: string, fuente: string): Noticia[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const noticias: Noticia[] = [];
  for (const item of items) {
    const titulo = etiqueta(item, "title");
    const enlace = etiqueta(item, "link");
    const fecha = new Date(etiqueta(item, "pubDate"));
    if (!titulo || !/^https?:\/\//i.test(enlace) || Number.isNaN(fecha.getTime())) continue;
    noticias.push({
      titulo,
      enlace,
      fecha: fecha.toISOString(),
      resumen: recortar(etiqueta(item, "description"), LARGO_RESUMEN),
      fuente,
    });
  }
  return noticias;
}
