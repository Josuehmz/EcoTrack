import { estimar } from '../lib/estimate';
import { FLOTA } from '../lib/factors';
import {
  KG_POR_CILINDRO_GLP,
  KM_POR_DOMICILIO,
  KM_POR_VEHICULO_OMISION,
  analizarConReglas,
} from '../lib/parser';
import { mayorContribuyente, recomendar } from '../lib/recomendacion';

function analizar(texto: string) {
  return analizarConReglas(texto).actividades;
}

function estimarTexto(texto: string) {
  return estimar(analizarConReglas(texto));
}

describe('la frase del enunciado del capstone', () => {
  const texto = 'Hoy usamos 5 camionetas de reparto y gastamos 200kWh de luz';
  const actividades = analizar(texto);

  it('reconoce la flota y la energía como dos actividades', () => {
    expect(actividades).toHaveLength(2);
    expect(actividades.map((a) => a.clave).sort()).toEqual(['camioneta', 'electricidad']);
  });

  it('multiplica los vehículos por el kilometraje asumido y lo declara', () => {
    const flota = actividades.find((a) => a.categoria === 'flota');
    expect(flota?.cantidad).toBe(5 * KM_POR_VEHICULO_OMISION);
    expect(flota?.cantidadAsumida).toBe(true);
    expect(flota?.detalle).toContain('5 x 40');
  });

  it('lee los kWh tal como los dijo el usuario, sin asumir nada', () => {
    const energia = actividades.find((a) => a.categoria === 'energia');
    expect(energia?.cantidad).toBe(200);
    expect(energia?.cantidadAsumida).toBeUndefined();
  });

  it('el total suma las dos categorías y advierte el supuesto', () => {
    const resultado = estimarTexto(texto);
    expect(resultado.porCategoria.flota).toBeCloseTo(200 * FLOTA.camioneta.kgCO2ePorUnidad, 6);
    expect(resultado.porCategoria.energia).toBeCloseTo(32, 6);
    expect(resultado.totalKgCO2e).toBeCloseTo(82, 6);
    expect(resultado.advertencias.join(' ')).toMatch(/40 km asumidos/);
  });
});

describe('flota: el multiplicador y la ambigüedad de "cada uno"', () => {
  it('sin número, un solo vehículo', () => {
    expect(analizar('salió la camioneta')[0]?.cantidad).toBe(KM_POR_VEHICULO_OMISION);
  });

  it('con "cada una", la distancia se multiplica por los vehículos', () => {
    const actividad = analizar('tres camionetas, 60 km cada una')[0];
    expect(actividad?.cantidad).toBe(180);
    expect(actividad?.detalle).toContain('cada uno');
    expect(actividad?.cantidadAsumida).toBeUndefined();
  });

  it('sin "cada", la distancia se lee como el total de la flota', () => {
    const actividad = analizar('dos camiones hicieron 120 km')[0];
    expect(actividad?.cantidad).toBe(120);
    expect(actividad?.detalle).toContain('en total entre 2');
  });

  it('la diferencia entre las dos lecturas no es cosmética', () => {
    const cada = analizar('5 camionetas 100 km cada una')[0]?.cantidad;
    const total = analizar('5 camionetas 100 km')[0]?.cantidad;
    expect(cada).toBe(500);
    expect(total).toBe(100);
  });

  it('distingue la camioneta eléctrica de la diésel', () => {
    expect(analizar('2 camionetas electricas')[0]?.clave).toBe('camioneta_electrica');
    expect(analizar('2 camionetas')[0]?.clave).toBe('camioneta');
  });

  it('el factor de flota es por vehículo, no por pasajero: pesa más que un carro', () => {
    expect(FLOTA.camion.kgCO2ePorUnidad).toBeGreaterThan(FLOTA.camioneta.kgCO2ePorUnidad);
    expect(estimarTexto('un camion 100 km').totalKgCO2e).toBeGreaterThan(
      estimarTexto('un carro 100 km').totalKgCO2e,
    );
  });
});

describe('energía, residuos y domicilios', () => {
  it('lee gas natural en metros cúbicos', () => {
    const actividad = analizar('gastamos 45 m3 de gas')[0];
    expect(actividad?.clave).toBe('gas_natural');
    expect(actividad?.cantidad).toBe(45);
    expect(actividad?.unidad).toBe('m3');
  });

  it('convierte cilindros de GLP a kilos y lo marca como supuesto', () => {
    const actividad = analizar('usamos 2 cilindros')[0];
    expect(actividad?.clave).toBe('glp');
    expect(actividad?.cantidad).toBe(2 * KG_POR_CILINDRO_GLP);
    expect(actividad?.cantidadAsumida).toBe(true);
  });

  it('separa los residuos reciclados de los que van al relleno', () => {
    expect(analizar('sacamos 30 kg de basura')[0]?.clave).toBe('residuos');
    expect(analizar('reciclamos 30 kg')[0]?.clave).toBe('residuos_reciclados');
  });

  it('reciclar pesa menos que mandar al relleno', () => {
    expect(estimarTexto('reciclamos 30 kg').totalKgCO2e).toBeLessThan(
      estimarTexto('sacamos 30 kg de basura').totalKgCO2e,
    );
  });

  it('convierte domicilios en kilómetros de moto y lo declara', () => {
    const actividad = analizar('hicimos 40 domicilios')[0];
    expect(actividad?.clave).toBe('moto_domicilio');
    expect(actividad?.cantidad).toBe(40 * KM_POR_DOMICILIO);
    expect(actividad?.cantidadAsumida).toBe(true);
    expect(actividad?.detalle).toContain('40 entregas');
  });
});

describe('recomendaciones: cada consejo trae su aritmética', () => {
  it('propone la camioneta eléctrica con el ahorro exacto', () => {
    const estimacion = estimarTexto('5 camionetas 100 km cada una');
    const [recomendacion] = recomendar(estimacion);
    // 500 km x (0,25 - 0,05) = 100 kg exactos, no una cifra redactada.
    expect(recomendacion?.ahorroKgCO2e).toBeCloseTo(100, 6);
    expect(recomendacion?.titulo).toMatch(/eléctrica/i);
    expect(recomendacion?.ahorroPorcentaje).toBeCloseTo(80, 1);
  });

  it('propone reciclar cuando hay residuos al relleno', () => {
    const recomendaciones = recomendar(estimarTexto('sacamos 100 kg de basura'));
    expect(recomendaciones[0]?.titulo).toMatch(/recicla/i);
    expect(recomendaciones[0]?.ahorroKgCO2e).toBeCloseTo(45, 6);
  });

  it('ordena por ahorro y no por el orden en que se escribieron', () => {
    const estimacion = estimarTexto('2 camionetas 100 km cada una, y gastamos 50 kWh');
    const recomendaciones = recomendar(estimacion);
    expect(recomendaciones.length).toBeGreaterThan(1);
    for (let i = 1; i < recomendaciones.length; i += 1) {
      expect(recomendaciones[i - 1]!.ahorroKgCO2e).toBeGreaterThanOrEqual(
        recomendaciones[i]!.ahorroKgCO2e,
      );
    }
  });

  it('no sugiere nada cuando no hay nada que ahorrar', () => {
    expect(recomendar(estimarTexto('vinimos todos en bici'))).toEqual([]);
    expect(recomendar(estimarTexto('no hicimos nada'))).toEqual([]);
  });

  it('nunca propone una sustitución que empeore la huella', () => {
    for (const recomendacion of recomendar(estimarTexto('5 camionetas, 30 kg de basura, 80 kWh'))) {
      expect(recomendacion.ahorroKgCO2e).toBeGreaterThan(0);
    }
  });

  it('agrupa la misma actividad dicha en varios mensajes', () => {
    const separado = estimarTexto('2 camionetas 50 km cada una, 3 camionetas 50 km cada una');
    const recomendaciones = recomendar(separado);
    // 5 camionetas x 50 km = 250 km; el consejo se da sobre el total, no dos veces.
    expect(recomendaciones).toHaveLength(1);
    expect(recomendaciones[0]?.ahorroKgCO2e).toBeCloseTo(250 * (0.25 - 0.05), 6);
  });

  it('identifica qué actividad manda en el total', () => {
    const mayor = mayorContribuyente(estimarTexto('5 camionetas 100 km cada una, y 10 kWh'));
    expect(mayor?.clave).toBe('camioneta');
  });

  it('sin actividades no hay mayor contribuyente', () => {
    expect(mayorContribuyente(estimarTexto('estuvimos cerrados'))).toBeNull();
  });
});

describe('la coma que separaba el vehículo de su kilometraje', () => {
  it('fusiona una distancia huérfana con los vehículos que la preceden', () => {
    // Sin la fusión esto daba 120 km (3 x 40 asumidos) en vez de 180, y el
    // "60 km cada una" del usuario se perdía sin que nada avisara.
    const actividad = analizar('tres camionetas, 60 km cada una')[0];
    expect(actividad?.cantidad).toBe(180);
    expect(actividad?.cantidadAsumida).toBeUndefined();
  });

  it('la fusión no se traga un fragmento que sí es una actividad', () => {
    const claves = analizar('tres camionetas, 60 km cada una, reciclamos 18 kg').map((a) => a.clave);
    expect(claves).toEqual(['camioneta', 'residuos_reciclados']);
  });

  it('una distancia al inicio no tiene a quién pegarse y no rompe nada', () => {
    expect(() => analizar('60 km cada una')).not.toThrow();
  });
});

describe('el vehículo nombrado una vez se cuenta una vez', () => {
  it('"40 domicilios en moto" no suma además un trayecto en moto', () => {
    // Antes del arreglo esto devolvía dos actividades: los 240 km de las
    // entregas y otros 5 km asumidos por la palabra "moto" que sobraba.
    const actividades = analizar('hicimos 40 domicilios en moto');
    expect(actividades).toHaveLength(1);
    expect(actividades[0]?.clave).toBe('moto_domicilio');
    expect(actividades[0]?.cantidad).toBe(40 * KM_POR_DOMICILIO);
  });

  it('una moto sin domicilios sigue siendo transporte personal', () => {
    const actividades = analizar('fui en moto 12 km');
    expect(actividades).toHaveLength(1);
    expect(actividades[0]?.clave).toBe('moto');
    expect(actividades[0]?.cantidad).toBe(12);
  });

  it('el caso completo del ejemplo queda en tres actividades, no cuatro', () => {
    const claves = analizar('Hicimos 40 domicilios en moto y sacamos 25 kg de basura').map(
      (a) => a.clave,
    );
    expect(claves).toEqual(['moto_domicilio', 'residuos']);
  });
});
