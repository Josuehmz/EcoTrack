# EcoTrack

**App en vivo:** https://eco-track-gold.vercel.app ·
**Repositorio:** https://github.com/Josuehmz/EcoTrack

MVP que estima la huella de carbono a partir de una frase en lenguaje natural,
sin formularios. Dos productos sobre el mismo motor:

- **`/` — EcoTrack AI, para negocios** (capstone). Interfaz de chat: *"Hoy
  usamos 5 camionetas de reparto y gastamos 200kWh de luz"* → **82 kg CO₂e**,
  con el desglose, el supuesto visible (*5 × 40 km asumidos*) y qué hacer
  mañana (*cambiar la camioneta por una eléctrica: −40 kg, 48,8%*).
- **`/personal` — EcoTrack, para personas** (trabajo anterior). *"Hoy comí carne
  y viajé 20km en bus"* → **11 kg CO₂e**.

Construido con **vibe coding**: el código lo escribió un agente de IA (Claude
Opus 5) dirigido por el `.cursorrules` de este repositorio.

**Documentos del capstone:** [`docs/MASTER-PROMPT.md`](docs/MASTER-PROMPT.md) ·
[`docs/CAPSTONE-BITACORA.md`](docs/CAPSTONE-BITACORA.md)

## Cómo correrlo

```bash
pnpm install
pnpm test          # 66 pruebas
pnpm run typecheck # tsc --noEmit
pnpm run dev       # http://localhost:3000
```

Con `pnpm run build && pnpm run start` queda listo para producción (es lo que
usa el despliegue de Replit).

## Los dos motores de comprensión

Por omisión EcoTrack analiza la frase con un **analizador por reglas** en
`lib/parser.ts`: corre sin clave de API, sin red, sin costo por consulta y es
determinista, así que se puede probar. Si existe la variable de entorno
`ANTHROPIC_API_KEY`, usa el **motor de IA** (`lib/llm.ts`), que entiende frases
que las reglas no cubren.

En los dos casos **la IA solo extrae actividades; el cálculo lo hace el
código** con los factores de `lib/factors.ts`. Pedirle el total al modelo daría
un número que nadie puede auditar y que cambia entre llamadas. Si el motor de
IA falla, la respuesta cae al analizador por reglas y lo declara en
`advertencias`.

## API

`POST /api/estimate` con `{"texto": "...", "motor": "auto" | "reglas"}`.
Respuesta real del servicio, verificada con `curl`:

```
Hoy usamos 5 camionetas de reparto y gastamos 200kWh de luz
→ total: 82 kg CO2e | equivale a 482,4 km en carro
   Camioneta de reparto (diésel) | 200 km  | 50 kg | 5 x 40 km asumidos por vehiculo
   Electricidad                  | 200 kWh | 32 kg
   mayor contribuyente: Camioneta de reparto (diésel)
   > cambiar la camioneta de reparto por una eléctrica  → −40 kg (48,8%)
   > apagar equipos en horas muertas y pasar a LED      → −4,8 kg (5,9%)
```

La respuesta trae `items` (con `detalle` cuando hubo un supuesto),
`totalKgCO2e`, `porCategoria`, `recomendaciones`, `mayorContribuyente`,
`sinReconocer`, `advertencias` y `motor`.

`GET /api/estimate` responde qué motor está activo.

## Entregables del capstone

- **Proyecto vivo:** la app publicada en Replit (ver más abajo) y este
  repositorio.
- **Master Prompt:** [`docs/MASTER-PROMPT.md`](docs/MASTER-PROMPT.md).
- **Bitácora:** [`docs/CAPSTONE-BITACORA.md`](docs/CAPSTONE-BITACORA.md) —
  prompts, capturas, la funcionalidad de IA explicada y los dos errores reales
  con el prompt que los resolvió.
- **Funcionalidad de IA:** comprensión del lenguaje natural (dos motores
  intercambiables) y motor de recomendaciones con el ahorro calculado.

## Entregables del trabajo anterior

- **Código fuente funcional:** este repositorio (`app/`, `lib/`, `tests/`).
- **`.cursorrules`:** reglas del agente. Se incluye también
  `.cursor/rules/ecotrack.mdc`, el formato que Cursor prefiere hoy, con el
  mismo contenido.
- **`VIBE-REPORT.md`:** reflexión sobre la configuración y el flujo (495
  palabras).
- **`.replit`:** configuración del Repl para correr y desplegar.
- **Capturas:** `docs/capturas/`, Cursor y Replit operando juntos.

## Despliegues

- **Vercel — despliegue actual del capstone:** https://eco-track-gold.vercel.app
- **Replit — primer despliegue, del trabajo anterior:**
  [Repl](https://replit.com/@JosueHernande15/EcoTrack) ·
  [app](https://eco-track--josuehernande15.replit.app). El Repl se creó
  importando este repositorio y su agente adaptó el arranque a su entorno; puede
  estar sirviendo una versión anterior. La fuente de verdad del código es este
  repositorio.

## Capturas

### La app en producción (Vercel)

El caso del enunciado — flota con el supuesto visible, energía, y las dos
recomendaciones con su ahorro calculado:

![EcoTrack AI en Vercel: 5 camionetas y 200 kWh dan 82 kg CO2e](docs/capturas/app-vercel-flota-y-energia.png)

Domicilios convertidos a kilómetros y residuos al relleno, con reciclar como la
recomendación de mayor ahorro:

![EcoTrack AI en Vercel: 40 domicilios y 25 kg de basura dan 36,5 kg CO2e](docs/capturas/app-vercel-domicilios-y-residuos.png)

Las dos pantallas coinciden con lo que devuelve el endpoint por `curl` y con lo
que fijan las pruebas: 82 kg y 36,5 kg.

### El entorno de trabajo (Cursor y Replit)

El agente de Replit importando y publicando el proyecto, con `.cursorrules`
abierto en Cursor al lado:

![Cursor y el agente de Replit trabajando en conjunto](docs/capturas/cursor-y-replit-agente.png)

![La app publicada en Replit junto a Cursor](docs/capturas/cursor-y-replit-app.png)

## Lo que este prototipo NO es

Está escrito en el código y se repite acá porque importa:

- **Los factores de emisión son órdenes de magnitud sin verificar.** Cada uno
  lleva `verificado: false` y la interfaz lo advierte. Sirven para comparar
  hábitos (carne contra lentejas, bus contra carro), no para reportar
  emisiones. Antes de cualquier uso real hay que reemplazarlos por valores con
  fuente y fecha.
- **El motor de IA no se ha ejecutado**: en esta máquina no había
  `ANTHROPIC_API_KEY`, así que ese camino compila y está tipado, pero no está
  probado contra la API. Lo verificado de punta a punta es el motor por reglas.
- El analizador entiende un vocabulario acotado de español colombiano. Lo que
  no reconoce lo devuelve en `sinReconocer` en vez de descartarlo: un total bajo
  y creíble sería el peor resultado posible.
