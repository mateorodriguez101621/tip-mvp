import "server-only";
import { seleccionarNoticias } from "./clasificacion";
import { leerCotizaciones, leerInflacion, leerPlazoFijo, leerRiesgoPais } from "./indicadores";
import { leerRss } from "./rss";
import { rubroPorId, seleccionarParaRubro, separarMedio, urlGoogleNoticias, type IdRubro } from "./rubros";
import type { ContextoDelDia, Indicadores } from "./tipos";

// Los feeds de economía de cada medio: titulares y enlaces que los diarios publican para ser
// leídos por terceros. TIP solo los filtra y ordena; el lector abre la nota en el medio.
export const FEEDS = [
  { fuente: "Ámbito", url: "https://www.ambito.com/rss/pages/economia.xml" },
  { fuente: "Ámbito", url: "https://www.ambito.com/rss/pages/finanzas.xml" },
  { fuente: "Infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/" },
  { fuente: "La Nación", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/" },
  { fuente: "iProfesional", url: "https://www.iprofesional.com/rss/economia" },
  { fuente: "Clarín", url: "https://www.clarin.com/rss/economia/" },
];

const API_DOLAR = "https://dolarapi.com/v1/dolares";
const API_RIESGO_PAIS = "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo";
const API_INFLACION = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";
const API_PLAZO_FIJO = "https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo";

// Cada cuánto se vuelve a pedir cada dato, en segundos. Mientras tanto se sirve del caché.
const CADA_NOTICIAS = 30 * 60;
const CADA_DOLAR = 15 * 60;
const CADA_INDICES = 6 * 60 * 60;
const ESPERA_MS = 8000;

async function traer(url: string, revalidate: number): Promise<Response> {
  const r = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(ESPERA_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TIP/0.1)" },
  });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r;
}

async function json(url: string, revalidate: number): Promise<unknown> {
  return (await traer(url, revalidate)).json();
}

/** El resultado, o null si falló (queda registrado en el log del servidor). */
async function intentar<T>(promesa: Promise<T>, nombre: string): Promise<T | null> {
  try {
    return await promesa;
  } catch (e) {
    console.warn(`Noticias: no se pudo leer ${nombre}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Noticias e indicadores del día y, si se pasa un rubro, las noticias más relevantes para ese rubro.
 * Nunca falla: lo que no responde se informa en `sinRespuesta`.
 */
export async function obtenerContextoDelDia(idRubro: IdRubro | null = null): Promise<ContextoDelDia> {
  const ahora = new Date();
  const rubro = idRubro ? rubroPorId(idRubro) : null;

  const [feeds, dolar, riesgo, inflacion, plazoFijo, delRubro] = await Promise.all([
    Promise.all(
      FEEDS.map((f) => intentar(traer(f.url, CADA_NOTICIAS).then(async (r) => leerRss(await r.text(), f.fuente)), f.url)),
    ),
    intentar(json(API_DOLAR, CADA_DOLAR), "cotizaciones"),
    intentar(json(API_RIESGO_PAIS, CADA_INDICES), "riesgo país"),
    intentar(json(API_INFLACION, CADA_INDICES), "inflación"),
    intentar(json(API_PLAZO_FIJO, CADA_INDICES), "plazo fijo"),
    rubro
      ? intentar(
          traer(urlGoogleNoticias(rubro), CADA_NOTICIAS).then(async (r) => leerRss(await r.text(), "Google Noticias").map(separarMedio)),
          `noticias de ${rubro.nombre}`,
        )
      : Promise.resolve(null),
  ]);

  // Un medio cuenta como caído solo si no respondió ninguno de sus feeds.
  const respondieron = new Set(FEEDS.filter((_, i) => feeds[i]).map((f) => f.fuente));
  const sinRespuesta = new Set(FEEDS.map((f) => f.fuente).filter((f) => !respondieron.has(f)));

  const indicadores: Indicadores = {
    dolar: leerCotizaciones(dolar),
    riesgoPais: leerRiesgoPais(riesgo),
    inflacion: leerInflacion(inflacion),
    plazoFijo: leerPlazoFijo(plazoFijo),
  };
  if (!indicadores.dolar) sinRespuesta.add("cotizaciones del dólar");
  if (!indicadores.riesgoPais) sinRespuesta.add("riesgo país");
  if (!indicadores.inflacion) sinRespuesta.add("inflación");
  if (!indicadores.plazoFijo) sinRespuesta.add("tasas de plazo fijo");

  const generales = feeds.flatMap((f) => f ?? []);
  if (rubro && !delRubro) sinRespuesta.add(`Google Noticias (${rubro.nombre})`);

  return {
    noticias: seleccionarNoticias(generales, ahora),
    // Las del rubro salen de Google Noticias y también de los feeds generales que lo nombran.
    rubro: rubro ? { id: rubro.id, noticias: seleccionarParaRubro([...(delRubro ?? []), ...generales], rubro, ahora) } : null,
    indicadores,
    sinRespuesta: [...sinRespuesta],
    generado: ahora.toISOString(),
  };
}
