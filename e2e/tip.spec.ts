import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const CLAVE = "tip-datos-v2";
const EMPRESA = { nombre: "Empresa Test", cajaArs: 10_000_000, cajaUsd: 0, tipoCambio: 1450, devaluacionMensual: 2, saldoMinimo: 1_000_000 };

/** Arranca con datos fijos en el navegador (modo local). */
async function conDatos(page: Page, movimientos: unknown[] = []) {
  await page.addInitScript(
    ([clave, datos]) => {
      if (!sessionStorage.getItem("sembrado")) {
        localStorage.setItem(clave, datos);
        sessionStorage.setItem("sembrado", "1");
      }
    },
    [CLAVE, JSON.stringify({ empresa: EMPRESA, movimientos })] as const,
  );
}

const filas = (page: Page) => page.getByTestId("fila-movimiento");
const guardados = (page: Page) =>
  page.evaluate((c) => JSON.parse(localStorage.getItem(c) ?? "null")?.movimientos.length ?? 0, CLAVE);

test.describe("escritorio", () => {
  test.skip(({ isMobile }) => isMobile);

  test("con los datos de ejemplo, el panel avisa el faltante y recomienda", async ({ page }) => {
    await page.goto("/panel");
    await expect(page.getByText(/te van a faltar USD/)).toBeVisible();
    await expect(page.getByText(/para tu pago a Proveedor Hangzhou/)).toBeVisible();
    await expect(page.getByText(/Paga a tiempo el \d+% de las veces/).first()).toBeVisible();
  });

  test("sin movimientos: panel vacío, sin faltante y 0% de riesgo", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/panel");
    await expect(page.getByTestId("vacio")).toBeVisible();
    await expect(page.getByText("Tu caja cubre todos los compromisos")).toBeVisible();
    await expect(page.getByText(/ociosos durante los próximos 30 días/)).toBeVisible();
    await page.getByRole("link", { name: "Escenarios" }).click();
    await expect(page.getByTestId("probabilidad")).toHaveText("0%");
    await page.getByRole("link", { name: "Datos" }).click();
    await expect(page.getByTestId("sin-movimientos")).toBeVisible();
  });

  test("formulario vacío: muestra los errores y no guarda", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    await page.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(page.getByText("Escribí un concepto")).toBeVisible();
    await expect(page.getByText("Ingresá un monto.")).toBeVisible();
    await expect(page.getByText("Revisá los campos marcados.")).toBeVisible();
    expect(await guardados(page)).toBe(0);

    const empresa = page.getByRole("form", { name: "Empresa y supuestos" });
    await empresa.getByLabel("Empresa").fill("");
    await empresa.getByLabel("Tipo de cambio hoy").fill("");
    await empresa.getByRole("button", { name: "Guardar supuestos" }).click();
    await expect(page.getByText("Escribí el nombre de la empresa.")).toBeVisible();
    await expect(page.getByText("Ingresá el tipo de cambio.")).toBeVisible();
  });

  test("doble clic al guardar crea un solo movimiento", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    const form = page.getByRole("form", { name: "Nuevo movimiento" });
    await form.getByLabel("Tipo").selectOption("pago");
    await form.getByLabel(/concepto/).fill("Proveedor Ningbo");
    await form.getByLabel("Monto").fill("15000");
    await form.getByLabel("Moneda").selectOption("USD");
    await form.getByRole("button", { name: "Guardar movimiento" }).dblclick();
    await expect(page.getByText('Guardamos "Proveedor Ningbo".')).toBeVisible();
    await expect(filas(page)).toHaveCount(1);
    expect(await guardados(page)).toBe(1);
    await page.reload();
    await expect(filas(page)).toHaveCount(1);
  });

  test("fecha pasada: avisa, se guarda como vencido y se proyecta hoy", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    const form = page.getByRole("form", { name: "Nuevo movimiento" });
    await form.getByLabel("Tipo").selectOption("pago");
    await form.getByLabel(/concepto/).fill("Flete atrasado");
    await form.getByLabel("Monto").fill("12000000");
    await form.getByLabel("Fecha").fill("2020-01-15");
    await expect(page.getByText(/Esta fecha ya pasó/)).toBeVisible();
    await form.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(filas(page).getByText("vencido")).toBeVisible();
    await page.getByRole("link", { name: "Panel" }).click();
    await expect(page.getByText(/^Hoy te faltan USD/)).toBeVisible();
  });

  test("editar y borrar un movimiento", async ({ page }) => {
    await conDatos(page, [
      { id: "11111111-1111-4111-8111-111111111111", tipo: "cobro", concepto: "Cliente Uno", monto: 1000, moneda: "ARS", fecha: "2030-01-01", puntualidad: 90 },
    ]);
    await page.goto("/datos");
    await filas(page).getByRole("button", { name: "Editar" }).click();
    const form = page.getByRole("form", { name: "Editar movimiento" });
    await form.getByLabel(/concepto/).fill("Cliente Uno SA");
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(filas(page)).toContainText("Cliente Uno SA");
    page.once("dialog", (d) => d.accept());
    await filas(page).getByRole("button", { name: /Borrar/ }).click();
    await expect(filas(page)).toHaveCount(0);
  });

  test("CSV mal armado: informa los errores por fila", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    const csv = [
      "tipo;concepto;monto;moneda;fecha;puntualidad",
      "cobro;Cliente bueno;1.500.000;ARS;15/12/2030;90",
      "transferencia;Algo;100;ARS;15/12/2030;",
      "pago;Proveedor;-5;USD;31/02/2030;",
    ].join("\n");
    await page.getByTestId("archivo").setInputFiles({ name: "movimientos.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    const previa = page.getByTestId("vista-previa");
    await expect(previa).toContainText("1 movimientos listos para importar");
    await expect(previa).toContainText("2 filas con errores");
    await expect(previa).toContainText('Fila 3: El tipo "transferencia" no es cobro, pago ni impuesto.');
    await expect(previa).toContainText('la fecha "31/02/2030" no es válida');
    await previa.getByRole("button", { name: "Agregar a mis movimientos" }).click();
    await expect(page.getByText("Importamos 1 movimientos (salteamos 2 filas con errores).")).toBeVisible();
    await expect(filas(page)).toHaveCount(1);
  });

  test("archivo sin las columnas o con formato inválido", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    const archivo = page.getByTestId("archivo");
    await archivo.setInputFiles({ name: "malo.csv", mimeType: "text/csv", buffer: Buffer.from("nombre,importe\nX,1") });
    await expect(page.getByTestId("vista-previa")).toContainText("Faltan columnas: tipo, concepto, monto, fecha. Usá la plantilla.");
    await expect(page.getByRole("button", { name: "Agregar a mis movimientos" })).toHaveCount(0);
    await archivo.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from("x") });
    await expect(page.getByText("Formato no soportado. Subí un .csv, .xlsx o .xls.")).toBeVisible();
    await archivo.setInputFiles({ name: "vacio.csv", mimeType: "text/csv", buffer: Buffer.from("") });
    await expect(page.getByTestId("vista-previa")).toContainText("El archivo está vacío");
  });

  test("las plantillas se descargan y la de Excel se puede volver a importar", async ({ page }) => {
    await conDatos(page, []);
    await page.goto("/datos");
    const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Plantilla CSV" }).click()]);
    expect(csv.suggestedFilename()).toBe("plantilla-tip.csv");
    const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Plantilla Excel" }).click()]);
    expect(xlsx.suggestedFilename()).toBe("plantilla-tip.xlsx");
    // La descarga queda en un archivo temporal sin extensión: se sube con su nombre real.
    const buffer = readFileSync(await xlsx.path());
    await page.getByTestId("archivo").setInputFiles({ name: xlsx.suggestedFilename(), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await expect(page.getByTestId("vista-previa")).toContainText("3 movimientos listos para importar");
  });

  test("escenarios: un salto del dólar empeora el resultado", async ({ page }) => {
    await page.goto("/escenarios");
    await expect(page.getByTestId("probabilidad")).toHaveText(/%$/);
    await page.getByRole("slider", { name: /El dólar salta hoy/ }).fill("40");
    await expect(page.getByText(/Tu peor saldo empeora/)).toBeVisible();
  });
});

test("@celular las tres pantallas entran en 375 px sin scroll horizontal", async ({ page }) => {
  for (const ruta of ["/panel", "/datos", "/escenarios"]) {
    await page.goto(ruta);
    await expect(page.locator("main section").first()).toBeVisible();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, `scroll horizontal en ${ruta}`).toBeLessThanOrEqual(375);
  }
  await page.goto("/datos");
  await expect(page.getByTestId("tarjeta-movimiento").first()).toBeVisible();
  await expect(page.getByTestId("fila-movimiento").first()).toBeHidden();
});
