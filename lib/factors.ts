/**
 * Factores de emisión del prototipo.
 *
 * ADVERTENCIA, y va en el código a propósito: estos valores son **órdenes de
 * magnitud** tomados de literatura pública (alimentos, del orden de los
 * reportados por Poore & Nemecek 2018; transporte, del orden de los factores de
 * conversión de DEFRA; electricidad, de la intensidad de una red con mucha
 * hidroeléctrica como la colombiana). **Ninguno está verificado contra una
 * fuente citable**, y por eso cada uno lleva `verificado: false`.
 *
 * Para un MVP que estima, sirven. Para publicar un número a un usuario real,
 * no: hay que reemplazarlos por valores con fuente y fecha. El campo
 * `verificado` existe para que esa deuda no se olvide y la interfaz pueda
 * advertirla.
 */

export type Unidad = 'km' | 'porcion' | 'kWh' | 'm3' | 'kg';

export interface Factor {
  /** Etiqueta legible para la interfaz. */
  readonly etiqueta: string;
  /** kg CO2e por unidad (por km-pasajero, por porción o por kWh). */
  readonly kgCO2ePorUnidad: number;
  readonly unidad: Unidad;
  readonly fuente: string;
  readonly verificado: boolean;
  /** Solo alimentos: kg de producto que asume una porción. */
  readonly porcionKg?: number;
}

const FUENTE_ALIMENTOS = 'Orden de magnitud de literatura pública sobre huella de alimentos (sin verificar)';
const FUENTE_TRANSPORTE = 'Orden de magnitud de factores públicos de transporte de pasajeros (sin verificar)';
const FUENTE_ENERGIA = 'Intensidad aproximada de una red eléctrica con alta participación hidroeléctrica (sin verificar)';
const FUENTE_COMBUSTION = 'Orden de magnitud de la combustión de gas natural y GLP (sin verificar)';
const FUENTE_FLOTA = 'Orden de magnitud de factores públicos de vehículos comerciales, por km de vehículo (sin verificar)';
const FUENTE_RESIDUOS = 'Orden de magnitud de residuos a relleno sanitario frente a reciclaje (sin verificar)';

export const TRANSPORTE = {
  bus: { etiqueta: 'Bus urbano', kgCO2ePorUnidad: 0.1, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  metro: { etiqueta: 'Metro o tren', kgCO2ePorUnidad: 0.04, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  carro: { etiqueta: 'Carro a gasolina', kgCO2ePorUnidad: 0.17, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  // El eléctrico no emite cero: emite lo que emite la red que lo carga.
  carro_electrico: { etiqueta: 'Carro eléctrico', kgCO2ePorUnidad: 0.04, unidad: 'km', fuente: FUENTE_ENERGIA, verificado: false },
  taxi: { etiqueta: 'Taxi o app de transporte', kgCO2ePorUnidad: 0.2, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  moto: { etiqueta: 'Motocicleta', kgCO2ePorUnidad: 0.1, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  avion: { etiqueta: 'Avión (vuelo corto)', kgCO2ePorUnidad: 0.25, unidad: 'km', fuente: FUENTE_TRANSPORTE, verificado: false },
  bicicleta: { etiqueta: 'Bicicleta', kgCO2ePorUnidad: 0, unidad: 'km', fuente: 'Sin combustión ni electricidad en el uso', verificado: true },
  caminar: { etiqueta: 'A pie', kgCO2ePorUnidad: 0, unidad: 'km', fuente: 'Sin combustión ni electricidad en el uso', verificado: true },
} as const satisfies Record<string, Factor>;

export const ALIMENTOS = {
  carne_res: { etiqueta: 'Carne de res', kgCO2ePorUnidad: 9, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  cordero: { etiqueta: 'Cordero', kgCO2ePorUnidad: 3.6, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  cerdo: { etiqueta: 'Cerdo', kgCO2ePorUnidad: 1.05, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  pollo: { etiqueta: 'Pollo', kgCO2ePorUnidad: 0.9, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  pescado: { etiqueta: 'Pescado', kgCO2ePorUnidad: 0.75, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  queso: { etiqueta: 'Queso', kgCO2ePorUnidad: 0.63, unidad: 'porcion', porcionKg: 0.03, fuente: FUENTE_ALIMENTOS, verificado: false },
  huevo: { etiqueta: 'Huevo', kgCO2ePorUnidad: 0.27, unidad: 'porcion', porcionKg: 0.06, fuente: FUENTE_ALIMENTOS, verificado: false },
  leche: { etiqueta: 'Leche (vaso)', kgCO2ePorUnidad: 0.75, unidad: 'porcion', porcionKg: 0.25, fuente: FUENTE_ALIMENTOS, verificado: false },
  arroz: { etiqueta: 'Arroz', kgCO2ePorUnidad: 0.6, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  legumbres: { etiqueta: 'Legumbres', kgCO2ePorUnidad: 0.14, unidad: 'porcion', porcionKg: 0.15, fuente: FUENTE_ALIMENTOS, verificado: false },
  verduras: { etiqueta: 'Verduras', kgCO2ePorUnidad: 0.1, unidad: 'porcion', porcionKg: 0.2, fuente: FUENTE_ALIMENTOS, verificado: false },
  pan: { etiqueta: 'Pan', kgCO2ePorUnidad: 0.13, unidad: 'porcion', porcionKg: 0.08, fuente: FUENTE_ALIMENTOS, verificado: false },
  cafe: { etiqueta: 'Café', kgCO2ePorUnidad: 0.34, unidad: 'porcion', porcionKg: 0.02, fuente: FUENTE_ALIMENTOS, verificado: false },
} as const satisfies Record<string, Factor>;

export const ENERGIA = {
  electricidad: { etiqueta: 'Electricidad', kgCO2ePorUnidad: 0.16, unidad: 'kWh', fuente: FUENTE_ENERGIA, verificado: false },
  gas_natural: { etiqueta: 'Gas natural', kgCO2ePorUnidad: 2, unidad: 'm3', fuente: FUENTE_COMBUSTION, verificado: false },
  glp: { etiqueta: 'GLP (gas propano)', kgCO2ePorUnidad: 3, unidad: 'kg', fuente: FUENTE_COMBUSTION, verificado: false },
} as const satisfies Record<string, Factor>;

/**
 * Flota comercial. El factor es por kilómetro **de vehículo**, no por pasajero:
 * una camioneta de reparto no reparte su huella entre ocupantes, la carga
 * entera el negocio. Confundir las dos bases es el error clásico al pasar de
 * una calculadora personal a una empresarial.
 */
export const FLOTA = {
  camioneta: { etiqueta: 'Camioneta de reparto (diésel)', kgCO2ePorUnidad: 0.25, unidad: 'km', fuente: FUENTE_FLOTA, verificado: false },
  camioneta_electrica: { etiqueta: 'Camioneta eléctrica', kgCO2ePorUnidad: 0.05, unidad: 'km', fuente: FUENTE_ENERGIA, verificado: false },
  furgon: { etiqueta: 'Furgón', kgCO2ePorUnidad: 0.35, unidad: 'km', fuente: FUENTE_FLOTA, verificado: false },
  camion: { etiqueta: 'Camión', kgCO2ePorUnidad: 0.85, unidad: 'km', fuente: FUENTE_FLOTA, verificado: false },
  moto_domicilio: { etiqueta: 'Moto de domicilios', kgCO2ePorUnidad: 0.1, unidad: 'km', fuente: FUENTE_FLOTA, verificado: false },
} as const satisfies Record<string, Factor>;

export const RESIDUOS = {
  residuos: { etiqueta: 'Residuos a relleno sanitario', kgCO2ePorUnidad: 0.5, unidad: 'kg', fuente: FUENTE_RESIDUOS, verificado: false },
  residuos_reciclados: { etiqueta: 'Residuos reciclados', kgCO2ePorUnidad: 0.05, unidad: 'kg', fuente: FUENTE_RESIDUOS, verificado: false },
} as const satisfies Record<string, Factor>;

export type ClaveTransporte = keyof typeof TRANSPORTE;
export type ClaveAlimento = keyof typeof ALIMENTOS;
export type ClaveEnergia = keyof typeof ENERGIA;
export type ClaveFlota = keyof typeof FLOTA;
export type ClaveResiduo = keyof typeof RESIDUOS;
export type ClaveFactor = ClaveTransporte | ClaveAlimento | ClaveEnergia | ClaveFlota | ClaveResiduo;

const TODOS: Record<string, Factor> = { ...TRANSPORTE, ...ALIMENTOS, ...ENERGIA, ...FLOTA, ...RESIDUOS };

export function factorDe(clave: string): Factor | undefined {
  // Se consulta con `hasOwnProperty` para que una clave heredada del prototipo
  // (`constructor`, `toString`) no devuelva un objeto que no es un factor.
  return Object.prototype.hasOwnProperty.call(TODOS, clave) ? TODOS[clave] : undefined;
}

export function clavesValidas(): string[] {
  return Object.keys(TODOS);
}
