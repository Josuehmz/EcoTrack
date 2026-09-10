import { KM_POR_OMISION, analizarConReglas, normalizar } from '../lib/parser';

describe('normalizar', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(normalizar('Hoy COMÍ carne y viajé 20km')).toBe('hoy comi carne y viaje 20km');
  });
});

describe('la frase del enunciado', () => {
  const { actividades, sinReconocer } = analizarConReglas('Hoy comí carne y viajé 20km en bus');

  it('reconoce las dos actividades', () => {
    expect(actividades).toHaveLength(2);
    expect(sinReconocer).toEqual([]);
  });

  it('mapea la carne a res, una porción', () => {
    const carne = actividades.find((a) => a.categoria === 'alimentacion');
    expect(carne?.clave).toBe('carne_res');
    expect(carne?.cantidad).toBe(1);
    expect(carne?.unidad).toBe('porcion');
  });

  it('mapea el bus con sus 20 km', () => {
    const bus = actividades.find((a) => a.categoria === 'transporte');
    expect(bus?.clave).toBe('bus');
    expect(bus?.cantidad).toBe(20);
    expect(bus?.cantidadAsumida).toBeUndefined();
  });
});

describe('transporte', () => {
  it('entiende kilómetros escritos de varias formas', () => {
    for (const texto of ['viajé 20km en bus', 'viajé 20 km en bus', 'viajé 20 kilómetros en bus']) {
      expect(analizarConReglas(texto).actividades[0]?.cantidad).toBe(20);
    }
  });

  it('convierte metros a kilómetros', () => {
    expect(analizarConReglas('caminé 800 metros').actividades[0]?.cantidad).toBeCloseTo(0.8, 6);
  });

  it('acepta decimales con coma o con punto', () => {
    expect(analizarConReglas('1,5 km en moto').actividades[0]?.cantidad).toBeCloseTo(1.5, 6);
    expect(analizarConReglas('1.5 km en moto').actividades[0]?.cantidad).toBeCloseTo(1.5, 6);
  });

  it('asume una distancia y lo marca cuando el usuario no la dijo', () => {
    const actividad = analizarConReglas('fui en taxi al trabajo').actividades[0];
    expect(actividad?.clave).toBe('taxi');
    expect(actividad?.cantidad).toBe(KM_POR_OMISION);
    expect(actividad?.cantidadAsumida).toBe(true);
  });

  it('distingue el carro eléctrico del carro a gasolina', () => {
    expect(analizarConReglas('10 km en carro eléctrico').actividades[0]?.clave).toBe('carro_electrico');
    expect(analizarConReglas('10 km en carro').actividades[0]?.clave).toBe('carro');
  });

  it('reconoce los nombres locales del transporte público', () => {
    expect(analizarConReglas('cogí el TransMilenio 15 km').actividades[0]?.clave).toBe('bus');
  });

  it('separa dos trayectos en fragmentos distintos', () => {
    const { actividades } = analizarConReglas('10 km en bus, luego 4 km en bici');
    expect(actividades.map((a) => a.clave)).toEqual(['bus', 'bicicleta']);
    expect(actividades.map((a) => a.cantidad)).toEqual([10, 4]);
  });
});

describe('alimentación', () => {
  it('la carne de cerdo cuenta como cerdo y no también como res', () => {
    const { actividades } = analizarConReglas('almorcé carne de cerdo');
    expect(actividades).toHaveLength(1);
    expect(actividades[0]?.clave).toBe('cerdo');
  });

  it('lee la cantidad que precede al alimento', () => {
    expect(analizarConReglas('comí 3 huevos').actividades[0]?.cantidad).toBe(3);
    expect(analizarConReglas('comí dos hamburguesas').actividades[0]?.cantidad).toBe(2);
  });

  it('sin número, una porción', () => {
    expect(analizarConReglas('comí pollo').actividades[0]?.cantidad).toBe(1);
  });

  it('reconoce varios alimentos en un mismo fragmento', () => {
    const claves = analizarConReglas('almorcé pollo con arroz').actividades.map((a) => a.clave);
    expect(claves).toContain('pollo');
    expect(claves).toContain('arroz');
  });

  it('entiende una comida y un trayecto en la misma frase sin comas', () => {
    const claves = analizarConReglas('desayuné pan con café y fui en bici 3 km').actividades.map((a) => a.clave);
    expect(claves).toEqual(expect.arrayContaining(['pan', 'cafe', 'bicicleta']));
  });
});

describe('energía', () => {
  it('lee los kWh declarados', () => {
    const actividad = analizarConReglas('gasté 3 kWh en el aire').actividades[0];
    expect(actividad?.clave).toBe('electricidad');
    expect(actividad?.cantidad).toBe(3);
    expect(actividad?.unidad).toBe('kWh');
  });
});

describe('lo que no se entiende se devuelve, no se descarta', () => {
  it('reporta el fragmento desconocido', () => {
    const { actividades, sinReconocer } = analizarConReglas('comí pollo y jugué videojuegos');
    expect(actividades).toHaveLength(1);
    expect(sinReconocer).toEqual(['jugue videojuegos']);
  });

  it('no reporta las palabras de relleno como desconocidas', () => {
    expect(analizarConReglas('hoy comí pollo en casa').sinReconocer).toEqual([]);
  });

  it('un texto sin ninguna actividad no inventa nada', () => {
    const { actividades, sinReconocer } = analizarConReglas('estuve pensando en la vida');
    expect(actividades).toEqual([]);
    expect(sinReconocer.length).toBeGreaterThan(0);
  });

  it('el texto vacío no rompe el analizador', () => {
    expect(analizarConReglas('   ').actividades).toEqual([]);
  });
});

describe('acentos', () => {
  it('reconoce palabras clave acentuadas', () => {
    // El acento está en la palabra que decide la categoría: si la
    // normalización dejara de correr, estas dos frases caerían en
    // `sinReconocer` sin que nada más fallara.
    expect(analizarConReglas('me tomé un café').actividades[0]?.clave).toBe('cafe');
    expect(analizarConReglas('viajé 8 km en avión').actividades[0]?.clave).toBe('avion');
  });

  it('el texto de origen que se devuelve al usuario ya viene normalizado', () => {
    const actividad = analizarConReglas('Hoy comí carne').actividades[0];
    // Si el acento sobrevive aquí, la normalización no corrió.
    expect(actividad?.textoOrigen).toBe('hoy comi carne');
  });
});
