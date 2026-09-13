import type { Unidad } from './factors';

export type Categoria = 'transporte' | 'alimentacion' | 'energia' | 'flota' | 'residuos';

/** Una actividad reconocida en el texto del usuario, antes de calcular. */
export interface Actividad {
  readonly categoria: Categoria;
  readonly clave: string;
  readonly cantidad: number;
  readonly unidad: Unidad;
  /** Fragmento del texto original que produjo esta actividad. */
  readonly textoOrigen: string;
  /** true cuando la cantidad no estaba en el texto y se usó un valor por omisión. */
  readonly cantidadAsumida?: boolean;
  /** Explica cómo se compuso la cantidad: '5 camionetas x 40 km asumidos'. */
  readonly detalle?: string;
}

export interface ResultadoParseo {
  readonly actividades: readonly Actividad[];
  /** Fragmentos que el analizador no supo interpretar. Se muestran al usuario. */
  readonly sinReconocer: readonly string[];
  readonly motor: 'reglas' | 'ia';
}

export interface ItemEstimado {
  readonly categoria: Categoria;
  /** Clave del catálogo de factores; el motor de recomendaciones la necesita. */
  readonly clave: string;
  readonly etiqueta: string;
  readonly cantidad: number;
  readonly unidad: Unidad;
  readonly kgCO2e: number;
  readonly factor: number;
  readonly fuente: string;
  readonly verificado: boolean;
  readonly textoOrigen: string;
  /** Cómo se compuso la cantidad, cuando no fue un número literal del usuario. */
  readonly detalle?: string;
}

export interface Recomendacion {
  readonly titulo: string;
  readonly detalle: string;
  readonly ahorroKgCO2e: number;
  readonly ahorroPorcentaje: number;
  readonly categoria: Categoria;
}

export interface Estimacion {
  readonly items: readonly ItemEstimado[];
  readonly totalKgCO2e: number;
  readonly porCategoria: Readonly<Record<Categoria, number>>;
  /** Equivalencia para dar escala al número. */
  readonly equivaleAKmEnCarro: number;
  readonly sinReconocer: readonly string[];
  readonly advertencias: readonly string[];
  readonly motor: 'reglas' | 'ia';
}

/**
 * Lo que devuelve el endpoint: la estimación más lo que el negocio puede hacer
 * con ella. Separar `Estimacion` de `Analisis` mantiene el cálculo puro y deja
 * la capa de consejo encima, donde se puede cambiar sin tocar los números.
 */
export interface Analisis extends Estimacion {
  readonly recomendaciones: readonly Recomendacion[];
  readonly mayorContribuyente: ItemEstimado | null;
}
