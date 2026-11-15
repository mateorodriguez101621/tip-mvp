// Rubros de importación: el usuario elige el suyo y ve primero las noticias que lo afectan.
// Este módulo no depende de React ni de Next.

import { clasificar, mismaNoticia, normalizar, palabrasClave } from "./clasificacion";
import type { Categoria, Noticia } from "./tipos";

export type IdRubro = "tecnologia" | "autopartes" | "textil" | "alimentos" | "maquinaria" | "salud";

export interface Rubro {
  id: IdRubro;
  nombre: string;
  /** Qué importa típicamente una PyME del rubro, para el texto de ayuda. */
  ejemplos: string;
  /** Búsqueda para el feed de Google Noticias (se le suma "importación" y la ventana de días). */
  busqueda: string;
  palabras: RegExp[];
}

export const RUBROS: Rubro[] = [
  {
    id: "tecnologia",
    nombre: "Tecnología y seguridad electrónica",
    ejemplos: "Celulares, computadoras, cámaras, alarmas, componentes",
    busqueda: "(electrónica OR tecnología OR celulares OR computadoras OR \"seguridad electrónica\")",
    palabras: [
      /\belectronic/, /\btecnolog/, /\bcelular/, /\bsmartphones?\b/, /\bnotebooks?\b/, /\bcomputadora/,
      /\bsemiconductor/, /\bchips?\b/, /\btierra del fuego\b/, /\btelevisor/, /\bcamaras?\b/, /\balarmas?\b/,
      /\bseguridad electronica\b/, /\bconsolas?\b/, /\bcomponentes\b/,
    ],
  },
  {
    id: "autopartes",
    nombre: "Autopartes y automotor",
    ejemplos: "Repuestos, neumáticos, accesorios, vehículos",
    busqueda: "(autopartes OR automotriz OR neumáticos OR \"sector automotor\")",
    palabras: [
      /\bautopart/, /\bautomotri/, /\bautomotor/, /\bneumatic/, /\brepuestos?\b/, /\bvehicul/, /\bconcesionari/,
      /\bpatentamiento/, /\bterminales automotrices\b/, /\bautos?\b/, /\bmotos?\b/,
    ],
  },
  {
    id: "textil",
    nombre: "Textil e indumentaria",
    ejemplos: "Telas, hilados, ropa, calzado",
    busqueda: "(textil OR indumentaria OR calzado OR telas)",
    palabras: [/\btextil/, /\bindumentaria\b/, /\bropa\b/, /\bcalzado/, /\bhilados?\b/, /\btelas?\b/, /\bconfeccion/, /\bmoda\b/, /\bzapatillas\b/],
  },
  {
    id: "alimentos",
    nombre: "Alimentos y bebidas",
    ejemplos: "Insumos alimenticios, café, bebidas, envases",
    busqueda: "(alimentos OR bebidas OR \"industria alimenticia\")",
    palabras: [
      /\baliment/, /\bbebidas?\b/, /\bagroaliment/, /\bcafe\b/, /\bcacao\b/, /\bgolosinas?\b/, /\bsupermercados?\b/,
      /\bcanasta basica\b/, /\benvases?\b/, /\bfrigorific/, /\blacteos?\b/,
    ],
  },
  {
    id: "maquinaria",
    nombre: "Maquinaria e insumos industriales",
    ejemplos: "Bienes de capital, herramientas, acero, plásticos",
    busqueda: "(\"bienes de capital\" OR maquinaria OR insumos industriales OR acero)",
    palabras: [
      /\bmaquinaria/, /\bbienes de capital\b/, /\bmaquinas?\b/, /\bherramientas?\b/, /\bmetalmecanic/, /\bacero\b/,
      /\bsiderurg/, /\bplasticos?\b/, /\binsumos industriales\b/, /\bquimic/, /\bindustria\b/,
    ],
  },
  {
    id: "salud",
    nombre: "Salud y farmacia",
    ejemplos: "Medicamentos, insumos y equipos médicos",
    busqueda: "(medicamentos OR farmacéutica OR \"insumos médicos\" OR \"equipamiento médico\")",
    palabras: [
      /\bfarmac/, /\bmedicament/, /\binsumos medicos\b/, /\bequip(os|amiento) medic/, /\blaboratorios?\b/, /\banmat\b/,
      /\bsalud\b/, /\bprepagas?\b/, /\bclinicas?\b/,
    ],
  },
];

export const esRubro = (x: unknown): x is IdRubro => RUBROS.some((r) => r.id === x);
export const rubroPorId = (id: IdRubro) => RUBROS.find((r) => r.id === id)!;

/** Feed RSS de Google Noticias para el rubro: notas de los últimos 7 días sobre importación en ese sector. */
export function urlGoogleNoticias(r: Rubro): string {
  const q = `${r.busqueda} (importación OR importaciones OR aranceles OR dólar) when:7d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=AR&ceid=AR:es-419`;
}

/** Google Noticias pone el medio al final del título ("Título - Medio"): lo separa. */
export function separarMedio(n: Noticia): Noticia {
  const m = n.titulo.match(/^(.*\S)\s+-\s+([^-]{2,40})$/);
  return m ? { ...n, titulo: m[1], fuente: m[2].trim() } : n;
}

export interface NoticiaRubro extends Noticia {
  puntaje: number;
  /** El tema general de la nota (dólar, importaciones…), si tiene uno. */
  categoria: Categoria | null;
  tambienEn: string[];
}

export const VENTANA_RUBRO_DIAS = 7;
export const MAX_NOTICIAS_RUBRO = 12;
const DIA_MS = 86_400_000;

const coincidencias = (texto: string, patrones: RegExp[]) => patrones.reduce((n, p) => n + (p.test(texto) ? 1 : 0), 0);

/** Qué tanto habla la nota del rubro: el título pesa el triple que el resumen. */
export function puntajeRubro(n: Pick<Noticia, "titulo" | "resumen">, r: Rubro): number {
  return 3 * coincidencias(normalizar(n.titulo), r.palabras) + coincidencias(normalizar(n.resumen), r.palabras);
}

/**
 * Las noticias más relevantes para el rubro: las que lo nombran en el título o varias veces en el
 * resumen, sumando un punto si además tratan un tema que mueve la caja (dólar, importaciones…).
 * Sin repetir la misma nota entre medios, de la más relevante a la menos.
 */
export function seleccionarParaRubro(noticias: Noticia[], r: Rubro, ahora: Date): NoticiaRubro[] {
  const desde = ahora.getTime() - VENTANA_RUBRO_DIAS * DIA_MS;
  const hasta = ahora.getTime() + 3_600_000;
  const candidatas: NoticiaRubro[] = [];
  for (const n of noticias) {
    const t = Date.parse(n.fecha);
    if (!(t >= desde && t <= hasta)) continue;
    const p = puntajeRubro(n, r);
    if (p < 3) continue;
    const tema = clasificar(n);
    candidatas.push({ ...n, puntaje: p + (tema ? 2 : 0), categoria: tema?.categoria ?? null, tambienEn: [] });
  }
  candidatas.sort((a, b) => b.puntaje - a.puntaje || b.fecha.localeCompare(a.fecha));

  const elegidas: NoticiaRubro[] = [];
  const claves: Set<string>[] = [];
  const enlaces = new Set<string>();
  for (const n of candidatas) {
    if (enlaces.has(n.enlace)) continue;
    const propias = palabrasClave(n.titulo);
    const i = claves.findIndex((k) => mismaNoticia(k, propias));
    if (i >= 0) {
      const igual = elegidas[i];
      if (igual.fuente !== n.fuente && !igual.tambienEn.includes(n.fuente)) igual.tambienEn.push(n.fuente);
      continue;
    }
    enlaces.add(n.enlace);
    elegidas.push(n);
    claves.push(propias);
    if (elegidas.length >= MAX_NOTICIAS_RUBRO) break;
  }
  return elegidas;
}
