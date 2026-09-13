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

/**
 * Supuestos del modo negocio. Son decisiones de producto, no constantes
 * técnicas: un negocio dice "salieron 5 camionetas" y casi nunca el
 * kilometraje. Se asume una cifra de reparto urbano, se multiplica por los
 * vehículos y **se marca como asumida** para que la interfaz lo advierta y el
 * dueño pueda corregirla. El error de no preguntar es aceptable; el de
 * presentar un supuesto como dato, no.
 */
export const KM_POR_VEHICULO_OMISION = 40;
export const KM_POR_DOMICILIO = 6;
export const KG_POR_CILINDRO_GLP = 15;

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
 * Flota comercial. Va **antes** que el transporte personal en el bucle: una
 * "camioneta" de un negocio no es el carro de alguien que se mueve, y su factor
 * es por kilómetro de vehículo y no por pasajero.
 */
const PATRONES_FLOTA: readonly Patron[] = [
  { clave: 'camioneta_electrica', categoria: 'flota', regex: /\b(?:camionetas?|vans?)\s+electricas?\b/ },
  { clave: 'moto_domicilio', categoria: 'flota', regex: /\b(?:motos?\s+de\s+(?:domicilios?|reparto)|domiciliarios?|mensajeros?)\b/ },
  { clave: 'camion', categoria: 'flota', regex: /\b(?:camion|camiones|tractomulas?)\b/ },
  { clave: 'furgon', categoria: 'flota', regex: /\b(?:furgon|furgones|furgonetas?)\b/ },
  { clave: 'camioneta', categoria: 'flota', regex: /\b(?:camionetas?|vans?|utilitarios?)\b/ },
];

const PATRONES_RESIDUOS: readonly Patron[] = [
  { clave: 'residuos_reciclados', categoria: 'residuos', regex: /\b(?:recicl\w*|reciclaje)\b/ },
  { clave: 'residuos', categoria: 'residuos', regex: /\b(?:residuos?|basuras?|desechos?)\b/ },
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
  const fragmentos = texto
    .split(/[,;]|\.(?=\s|$)|\s+y\s+|\s+luego\s+|\s+despues\s+|\s+tambien\s+|\s+ademas\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  return fusionarDistanciasHuerfanas(fragmentos);
}

/**
 * Una distancia sola no es una actividad: "60 km cada una" solo significa algo
 * pegada a los vehículos que la preceden.
 *
 * Al cortar por comas, "tres camionetas, 60 km cada una" quedaba en dos
 * fragmentos: las camionetas sin kilometraje (y por tanto con el valor
 * asumido) y una distancia huérfana que se descartaba. El resultado era 120 km
 * en vez de 180, sin ningún aviso. La coma ya había roto los decimales una vez;
 * aquí rompía la cuenta de la flota.
 */
const SOLO_DISTANCIA = /^(?:de\s+)?\d+(?:[.,]\d+)?\s*(?:km|kms|kilometros?|metros?)\s*(?:cada\s+(?:una|uno))?$/;

function fusionarDistanciasHuerfanas(fragmentos: readonly string[]): string[] {
  const fusionados: string[] = [];
  for (const fragmento of fragmentos) {
    const anterior = fusionados[fusionados.length - 1];
    if (anterior !== undefined && SOLO_DISTANCIA.test(fragmento)) {
      fusionados[fusionados.length - 1] = `${anterior} ${fragmento}`;
      continue;
    }
    fusionados.push(fragmento);
  }
  return fusionados;
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

/** Gas natural facturado en metros cúbicos: "gastamos 45 m3 de gas". */
function extraerM3(fragmento: string): { m3: number; consumido: string } | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:m3|m³|metros?\s+cubicos?)\b/.exec(fragmento);
  if (match === null) return undefined;
  const valor = aNumero(match[1] as string);
  return valor === undefined ? undefined : { m3: valor, consumido: match[0] };
}

/**
 * GLP: se admite en kilos o en cilindros. El cilindro se convierte con un peso
 * asumido, porque el dueño del negocio cuenta cilindros, no kilos.
 */
function extraerGlp(fragmento: string): { kg: number; consumido: string; asumido: boolean } | undefined {
  const cilindros = /(\d+(?:[.,]\d+)?)\s*(?:cilindros?|pipetas?)\b/.exec(fragmento);
  if (cilindros !== null) {
    const valor = aNumero(cilindros[1] as string);
    if (valor !== undefined) {
      return { kg: valor * KG_POR_CILINDRO_GLP, consumido: cilindros[0], asumido: true };
    }
  }
  const kilos = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?)\s+de\s+(?:glp|gas|propano)\b/.exec(fragmento);
  if (kilos !== null) {
    const valor = aNumero(kilos[1] as string);
    if (valor !== undefined) return { kg: valor, consumido: kilos[0], asumido: false };
  }
  return undefined;
}

/** Residuos en kilos: "sacamos 30 kg de basura", "reciclamos 12 kilos". */
function extraerKg(fragmento: string): { kg: number; consumido: string } | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?)\b/.exec(fragmento);
  if (match === null) return undefined;
  const valor = aNumero(match[1] as string);
  return valor === undefined ? undefined : { kg: valor, consumido: match[0] };
}

/** "Hicimos 30 domicilios": entregas que se convierten en kilómetros de moto. */
function extraerDomicilios(fragmento: string): { entregas: number; consumido: string } | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:domicilios?|entregas?|pedidos?)\b/.exec(fragmento);
  if (match === null) return undefined;
  const valor = aNumero(match[1] as string);
  return valor === undefined ? undefined : { entregas: valor, consumido: match[0] };
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

    // 1b. Gas natural y GLP: también traen unidad explícita.
    const gas = extraerM3(resto);
    if (gas !== undefined) {
      actividades.push({
        categoria: 'energia',
        clave: 'gas_natural',
        cantidad: gas.m3,
        unidad: 'm3',
        textoOrigen: fragmentoOriginal,
      });
      resto = resto.replace(gas.consumido, ' ');
      reconocioAlgo = true;
    }

    const glp = extraerGlp(resto);
    if (glp !== undefined) {
      actividades.push({
        categoria: 'energia',
        clave: 'glp',
        cantidad: glp.kg,
        unidad: 'kg',
        textoOrigen: fragmentoOriginal,
        ...(glp.asumido
          ? { cantidadAsumida: true, detalle: `cilindros convertidos a ${KG_POR_CILINDRO_GLP} kg cada uno` }
          : {}),
      });
      resto = resto.replace(glp.consumido, ' ');
      reconocioAlgo = true;
    }

    // 1c. Residuos: el kilaje va con la palabra que dice si se recicla o no.
    for (const patron of PATRONES_RESIDUOS) {
      const match = patron.regex.exec(resto);
      if (match === null) continue;
      const kilos = extraerKg(resto);
      if (kilos === undefined) break;
      actividades.push({
        categoria: 'residuos',
        clave: patron.clave,
        cantidad: kilos.kg,
        unidad: 'kg',
        textoOrigen: fragmentoOriginal,
      });
      resto = resto.replace(match[0], ' ').replace(kilos.consumido, ' ');
      reconocioAlgo = true;
      break;
    }

    // 1d. Domicilios: entregas convertidas a kilómetros de moto.
    const domicilios = extraerDomicilios(resto);
    if (domicilios !== undefined) {
      actividades.push({
        categoria: 'flota',
        clave: 'moto_domicilio',
        cantidad: domicilios.entregas * KM_POR_DOMICILIO,
        unidad: 'km',
        textoOrigen: fragmentoOriginal,
        cantidadAsumida: true,
        detalle: `${domicilios.entregas} entregas x ${KM_POR_DOMICILIO} km asumidos por entrega`,
      });
      resto = resto.replace(domicilios.consumido, ' ');
      // "40 domicilios en moto" nombra una sola vez el mismo vehículo. Si la
      // palabra "moto" sobrevive, el patrón de transporte personal la vuelve a
      // contar y el negocio recibe un total inflado con un trayecto que nadie
      // hizo. Lo destapó ejecutar el endpoint, no una prueba.
      resto = resto.replace(/\b(?:en\s+)?(?:motos?|motocicletas?|bicicletas?|bicis?)\b/, ' ');
      reconocioAlgo = true;
    }

    // 1e. Flota comercial: el número que precede al vehículo multiplica.
    for (const patron of PATRONES_FLOTA) {
      const match = patron.regex.exec(resto);
      if (match === null) continue;

      const unidades = cantidadAntesDe(resto, match.index);
      const distancia = extraerKm(resto);
      // "cada una" cambia por completo el significado del número: sin esa
      // palabra, una distancia junto a varios vehículos se lee como el total
      // recorrido, no como el de cada uno. Es la diferencia entre 200 km y
      // 1.000 km, así que el supuesto se declara en `detalle`.
      const porVehiculo = /\bcada\b/.test(resto);

      let km: number;
      let detalle: string;
      let asumida = false;
      if (distancia === undefined) {
        km = unidades * KM_POR_VEHICULO_OMISION;
        detalle = `${unidades} x ${KM_POR_VEHICULO_OMISION} km asumidos por vehiculo`;
        asumida = true;
      } else if (porVehiculo) {
        km = unidades * distancia.km;
        detalle = `${unidades} x ${distancia.km} km cada uno`;
      } else {
        km = distancia.km;
        detalle =
          unidades > 1
            ? `${distancia.km} km en total entre ${unidades} vehiculos`
            : `${distancia.km} km`;
      }

      actividades.push({
        categoria: 'flota',
        clave: patron.clave,
        cantidad: km,
        unidad: 'km',
        textoOrigen: fragmentoOriginal,
        detalle,
        ...(asumida ? { cantidadAsumida: true } : {}),
      });
      resto = resto.replace(match[0], ' ');
      if (distancia !== undefined) resto = resto.replace(distancia.consumido, ' ');
      reconocioAlgo = true;
      break;
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
