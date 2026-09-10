import { NextResponse } from 'next/server';
import { z } from 'zod';

import { estimar } from '@/lib/estimate';
import { analizarConIA, hayMotorIA } from '@/lib/llm';
import { analizarConReglas } from '@/lib/parser';

const CuerpoPeticion = z
  .object({
    texto: z.string().min(3, 'Escribe al menos unas palabras').max(600, 'Máximo 600 caracteres'),
    /** Permite forzar el motor por reglas incluso si hay clave configurada. */
    motor: z.enum(['auto', 'reglas']).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json(
      { error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es JSON válido.' } },
      { status: 400 },
    );
  }

  const validado = CuerpoPeticion.safeParse(cuerpo);
  if (!validado.success) {
    return NextResponse.json(
      {
        error: {
          codigo: 'PETICION_INVALIDA',
          mensaje: 'El cuerpo de la petición no cumple el contrato.',
          detalles: validado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
      },
      { status: 400 },
    );
  }

  const { texto, motor = 'auto' } = validado.data;
  const usarIA = motor === 'auto' && hayMotorIA();

  try {
    const parseo = usarIA ? await analizarConIA(texto) : analizarConReglas(texto);
    return NextResponse.json({ data: estimar(parseo) });
  } catch (error) {
    if (!usarIA) {
      // Fallar aquí sin IA significa un defecto propio: no hay red de la cual
      // culpar. Se responde genérico y el detalle queda en el log del servidor.
      console.error('[ecotrack] fallo del analizador por reglas', error);
      return NextResponse.json(
        { error: { codigo: 'ERROR_INTERNO', mensaje: 'No se pudo estimar.' } },
        { status: 500 },
      );
    }

    // Con IA, un fallo de red o de cuota no debe dejar al usuario sin
    // respuesta: se degrada al motor por reglas y se declara en la respuesta.
    console.error('[ecotrack] la IA falló; se usa el analizador por reglas', error);
    const parseo = analizarConReglas(texto);
    const estimacion = estimar(parseo);
    return NextResponse.json({
      data: {
        ...estimacion,
        advertencias: [
          'El motor de IA no respondió; el resultado viene del analizador por reglas.',
          ...estimacion.advertencias,
        ],
      },
    });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({
    servicio: 'ecotrack-estimate',
    motorPorOmision: hayMotorIA() ? 'ia' : 'reglas',
  });
}
