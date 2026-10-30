# TIP · Tesorería Inteligente para PyMEs

Copiloto de tesorería para PyMEs argentinas importadoras: proyecta el flujo de caja a 90 días en pesos, avisa con semanas de anticipación si va a faltar (o sobrar) plata y recomienda qué hacer.

MVP para la materia **Desarrollo de Nuevos Negocios** (2026).

## Qué hace

- **Login** con email y contraseña. Una empresa por usuario, con sus supuestos: caja en ARS y USD, tipo de cambio, devaluación mensual esperada y saldo mínimo de seguridad.
- **Movimientos**: cobros, pagos e impuestos en ARS o USD, con la puntualidad histórica de cada cliente. Se cargan a mano o desde un CSV/Excel con plantilla descargable; las filas con errores se informan una por una.
- **Proyección diaria a 90 días** en pesos. Los pagos en dólares se convierten al tipo de cambio proyectado de cada fecha y la zona negativa se marca en rojo. Los movimientos con fecha pasada se toman como vencidos y se proyectan para hoy.
- **Alertas**: faltante ("En X días te van a faltar USD Y para tu pago a Z"), saldo por debajo del mínimo y excedente ocioso a 30 días (solo si no hay faltante).
- **Recomendaciones con el porqué**: adelantar cobros de clientes con puntualidad ≥ 80% (total o parcialmente, primero los que vencen más cerca), crédito planificado por el resto, y plazo fijo o LECAP para el excedente.
- **Escenarios "¿y si…?"**: salto del dólar, demora de clientes y caída de la cobranza, contra la proyección base, con la probabilidad de quedarse sin caja calculada con 1.000 simulaciones y la banda entre el 10% y el 90%.
- **Datos de ejemplo**: una importadora de seguridad electrónica ficticia, para la demo.

## Cómo correrlo

Requisitos: Node.js 20 o más nuevo.

```bash
npm install
cp .env.example .env.local   # completá con los datos de Supabase (ver abajo)
npm run dev                  # http://localhost:3000
```

Sin `.env.local`, la app corre en **modo local**: no pide login y guarda los datos en el navegador. Sirve para desarrollar o mostrar la app sin conexión.

### Variables de entorno

| Variable | Qué es | Dónde está |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (`sb_publishable_…`). También se acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY`. | Supabase → Project Settings → API Keys |

Las dos son públicas por diseño; lo que protege los datos son las políticas RLS. **No se usa la `service_role`/`secret` key** en ningún lado.

### Configurar Supabase (una sola vez)

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pegar [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**. Crea las tablas `empresas` y `movimientos`, las políticas RLS y la función `importar_movimientos`.
3. **Authentication → Sign In / Providers → Email** → desactivar **Confirm email** (para que el registro sea inmediato en la demo).
4. **Authentication → URL Configuration** → poner la URL de Vercel como **Site URL**.

### Publicar en Vercel

1. Importar el repo de GitHub en Vercel (framework: Next.js, sin cambios en build).
2. Cargar las dos variables de entorno en **Settings → Environment Variables** (Production y Preview).
3. Cada push genera una preview nueva.

## Tests

```bash
npm test               # unitarios (Vitest): proyección, alertas, recomendaciones, simulación, importación
npm run test:e2e       # de punta a punta (Playwright), en modo local
npm run verificar:rls  # aislamiento entre usuarios contra el Supabase real
```

- Los **unitarios** cubren, entre otros: sin movimientos, fechas pasadas, faltante cubierto total y parcialmente, crédito por el resto, excedente solo sin faltante, conversión de USD, CSV mal armado y formularios vacíos. Uno compara la proyección con el algoritmo del `index.html` original.
- Los **e2e** prueban formulario vacío, CSV mal armado, fecha pasada, doble clic al guardar, editar/borrar, plantillas y la vista en celular (375 px, sin scroll horizontal). La primera vez: `npx playwright install chromium`.
- `verificar:rls` crea dos usuarios de prueba y comprueba que ninguno puede ver, crear, editar ni borrar datos del otro, que no se puede crear una segunda empresa y que guardar dos veces el mismo movimiento deja uno solo. Las credenciales quedan en `.usuarios-prueba.local.json` (no se sube a git).

## Estructura

```
src/lib/tesoreria/      Lógica pura (sin React ni Supabase), 100% testeable
  proyeccion.ts         Saldo diario, tipo de cambio proyectado, vencidos → día 0
  alertas.ts            Faltante, bajo el mínimo, excedente + textos
  recomendaciones.ts    Adelantar cobros, crédito planificado, plazo fijo/LECAP
  simulacion.ts         Monte Carlo (1.000 corridas, semilla fija)
  importacion.ts        CSV/Excel → movimientos validados con errores por fila
  validacion.ts         Validación compartida por formularios y servidor
  fuentes.ts            Interfaz para enchufar ARCA, bancos o Tango en la v1
  demo.ts               Importadora de ejemplo
src/lib/persistencia/   Dónde se guardan los datos: navegador (modo local) o Supabase
src/lib/supabase/       Clientes de Supabase y lectura de datos (solo servidor)
src/app/acciones.ts     Server Actions: validan de nuevo y escriben en la base
src/proxy.ts            Refresca la sesión y protege las rutas
src/components/         Pantallas y componentes
supabase/migrations/    Esquema, RLS y funciones
e2e/                    Tests de punta a punta
referencia/             El MVP estático original (index.html)
```

## Supuestos del modelo

- El déficit de un faltante es el peor saldo en los 15 días desde que el saldo se vuelve negativo.
- Se sugiere adelantar cobros que vencen hasta 45 días después del faltante.
- Hay excedente si el saldo mínimo de los próximos 30 días supera el doble del saldo de seguridad; se sugiere colocar lo que excede el mínimo.
- Simulación: volatilidad anual del dólar del 12% alrededor de la devaluación esperada; cada cobro se atrasa entre 10 y 40 días con probabilidad (1 − puntualidad). Sin dato de puntualidad se asume 80%.

## Pendiente para la versión 1

- **Integraciones**: ARCA (vencimientos de IVA, Ingresos Brutos y retenciones), bancos (saldos y acreditaciones automáticas) y Tango/Xubio (facturas emitidas y recibidas), sobre la interfaz `FuenteDeMovimientos`.
- **Puntualidad calculada** desde el historial real de cobros, en vez de cargada a mano.
- **Avisos proactivos** por WhatsApp o mail cuando aparece un faltante (hoy la alerta se ve al entrar).
- **Proyección automática diaria** en el servidor (cron) y registro histórico de proyecciones para medir la precisión.
- **Tipo de cambio real** (oficial/MEP) y curva de devaluación de mercado en vez de un supuesto fijo.
- **Impuestos estimados** a partir de las ventas y compras (débito/crédito fiscal), no solo cargados.
- **Tasas reales** de crédito, plazo fijo y LECAP para comparar el costo de cada recomendación.
- **Varias empresas por usuario** y usuarios invitados (contador, socio), con roles.
- **Recuperar contraseña**, magic link y confirmación de email.
- Movimientos recurrentes (sueldos, alquileres) y edición en lote.
