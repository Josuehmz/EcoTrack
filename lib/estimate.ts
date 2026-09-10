import { TRANSPORTE, factorDe } from './factors';
import type { Actividad, Categoria, Estimacion, ItemEstimado, ResultadoParseo } from './types';

/**
 * Convierte actividades en kilogramos de CO2e. La aritmética es trivial a
 * propósito: lo que decide la calidad del resultado es el analizador y los
 * factores, no esta multiplicación.
 */

const CATEGORIAS: readonly Categoria[] = ['transporte', 'alimentacion', 'energia'];

function redondear(valor: number, decimales = 2): number {
  const escala = 10 ** decimales;
  return Math.round(valor * escala) / escala;
}

function valida(actividad: Actividad): boolean {
  // typeof NaN === 'number', así que el guardia tiene que ser isFinite.
  return (
    typeof actividad.cantidad === 'number' &&
    Number.isFinite(actividad.cantidad) &&
    actividad.cantidad >= 0
  );
}

export function estimar(parseo: ResultadoParseo): Estimacion {
  const items: ItemEstimado[] = [];
  const advertencias: string[] = [];
  let hayFactorSinVerificar = false;

  for (const actividad of parseo.actividades) {
    const factor = factorDe(actividad.clave);
    if (factor === undefined) {
      // El motor de IA puede devolver una clave que no existe en el catálogo.
      // Se descarta y se avisa, en vez de inventar un factor.
      advertencias.push(`No hay factor de emisión para "${actividad.clave}"; esa actividad no se contó.`);
      continue;
    }
    if (!valida(actividad)) {
      advertencias.push(`La cantidad de "${factor.etiqueta}" no es un número válido; esa actividad no se contó.`);
      continue;
    }

    const kg = actividad.cantidad * factor.kgCO2ePorUnidad;
    if (!factor.verificado) hayFactorSinVerificar = true;

    items.push({
      categoria: actividad.categoria,
      etiqueta: factor.etiqueta,
      cantidad: redondear(actividad.cantidad, 3),
      unidad: factor.unidad,
      kgCO2e: redondear(kg, 3),
      factor: factor.kgCO2ePorUnidad,
      fuente: factor.fuente,
      verificado: factor.verificado,
      textoOrigen: actividad.textoOrigen,
    });

    if (actividad.cantidadAsumida === true) {
      advertencias.push(
        `No dijiste la distancia de "${factor.etiqueta}": se asumieron ${actividad.cantidad} km. Corrígelo si fue otra.`,
      );
    }
  }

  const porCategoria = {} as Record<Categoria, number>;
  for (const categoria of CATEGORIAS) porCategoria[categoria] = 0;
  let total = 0;
  for (const item of items) {
    total += item.kgCO2e;
    porCategoria[item.categoria] += item.kgCO2e;
  }
  for (const categoria of CATEGORIAS) porCategoria[categoria] = redondear(porCategoria[categoria]);

  if (parseo.sinReconocer.length > 0) {
    advertencias.push(
      `No entendí ${parseo.sinReconocer.length} parte(s) de tu texto, así que el total está incompleto.`,
    );
  }
  if (hayFactorSinVerificar) {
    advertencias.push(
      'Los factores de emisión de este prototipo son órdenes de magnitud sin verificar: el número sirve para comparar hábitos, no para reportar.',
    );
  }

  return {
    items,
    totalKgCO2e: redondear(total),
    porCategoria,
    equivaleAKmEnCarro: redondear(total / TRANSPORTE.carro.kgCO2ePorUnidad, 1),
    sinReconocer: parseo.sinReconocer,
    advertencias,
    motor: parseo.motor,
  };
}
