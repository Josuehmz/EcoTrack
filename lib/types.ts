import type { Unidad } from './factors';

export type Categoria = 'transporte' | 'alimentacion' | 'energia';

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
}

export interface ResultadoParseo {
  readonly actividades: readonly Actividad[];
  /** Fragmentos que el analizador no supo interpretar. Se muestran al usuario. */
  readonly sinReconocer: readonly string[];
  readonly motor: 'reglas' | 'ia';
}

export interface ItemEstimado {
  readonly categoria: Categoria;
  readonly etiqueta: string;
  readonly cantidad: number;
  readonly unidad: Unidad;
  readonly kgCO2e: number;
  readonly factor: number;
  readonly fuente: string;
  readonly verificado: boolean;
  readonly textoOrigen: string;
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
