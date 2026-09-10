import type { Actividad, Categoria, ResultadoParseo } from './types';

/**
 * Analizador por reglas: convierte una frase en español en actividades
 * medibles. Es el motor por omisión de EcoTrack y funciona sin clave de API,
 * sin red y sin costo por consulta.
 *
 * Dos decisiones de diseño que importan más que las expresiones regulares:
 *
 * 1. **Lo que no se entiende se devuelve, no se descarta.** `sinReconocer`
 *    llega hasta la interfaz. Un estimador que ignora en silencio la mitad de
 *    la frase da un número bajo y creíble, que es el peor resultado posible.
 * 2. **Lo que se asume se marca.** Si el usuario no dijo la distancia, se usa
 *    un valor por omisión y se marca `cantidadAsumida`, para que la interfaz lo
 *    advierta en vez de presentarlo como dato del usuario.
 */

/** Distancia asumida cuando se menciona un medio de transporte sin kilómetros. */
export const KM_POR_OMISION = 5;

const NUMEROS_ESCRITOS: Readonly<Record<string, number>> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  medio: 0.5,
  media: 0.5,
};

interface Patron {
  readonly clave: string;
  readonly categoria: Categoria;
  readonly regex: RegExp;
}

/**
 * El orden es significativo: lo específico va antes que lo genérico, porque
 * cada coincidencia **consume** el texto que ocupó. Así "carne de cerdo" cuenta
 * como cerdo y no también como res, y "carro eléctrico" no cuenta además como
 * carro.
 */
const PATRONES_TRANSPORTE: readonly Patron[] = [
  { clave: 'carro_electrico', categoria: 'transporte', regex: /\b(?:carro|auto|vehiculo|coche)\s+electrico\b/ },
  { clave: 'bus', categoria: 'transporte', regex: /\b(?:bus|autobus|buseta|colectivo|transmilenio|sitp)\b/ },
  { clave: 'metro', categoria: 'transporte', regex: /\b(?:metro|tren|tranvia|metrocable)\b/ },
  { clave: 'taxi', categoria: 'transporte', regex: /\b(?:taxi|uber|didi|cabify|indriver)\b/ },
  { clave: 'moto', categoria: 'transporte', regex: /\b(?:moto|motocicleta|scooter)\b/ },
  { clave: 'avion', categoria: 'transporte', regex: /\b(?:avion|vuelo|vole)\b/ },
  { clave: 'bicicleta', categoria: 'transporte', regex: /\b(?:bici|bicicleta|patineta)\b/ },
  { clave: 'caminar', categoria: 'transporte', regex: /\b(?:camine|caminando|caminata|a pie)\b/ },
  { clave: 'carro', categoria: 'transporte', regex: /\b(?:carro|auto|coche|conduje|maneje)\b/ },
];

/**
 * El prefijo `(?:carne\s+de\s+)?` no es adorno: consumir solo "cerdo" en
 * "carne de cerdo" deja la palabra "carne" suelta, y el patrón genérico de res
 * la cuenta como una segunda porción. El plato se duplicaba y el total salía
 * inflado. Lo encontró una prueba, no una lectura del código.
 */
const PATRONES_ALIMENTO: readonly Patron[] = [
  { clave: 'cordero', categoria: 'alimentacion', regex: /\b(?:carne\s+de\s+)?(?:cordero|borrego)\b/ },
  { clave: 'cerdo', categoria: 'alimentacion', regex: /\b(?:carne\s+de\s+)?(?:cerdo|chicharron|tocino|jamon|salchicha)\b/ },
  { clave: 'pollo', categoria: 'alimentacion', regex: /\b(?:carne\s+de\s+)?(?:pollo|pechuga|gallina)\b/ },
  { clave: 'pescado', categoria: 'alimentacion', regex: /\b(?:carne\s+de\s+)?(?:pescado|atun|salmon|trucha|mariscos?|camarones?)\b/ },
  { clave: 'carne_res', categoria: 'alimentacion', regex: /\b(?:carne\s+de\s+res|bistec|churrasco|hamburguesas?|res|carne)\b/ },
  { clave: 'queso', categoria: 'alimentacion', regex: /\bquesos?\b/ },
  { clave: 'huevo', categoria: 'alimentacion', regex: /\b(?:huevos?|omelette)\b/ },
  { clave: 'leche', categoria: 'alimentacion', regex: /\b(?:leche|yogur|yogurt)\b/ },
  { clave: 'arroz', categoria: 'alimentacion', regex: /\barroz\b/ },
  { clave: 'legumbres', categoria: 'alimentacion', regex: /\b(?:frijoles?|lentejas?|garbanzos?|arvejas?|legumbres|habichuelas?)\b/ },
  { clave: 'verduras', categoria: 'alimentacion', regex: /\b(?:verduras?|ensalada|vegetales|brocoli|zanahorias?|lechuga)\b/ },
  { clave: 'pan', categoria: 'alimentacion', regex: /\b(?:pan|arepas?|tostadas?)\b/ },
  { clave: 'cafe', categoria: 'alimentacion', regex: /\b(?:cafe|tinto|capuchino|latte)\b/ },
];

/** Palabras que, si son lo único que sobra, no significan una actividad. */
const RELLENO = new Set([
  'hoy', 'ayer', 'anoche', 'mañana', 'manana', 'dia', 'hice', 'comi', 'comer', 'almorce', 'almuerzo',
  'cene', 'cena', 'desayune', 'desayuno', 'tome', 'tomar', 'viaje', 'viajar', 'viajo', 'fui', 'ir',
  'me', 'mi', 'yo', 'en', 'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y',
  'con', 'por', 'para', 'a', 'al', 'que', 'muy', 'poco', 'mucho', 'casa', 'trabajo', 'oficina',
  'universidad', 'gaste', 'use', 'movi', 'transporte', 'luego', 'despues', 'tambien', 'ademas',
  'estuve', 'sali', 'regrese', 'volvi', 'aproximadamente', 'como', 'unos', 'cerca', 'total',
]);

/**
 * Se usa la propiedad Unicode en vez de una clase con los signos combinantes
 * escritos literalmente. Las dos formas funcionan, pero la literal depende de
 * que la codificación del archivo sobreviva a cada editor, compilador y copia:
 * es un rango de caracteres invisibles dentro de unos corchetes. Esta es ASCII
 * puro en el fuente y dice lo que hace.
 */
const DIACRITICOS = /\p{Diacritic}/gu;

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    // La coma decimal se pasa a punto ANTES de fragmentar. Sin esto, "1,5 km"
    // se parte en "1" y "5 km" al cortar por comas, y el viaje pasa de 1,5 km
    // a 5 km sin que nada avise. Lo encontró una prueba, no una lectura.
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Corta la frase en fragmentos para que cada actividad se lea en su contexto. */
function fragmentar(texto: string): string[] {
  // El punto solo separa si va seguido de espacio o fin de texto: si no,
  // "1.5 km" se partiría en "1" y "5 km" — el mismo defecto que la coma
  // decimal, una capa más abajo.
  return texto
    .split(/[,;]|\.(?=\s|$)|\s+y\s+|\s+luego\s+|\s+despues\s+|\s+tambien\s+|\s+ademas\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

function aNumero(bruto: string): number | undefined {
  const escrito = NUMEROS_ESCRITOS[bruto];
  if (escrito !== undefined) return escrito;
  const valor = Number.parseFloat(bruto.replace(',', '.'));
  return Number.isFinite(valor) ? valor : undefined;
}

/** Extrae la primera distancia del fragmento y la devuelve en kilómetros. */
function extraerKm(fragmento: string): { km: number; consumido: string } | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(kilometros?|kms?|km|metros|mts?|m)\b/.exec(fragmento);
  if (match === null) return undefined;
  const valor = aNumero(match[1] as string);
  if (valor === undefined) return undefined;
  const unidad = match[2] as string;
  const esMetro = unidad === 'm' || unidad.startsWith('mt') || unidad.startsWith('metro');
  return { km: esMetro ? valor / 1000 : valor, consumido: match[0] };
}

function extraerKWh(fragmento: string): { kwh: number; consumido: string } | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:kwh|kilovatios?(?:\s+hora)?)\b/.exec(fragmento);
  if (match === null) return undefined;
  const valor = aNumero(match[1] as string);
  return valor === undefined ? undefined : { kwh: valor, consumido: match[0] };
}

/**
 * Cantidad que precede a la palabra del alimento: "dos hamburguesas", "3 huevos".
 * Si no hay número, la cantidad es 1 y no se marca como asumida: "comí pollo"
 * significa una porción, no una cantidad desconocida.
 */
function cantidadAntesDe(fragmento: string, indiceCoincidencia: number): number {
  const previo = fragmento.slice(0, indiceCoincidencia).trim();
  const match = /(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|medio|media)\s*$/.exec(previo);
  if (match === null) return 1;
  return aNumero(match[1] as string) ?? 1;
}

function sobraAlgoSignificativo(resto: string): boolean {
  return resto
    .split(/\s+/)
    .some((palabra) => {
      const limpia = palabra.replace(/[^a-z]/g, '');
      return limpia.length >= 4 && !RELLENO.has(limpia);
    });
}

export function analizarConReglas(textoOriginal: string): ResultadoParseo {
  const actividades: Actividad[] = [];
  const sinReconocer: string[] = [];

  for (const fragmentoOriginal of fragmentar(normalizar(textoOriginal))) {
    let resto = fragmentoOriginal;
    let reconocioAlgo = false;

    // 1. Energía: la unidad es explícita, así que va primero.
    const energia = extraerKWh(resto);
    if (energia !== undefined) {
      actividades.push({
        categoria: 'energia',
        clave: 'electricidad',
        cantidad: energia.kwh,
        unidad: 'kWh',
        textoOrigen: fragmentoOriginal,
      });
      resto = resto.replace(energia.consumido, ' ');
      reconocioAlgo = true;
    }

    // 2. Transporte: el medio manda; la distancia se busca en el fragmento.
    for (const patron of PATRONES_TRANSPORTE) {
      const match = patron.regex.exec(resto);
      if (match === null) continue;
      const distancia = extraerKm(resto);
      actividades.push({
        categoria: 'transporte',
        clave: patron.clave,
        cantidad: distancia?.km ?? KM_POR_OMISION,
        unidad: 'km',
        textoOrigen: fragmentoOriginal,
        ...(distancia === undefined ? { cantidadAsumida: true } : {}),
      });
      resto = resto.replace(match[0], ' ');
      if (distancia !== undefined) resto = resto.replace(distancia.consumido, ' ');
      reconocioAlgo = true;
      // Un fragmento describe un trayecto: no se buscan más medios en él.
      break;
    }

    // 3. Alimentación: un fragmento puede traer varios alimentos ("carne y arroz"
    //    sobrevive si el usuario no puso la coma).
    for (const patron of PATRONES_ALIMENTO) {
      const match = patron.regex.exec(resto);
      if (match === null) continue;
      actividades.push({
        categoria: 'alimentacion',
        clave: patron.clave,
        cantidad: cantidadAntesDe(resto, match.index),
        unidad: 'porcion',
        textoOrigen: fragmentoOriginal,
      });
      resto = resto.replace(match[0], ' ');
      reconocioAlgo = true;
    }

    if (!reconocioAlgo && sobraAlgoSignificativo(resto)) {
      sinReconocer.push(fragmentoOriginal);
    }
  }

  return { actividades, sinReconocer, motor: 'reglas' };
}
