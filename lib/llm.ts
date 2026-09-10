import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { clavesValidas } from './factors';
import type { ResultadoParseo } from './types';

/**
 * Motor de IA opcional. Solo se usa si existe `ANTHROPIC_API_KEY`; si no,
 * EcoTrack cae al analizador por reglas.
 *
 * Por qué el LLM solo **extrae** y no **calcula**: pedirle el total de CO2e
 * significa aceptar un número que no se puede auditar y que cambia entre
 * llamadas. Aquí traduce lenguaje natural a actividades con una clave del
 * catálogo, y la multiplicación la hace el código con factores versionados.
 * El LLM aporta donde es bueno —entender "me eché un tinto y cogí el
 * TransMilenio"— y no donde es peligroso: la aritmética que va a un reporte.
 */

const ActividadIA = z.object({
  categoria: z.enum(['transporte', 'alimentacion', 'energia']),
  clave: z.string(),
  cantidad: z.number(),
  unidad: z.enum(['km', 'porcion', 'kWh']),
  textoOrigen: z.string(),
  cantidadAsumida: z.boolean(),
});

const RespuestaIA = z.object({
  actividades: z.array(ActividadIA),
  sinReconocer: z.array(z.string()),
});

function instrucciones(): string {
  return [
    'Extraes actividades de huella de carbono de una frase en español coloquial (Colombia).',
    'No calculas emisiones: solo identificas qué hizo la persona, cuánto y en qué unidad.',
    `La clave debe ser exactamente una de estas: ${clavesValidas().join(', ')}.`,
    'Unidades: transporte en km, alimentación en porcion, energía en kWh.',
    'Si el usuario no dijo la distancia de un viaje, usa 5 y marca cantidadAsumida en true.',
    'textoOrigen es el fragmento literal del usuario que produjo la actividad.',
    'Lo que no puedas mapear a una clave del catálogo va en sinReconocer, sin inventar claves.',
    'No inventes actividades que el usuario no mencionó.',
  ].join(' ');
}

export function hayMotorIA(): boolean {
  const clave = process.env['ANTHROPIC_API_KEY'];
  return typeof clave === 'string' && clave.length > 0;
}

export async function analizarConIA(texto: string): Promise<ResultadoParseo> {
  const client = new Anthropic();

  const respuesta = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 2048,
    system: instrucciones(),
    messages: [{ role: 'user', content: texto }],
    output_config: { format: zodOutputFormat(RespuestaIA) },
  });

  // En producción conviene además el parámetro `fallbacks` del servidor para
  // enrutar un rechazo a otro modelo; aquí se deja el guardia explícito porque
  // no se pudo probar el camino de fallback sin clave en este entorno.
  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo declinó procesar el texto.');
  }

  const datos = respuesta.parsed_output;
  if (datos === null) {
    throw new Error('La IA no devolvió una estructura válida.');
  }

  return {
    actividades: datos.actividades.map((a) => ({
      categoria: a.categoria,
      clave: a.clave,
      cantidad: a.cantidad,
      unidad: a.unidad,
      textoOrigen: a.textoOrigen,
      ...(a.cantidadAsumida ? { cantidadAsumida: true } : {}),
    })),
    sinReconocer: datos.sinReconocer,
    motor: 'ia',
  };
}
