# EcoTrack

**Repositorio:** https://github.com/Josuehmz/EcoTrack

Prototipo (MVP) que estima la huella de carbono del día a partir de una frase
escrita en lenguaje natural: *"Hoy comí carne y viajé 20km en bus"* → **11 kg
CO₂e**, con el desglose y las advertencias de lo que no entendió.

Construido con **vibe coding**: el código lo escribió un agente de IA (Claude
Opus 5) dirigido por el `.cursorrules` de este repositorio.

## Cómo correrlo

```bash
pnpm install
pnpm test          # 37 pruebas
pnpm run typecheck # tsc --noEmit
pnpm run dev       # http://localhost:3000
```

Con `pnpm run build && pnpm run start` queda listo para producción (es lo que
usa el despliegue de Replit).

## Los dos motores

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

```json
{"data":{"items":[
  {"etiqueta":"Carne de res","cantidad":1,"unidad":"porcion","kgCO2e":9,"verificado":false},
  {"etiqueta":"Bus urbano","cantidad":20,"unidad":"km","kgCO2e":2,"verificado":false}],
 "totalKgCO2e":11,"porCategoria":{"transporte":2,"alimentacion":9,"energia":0},
 "equivaleAKmEnCarro":64.7,"sinReconocer":[],"motor":"reglas",
 "advertencias":["Los factores de emisión de este prototipo son órdenes de magnitud sin verificar..."]}}
```

`GET /api/estimate` responde qué motor está activo.

## Entregables de la tarea

- **Código fuente funcional:** este repositorio (`app/`, `lib/`, `tests/`).
- **`.cursorrules`:** reglas del agente. Se incluye también
  `.cursor/rules/ecotrack.mdc`, el formato que Cursor prefiere hoy, con el
  mismo contenido.
- **`VIBE-REPORT.md`:** reflexión sobre la configuración y el flujo (495
  palabras).
- **`.replit`:** configuración del Repl para correr y desplegar.

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
- **El `.replit` no se ha probado en Replit**: se escribió según su formato
  documentado, pero quien lo suba debe confirmar que el Repl arranca.
- El analizador entiende un vocabulario acotado de español colombiano. Lo que
  no reconoce lo devuelve en `sinReconocer` en vez de descartarlo: un total bajo
  y creíble sería el peor resultado posible.

## Pendiente de la entrega

1. Importar este repositorio en Replit (Create Repl → Import from GitHub) y
   pegar la URL del Repl desplegado.
2. Tomar la **captura de pantalla** con Cursor y Replit operando juntos: el
   proyecto abierto en Cursor (con `.cursorrules` visible en el editor y el
   Composer/chat a la derecha) y, al lado, el Repl corriendo con la app en el
   navegador. Esa captura solo la puede tomar quien tenga las dos cuentas.
