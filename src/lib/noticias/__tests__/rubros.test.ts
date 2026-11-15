import { describe, expect, it } from "vitest";
import { leerRss } from "../rss";
import { RUBROS, esRubro, rubroPorId, seleccionarParaRubro, separarMedio, urlGoogleNoticias } from "../rubros";
import type { Noticia } from "../tipos";

const ahora = new Date("2026-11-15T15:00:00Z");
const nota = (titulo: string, horas = 2, resumen = "", fuente = "Ámbito"): Noticia => ({
  titulo,
  resumen,
  fuente,
  enlace: `https://ejemplo.com/${encodeURIComponent(titulo)}`,
  fecha: new Date(ahora.getTime() - horas * 3_600_000).toISOString(),
});

describe("rubros", () => {
  it("hay seis rubros con id válido", () => {
    expect(RUBROS).toHaveLength(6);
    expect(RUBROS.every((r) => esRubro(r.id))).toBe(true);
    expect(esRubro("otro")).toBe(false);
  });

  it("elige las notas que nombran el rubro y descarta las que no", () => {
    const tec = rubroPorId("tecnologia");
    const elegidas = seleccionarParaRubro(
      [
        nota("Bajan los aranceles para importar celulares y notebooks"),
        nota("Suben las ventas de autos usados"),
        nota("El dólar mayorista cerró estable"),
      ],
      tec,
      ahora,
    );
    expect(elegidas.map((n) => n.titulo)).toEqual(["Bajan los aranceles para importar celulares y notebooks"]);
    expect(elegidas[0].categoria).toBe("importaciones");
  });

  it("ordena por relevancia, deja afuera las viejas y no repite la misma nota entre medios", () => {
    const textil = rubroPorId("textil");
    const elegidas = seleccionarParaRubro(
      [
        nota("La industria textil pide frenar importaciones de ropa", 5),
        nota("Industria textil pide frenar las importaciones de ropa china", 3, "", "Infobae"),
        nota("Feria de moda en Palermo", 1),
        nota("Calzado: caen las ventas", 24 * 9),
      ],
      textil,
      ahora,
    );
    expect(elegidas).toHaveLength(2);
    expect(elegidas[0].titulo).toContain("textil");
    expect(elegidas[0].tambienEn).toEqual(["Ámbito"]);
    expect(elegidas.some((n) => n.titulo.startsWith("Calzado"))).toBe(false);
  });

  it("separa el medio del título de Google Noticias", () => {
    const xml = `<rss><channel><item><title>Bajan aranceles a la electrónica - Ámbito</title><link>https://news.google.com/x</link><pubDate>Sun, 15 Nov 2026 12:00:00 GMT</pubDate><description>x</description></item></channel></rss>`;
    const [n] = leerRss(xml, "Google Noticias").map(separarMedio);
    expect(n.titulo).toBe("Bajan aranceles a la electrónica");
    expect(n.fuente).toBe("Ámbito");
  });

  it("arma la búsqueda de Google Noticias en español de Argentina", () => {
    const u = urlGoogleNoticias(rubroPorId("salud"));
    expect(u).toMatch(/^https:\/\/news\.google\.com\/rss\/search\?q=/);
    expect(u).toContain("ceid=AR%3Aes-419".replace("%3A", ":"));
  });
});
