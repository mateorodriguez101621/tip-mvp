import { describe, expect, it } from "vitest";
import { clasificar, mismaNoticia, palabrasClave, seleccionarNoticias, VENTANA_HORAS } from "../clasificacion";
import { diferencia, leerCotizaciones, leerInflacion, leerPlazoFijo, leerRiesgoPais, nombrePropio } from "../indicadores";
import { leerRss, recortar, textoPlano } from "../rss";
import type { Noticia } from "../tipos";

const AHORA = new Date("2026-11-02T15:00:00Z");

function noticia(titulo: string, extra: Partial<Noticia> = {}): Noticia {
  return { titulo, enlace: `https://medio.com/${encodeURIComponent(titulo)}`, fecha: "2026-11-02T12:00:00.000Z", resumen: "", fuente: "Medio", ...extra };
}

describe("lectura de RSS", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>Economía</title>
    <item><title><![CDATA[Aduana: nuevas reglas para &quot;courier&quot;]]></title><link>https://a.com/1</link>
      <pubDate>Mon, 02 Nov 2026 11:37:00 -0300</pubDate><description><![CDATA[<p>Cambia el <b>límite</b> por envío.</p>]]></description></item>
    <item><title>Sin enlace</title><pubDate>Mon, 02 Nov 2026 11:37:00 -0300</pubDate></item>
    <item><title>Enlace peligroso</title><link>javascript:alert(1)</link><pubDate>Mon, 02 Nov 2026 11:37:00 -0300</pubDate></item>
    <item><title>Fecha rota</title><link>https://a.com/3</link><pubDate>ayer</pubDate></item>
    <item><title><![CDATA[Guerra, tasas y riesgo país]]]]></title><link>https://a.com/4</link><pubDate>Mon, 02 Nov 2026 05:41:19 +0000</pubDate></item>
  </channel></rss>`;

  it("toma título, enlace, fecha y resumen en texto plano", () => {
    const [n] = leerRss(xml, "Ámbito");
    expect(n).toEqual({
      titulo: 'Aduana: nuevas reglas para "courier"',
      enlace: "https://a.com/1",
      fecha: "2026-11-02T14:37:00.000Z",
      resumen: "Cambia el límite por envío.",
      fuente: "Ámbito",
    });
  });

  it("descarta ítems sin enlace http(s) o con fecha inválida", () => {
    expect(leerRss(xml, "X").map((n) => n.titulo)).toEqual(['Aduana: nuevas reglas para "courier"', "Guerra, tasas y riesgo país"]);
  });

  it("un feed vacío o que no es RSS no devuelve nada", () => {
    expect(leerRss("", "X")).toEqual([]);
    expect(leerRss("<html><body>404</body></html>", "X")).toEqual([]);
  });

  it("saca los scripts de analítica que algunos medios meten en la descripción", () => {
    const sucio = `Retoman las negociaciones en enero <iframe width="0"><script>(function(i,s){ga('create')})(window)</script></iframe>`;
    expect(textoPlano(`<![CDATA[${sucio}]]>`)).toBe("Retoman las negociaciones en enero");
    expect(textoPlano("Texto &lt;script&gt;ga('x')&lt;/script&gt; final")).toBe("Texto final");
  });

  it("decodifica entidades numéricas y HTML escapado", () => {
    expect(textoPlano("Caf&#233; &#x26; &lt;b&gt;t&eacute;&lt;/b&gt;")).toBe("Café & té");
  });

  it("recorta en una palabra entera", () => {
    expect(recortar("uno dos tres cuatro", 12)).toBe("uno dos…");
    expect(recortar("corto", 12)).toBe("corto");
  });
});

describe("clasificación", () => {
  it.each([
    ["EEUU y Canadá se acercan a un acuerdo para poner fin a la guerra de aranceles", "importaciones"],
    ["Las importaciones cayeron 12% en septiembre por la menor actividad", "importaciones"],
    ["El Gobierno enfrenta un pago de u$s800 millones al FMI y evalúa comprarle dólares al BCRA", "dolar"],
    ["El agro liquidó USD 2.880 millones en octubre, el mejor registro para ese mes en 25 años", "dolar"],
    ["Colectivos: ARBA reglamentó la exención del Impuesto Automotor", "impuestos"],
    ["Retenciones de IVA: ARCA cambia el régimen para importadores", "impuestos"],
    ["Pymes y facturas de crédito electrónicas: extienden un plazo clave hasta 2027", "tasas"],
    ["Qué esperan las consultoras privadas para el dato de inflación de octubre", "tasas"],
    ["Plazo fijo: cuánto pagan los principales bancos por depósitos a 30 días", "tasas"],
    ["La caída de la industria: baja demanda interna y sueldos en dólares altos", "actividad"],
  ])("%s → %s", (titulo, categoria) => {
    expect(clasificar({ titulo, resumen: "" })?.categoria).toBe(categoria);
  });

  it.each([
    "Dólar blue hoy: a cuánto opera este lunes 2 de noviembre",
    "Calendario AUH de Anses: cuándo se cobra la Asignación Universal por Hijo",
    "Cyber Monday 2026: a qué hora empieza y qué ofertas habrá",
    "Hackeo a Binance: la empresa recuperó los fondos",
    "Salarios: cuánto cobrarán los empleados de Comercio en noviembre",
    "Dormir como los reyes: el hotel oculto en el Palacio de Versalles",
    "Euro hoy en Uruguay: precio y cotización de la divisa",
    "Empleados bancarios cobrarán super bono esta semana, que se actualizarán con la inflación",
    "50 gremios denunciarán judicialmente a Caputo por retención de fondos de obras sociales",
  ])("descarta lo que no sirve para decidir: %s", (titulo) => {
    expect(clasificar({ titulo, resumen: "" })).toBeNull();
  });

  it("el resumen solo no alcanza con una palabra suelta, pero sí con varias", () => {
    expect(clasificar({ titulo: "Una nota cualquiera", resumen: "Habló del dólar." })).toBeNull();
    expect(clasificar({ titulo: "Una nota cualquiera", resumen: "El BCRA compró reservas y el dólar bajó." })?.categoria).toBe("dolar");
  });

  it("no confunde palabras parecidas", () => {
    expect(clasificar({ titulo: "Lo más importante de la semana", resumen: "" })).toBeNull();
  });
});

describe("selección de noticias", () => {
  it("reconoce la misma nota en distintos medios", () => {
    const a = palabrasClave("El agro liquidó USD 2.880 millones en octubre, el mejor registro para ese mes en 25 años");
    const b = palabrasClave("Récord: la agroexportación registró el mejor octubre de los últimos 25 años con US$2880 millones");
    const c = palabrasClave("Plazo fijo: cuánto pagan los principales bancos por depósitos a 30 días");
    expect(mismaNoticia(a, b)).toBe(true);
    expect(mismaNoticia(a, c)).toBe(false);
  });

  it("deja la más nueva, anota los otros medios y ordena por fecha", () => {
    const r = seleccionarNoticias(
      [
        noticia("El agro liquidó USD 2.880 millones en octubre, el mejor registro en 25 años", { fuente: "Infobae", fecha: "2026-11-02T14:00:00.000Z" }),
        noticia("Récord: el agro liquidó el mejor octubre en 25 años con US$2880 millones", { fuente: "La Nación", fecha: "2026-11-02T11:00:00.000Z" }),
        noticia("Suben los aranceles para importar insumos", { fuente: "Ámbito", fecha: "2026-11-02T13:00:00.000Z" }),
      ],
      AHORA,
    );
    expect(r.map((n) => n.fuente)).toEqual(["Infobae", "Ámbito"]);
    expect(r[0].tambienEn).toEqual(["La Nación"]);
  });

  it(`descarta las de más de ${VENTANA_HORAS} horas, las de fecha futura y los enlaces repetidos`, () => {
    const vieja = noticia("Suben los aranceles", { fecha: "2026-10-30T12:00:00.000Z" });
    const futura = noticia("Bajan los aranceles", { fecha: "2026-12-01T11:41:00.000Z" });
    const a = noticia("Cambios en la aduana para importadores", { enlace: "https://a.com/x" });
    const b = noticia("Reservas del BCRA: el dólar mayorista baja", { enlace: "https://a.com/x" });
    expect(seleccionarNoticias([vieja, futura, a, b], AHORA).map((n) => n.titulo)).toEqual([a.titulo]);
  });

  it("sin noticias devuelve una lista vacía", () => {
    expect(seleccionarNoticias([], AHORA)).toEqual([]);
  });
});

describe("indicadores", () => {
  it("lee las cotizaciones y la última actualización", () => {
    const c = leerCotizaciones([
      { casa: "oficial", venta: 1565, fechaActualizacion: "2026-11-02T11:00:00.000Z" },
      { casa: "mayorista", venta: 1543, fechaActualizacion: "2026-11-02T10:49:00.000Z" },
      { casa: "bolsa", venta: 1568.7, fechaActualizacion: "2026-11-02T13:58:00.000Z" },
      { casa: "blue", venta: 0 },
    ]);
    expect(c).toEqual({ oficial: 1565, mayorista: 1543, mep: 1568.7, ccl: null, actualizado: "2026-11-02T13:58:00.000Z" });
  });

  it("ignora respuestas con otro formato", () => {
    expect(leerCotizaciones({ error: "x" })).toBeNull();
    expect(leerCotizaciones([{ casa: "oficial", venta: "mucho" }])).toBeNull();
    expect(leerRiesgoPais(null)).toBeNull();
    expect(leerInflacion([])).toBeNull();
    expect(leerPlazoFijo("x")).toBeNull();
  });

  it("riesgo país", () => {
    expect(leerRiesgoPais({ valor: 787, fecha: "2026-10-30" })).toEqual({ valor: 787, fecha: "2026-10-30" });
  });

  it("inflación del último mes e interanual compuesta", () => {
    const serie = Array.from({ length: 13 }, (_, i) => ({ fecha: `2026-${String((i % 12) + 1).padStart(2, "0")}-28`, valor: 1 }));
    serie[12] = { fecha: "2027-01-31", valor: 2 };
    const r = leerInflacion(serie)!;
    expect(r.mes).toBe("2027-01");
    expect(r.mensual).toBe(2);
    expect(r.interanual).toBeCloseTo((1.01 ** 11 * 1.02 - 1) * 100, 6);
    expect(leerInflacion([{ fecha: "2026-09-30", valor: 1.9 }])).toEqual({ mes: "2026-09", mensual: 1.9, interanual: null });
  });

  it("mejor plazo fijo para clientes", () => {
    const r = leerPlazoFijo([
      { entidad: "BANCO DE LA NACION ARGENTINA", tnaClientes: 0.1925 },
      { entidad: "BANCO DEL SOL", tnaClientes: 0.28 },
      { entidad: "SIN TASA", tnaClientes: 0 },
    ])!;
    expect(r.tna).toBeCloseTo(28);
    expect(r.banco).toBe("Banco del Sol");
  });

  it("nombres propios y diferencias", () => {
    expect(nombrePropio("BANCO DE LA NACION ARGENTINA")).toBe("Banco de la Nacion Argentina");
    expect(nombrePropio("BANCO BICA S.A.")).toBe("Banco Bica S.A.");
    expect(diferencia(1100, 1000)).toBeCloseTo(0.1);
  });
});
