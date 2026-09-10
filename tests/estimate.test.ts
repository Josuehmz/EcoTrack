import { estimar } from '../lib/estimate';
import { TRANSPORTE } from '../lib/factors';
import { analizarConReglas } from '../lib/parser';
import type { ResultadoParseo } from '../lib/types';

function estimarTexto(texto: string) {
  return estimar(analizarConReglas(texto));
}

describe('estimar', () => {
  it('multiplica cantidad por factor y suma el total', () => {
    const resultado = estimarTexto('viajé 20km en bus');
    expect(resultado.items).toHaveLength(1);
    expect(resultado.items[0]?.kgCO2e).toBeCloseTo(20 * TRANSPORTE.bus.kgCO2ePorUnidad, 6);
    expect(resultado.totalKgCO2e).toBeCloseTo(2, 6);
  });

  it('el total es la suma de las categorías, sin doble contabilidad', () => {
    const { totalKgCO2e, porCategoria } = estimarTexto('comí carne, 20 km en bus y gasté 5 kWh');
    const suma = porCategoria.transporte + porCategoria.alimentacion + porCategoria.energia;
    expect(Math.abs(suma - totalKgCO2e)).toBeLessThan(0.05);
  });

  it('la bicicleta no emite en el uso, pero el carro eléctrico sí', () => {
    expect(estimarTexto('10 km en bici').totalKgCO2e).toBe(0);
    expect(estimarTexto('10 km en carro eléctrico').totalKgCO2e).toBeGreaterThan(0);
  });

  it('la carne de res pesa más que las legumbres', () => {
    expect(estimarTexto('comí carne').totalKgCO2e).toBeGreaterThan(
      estimarTexto('comí lentejas').totalKgCO2e,
    );
  });

  it('escala linealmente con la distancia', () => {
    const diez = estimarTexto('10 km en bus').totalKgCO2e;
    const veinte = estimarTexto('20 km en bus').totalKgCO2e;
    expect(veinte).toBeCloseTo(diez * 2, 6);
  });

  it('un texto sin actividades da cero y no NaN', () => {
    const resultado = estimarTexto('estuve pensando');
    expect(resultado.totalKgCO2e).toBe(0);
    expect(Number.isNaN(resultado.totalKgCO2e)).toBe(false);
  });

  it('advierte cuando quedó texto sin entender', () => {
    const resultado = estimarTexto('comí pollo y jugué videojuegos');
    expect(resultado.advertencias.join(' ')).toMatch(/no entend/i);
  });

  it('advierte que los factores no están verificados', () => {
    expect(estimarTexto('comí pollo').advertencias.join(' ')).toMatch(/sin verificar/i);
  });

  it('advierte la distancia asumida', () => {
    expect(estimarTexto('fui en taxi').advertencias.join(' ')).toMatch(/se asumieron 5 km/i);
  });

  it('da una equivalencia en kilómetros de carro para dar escala', () => {
    const resultado = estimarTexto('comí carne');
    expect(resultado.equivaleAKmEnCarro).toBeGreaterThan(0);
  });
});

describe('robustez frente a lo que puede devolver el motor de IA', () => {
  function parseoCrudo(actividades: ResultadoParseo['actividades']): ResultadoParseo {
    return { actividades, sinReconocer: [], motor: 'ia' };
  }

  it('descarta una clave que no existe en el catálogo, sin inventar factor', () => {
    const resultado = estimar(
      parseoCrudo([
        { categoria: 'alimentacion', clave: 'carne_de_dragon', cantidad: 1, unidad: 'porcion', textoOrigen: 'x' },
      ]),
    );
    expect(resultado.items).toEqual([]);
    expect(resultado.totalKgCO2e).toBe(0);
    expect(resultado.advertencias.join(' ')).toMatch(/no hay factor/i);
  });

  it('descarta cantidades no numéricas o negativas en vez de propagarlas', () => {
    const resultado = estimar(
      parseoCrudo([
        { categoria: 'transporte', clave: 'bus', cantidad: Number.NaN, unidad: 'km', textoOrigen: 'a' },
        { categoria: 'transporte', clave: 'bus', cantidad: -10, unidad: 'km', textoOrigen: 'b' },
        { categoria: 'transporte', clave: 'bus', cantidad: 10, unidad: 'km', textoOrigen: 'c' },
      ]),
    );
    expect(resultado.items).toHaveLength(1);
    expect(resultado.totalKgCO2e).toBeCloseTo(1, 6);
  });

  it('una clave heredada del prototipo no se confunde con un factor', () => {
    const resultado = estimar(
      parseoCrudo([
        { categoria: 'alimentacion', clave: 'constructor', cantidad: 1, unidad: 'porcion', textoOrigen: 'x' },
      ]),
    );
    expect(resultado.items).toEqual([]);
  });

  it('conserva el motor declarado en la respuesta', () => {
    expect(estimar(parseoCrudo([])).motor).toBe('ia');
    expect(estimarTexto('comí pollo').motor).toBe('reglas');
  });
});
