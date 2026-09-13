import { factorDe } from './factors';
import type { Estimacion, ItemEstimado, Recomendacion } from './types';

/**
 * Motor de recomendaciones: convierte un total en una decisión que el dueño
 * del negocio puede tomar mañana.
 *
 * Todo lo que aparece aquí es **aritmética sobre el resultado ya calculado**,
 * no texto generado. Cada recomendación simula una intervención concreta
 * —cambiar un vehículo, separar residuos, apagar lo que no se usa— y reporta
 * el ahorro que produce con los mismos factores del catálogo.
 *
 * Por qué no lo escribe el LLM: un consejo redactado por el modelo suena mejor
 * y trae un número inventado. Un dueño que compra dos camionetas eléctricas
 * porque la app dijo "ahorrarías 40%" merece que ese 40% salga de una resta
 * que alguien pueda revisar. El LLM entiende la frase; el código hace la
 * cuenta.
 */


/** Sustituciones directas: misma actividad, tecnología más limpia. */
const SUSTITUCIONES: Readonly<Record<string, { destino: string; accion: string }>> = {
  camioneta: { destino: 'camioneta_electrica', accion: 'cambiar la camioneta de reparto por una eléctrica' },
  carro: { destino: 'carro_electrico', accion: 'cambiar el carro de la empresa por uno eléctrico' },
  residuos: { destino: 'residuos_reciclados', accion: 'separar y reciclar esos residuos en vez de mandarlos al relleno' },
  carne_res: { destino: 'pollo', accion: 'cambiar la carne de res por pollo en el menú del día' },
};

/** Reducciones de consumo: misma tecnología, menos uso. */
const REDUCCIONES: Readonly<Record<string, { fraccion: number; accion: string }>> = {
  electricidad: {
    fraccion: 0.15,
    accion: 'apagar equipos en horas muertas y pasar la iluminación a LED, que suele recortar cerca del 15% del consumo',
  },
  moto_domicilio: {
    fraccion: 0.2,
    accion: 'agrupar las entregas por zona, que suele recortar cerca del 20% de los kilómetros recorridos',
  },
  gas_natural: {
    fraccion: 0.1,
    accion: 'revisar fugas y mantenimiento de los quemadores, que suele recortar cerca del 10% del consumo',
  },
};

function redondear(valor: number, decimales = 2): number {
  const escala = 10 ** decimales;
  return Math.round(valor * escala) / escala;
}

/** Agrupa por clave: tres mensajes de camionetas son una sola decisión. */
function agrupar(items: readonly ItemEstimado[]): Map<string, ItemEstimado> {
  const agrupado = new Map<string, ItemEstimado>();
  for (const item of items) {
    const previo = agrupado.get(item.clave);
    agrupado.set(
      item.clave,
      previo === undefined
        ? item
        : { ...previo, cantidad: previo.cantidad + item.cantidad, kgCO2e: previo.kgCO2e + item.kgCO2e },
    );
  }
  return agrupado;
}

export function recomendar(estimacion: Estimacion, maximo = 3): Recomendacion[] {
  if (estimacion.totalKgCO2e <= 0) return [];

  const recomendaciones: Recomendacion[] = [];
  const porClave = agrupar(estimacion.items);

  for (const [clave, item] of porClave) {
    const sustitucion = SUSTITUCIONES[clave];
    if (sustitucion !== undefined) {
      const destino = factorDe(sustitucion.destino);
      // Una sustitución solo se sugiere si de verdad ahorra: si el factor
      // destino fuera mayor, el "consejo" empeoraría la huella.
      if (destino !== undefined && destino.kgCO2ePorUnidad < item.factor) {
        const ahorro = item.cantidad * (item.factor - destino.kgCO2ePorUnidad);
        recomendaciones.push({
          titulo: `Considera ${sustitucion.accion}`,
          detalle:
            `${item.etiqueta} aporta ${redondear(item.kgCO2e)} kg CO₂e. ` +
            `Con ${destino.etiqueta.toLowerCase()} esa misma actividad quedaría en ` +
            `${redondear(item.cantidad * destino.kgCO2ePorUnidad)} kg.`,
          ahorroKgCO2e: redondear(ahorro),
          ahorroPorcentaje: redondear((ahorro / estimacion.totalKgCO2e) * 100, 1),
          categoria: item.categoria,
        });
        continue;
      }
    }

    const reduccion = REDUCCIONES[clave];
    if (reduccion !== undefined) {
      const ahorro = item.kgCO2e * reduccion.fraccion;
      recomendaciones.push({
        titulo: `Considera ${reduccion.accion}`,
        detalle:
          `${item.etiqueta} aporta ${redondear(item.kgCO2e)} kg CO₂e, ` +
          `el ${redondear((item.kgCO2e / estimacion.totalKgCO2e) * 100, 1)}% de tu día.`,
        ahorroKgCO2e: redondear(ahorro),
        ahorroPorcentaje: redondear((ahorro / estimacion.totalKgCO2e) * 100, 1),
        categoria: item.categoria,
      });
    }
  }

  return recomendaciones
    .filter((r) => r.ahorroKgCO2e > 0)
    .sort((a, b) => b.ahorroKgCO2e - a.ahorroKgCO2e)
    .slice(0, maximo);
}

/**
 * Qué actividad manda en el total. La interfaz lo usa para decir una frase
 * corta ("hoy tu huella la manda la flota") antes de cualquier recomendación.
 */
export function mayorContribuyente(estimacion: Estimacion): ItemEstimado | null {
  let mayor: ItemEstimado | null = null;
  for (const item of agrupar(estimacion.items).values()) {
    if (mayor === null || item.kgCO2e > mayor.kgCO2e) mayor = item;
  }
  return mayor;
}
