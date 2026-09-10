'use client';

import { useState } from 'react';

import type { Estimacion } from '@/lib/types';

const EJEMPLOS = [
  'Hoy comí carne y viajé 20km en bus',
  'Desayuné huevos con pan y café, fui en bici a la universidad',
  'Almorcé pollo con arroz, 12 km en carro y gasté 3 kWh',
  'Me eché un tinto y cogí el TransMilenio 15 km',
];

const UNIDADES: Record<string, string> = { km: 'km', porcion: 'porción(es)', kWh: 'kWh' };

export default function Pagina() {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Estimacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function estimar(entrada: string) {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: entrada }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setError(cuerpo?.error?.mensaje ?? 'No se pudo estimar.');
        setResultado(null);
        return;
      }
      setResultado(cuerpo.data as Estimacion);
    } catch {
      setError('No se pudo contactar el servicio.');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main>
      <header>
        <h1>EcoTrack</h1>
        <p>Escribe lo que hiciste hoy, en tus palabras. Te devuelvo un estimado de tu huella.</p>
      </header>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          if (texto.trim().length >= 3) void estimar(texto);
        }}
      >
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Hoy comí carne y viajé 20km en bus"
          maxLength={600}
          aria-label="Describe tu día"
        />
        <div className="fila">
          <button type="submit" disabled={cargando || texto.trim().length < 3}>
            {cargando ? 'Estimando…' : 'Estimar mi huella'}
          </button>
          {resultado !== null && (
            <span className="motor">
              motor: {resultado.motor === 'ia' ? 'IA (Claude)' : 'reglas locales'}
            </span>
          )}
        </div>
        <div className="ejemplos">
          {EJEMPLOS.map((ejemplo) => (
            <button
              key={ejemplo}
              type="button"
              onClick={() => {
                setTexto(ejemplo);
                void estimar(ejemplo);
              }}
            >
              {ejemplo}
            </button>
          ))}
        </div>
      </form>

      {error !== null && <p className="error">{error}</p>}

      {resultado !== null && (
        <section aria-live="polite">
          <div className="total">
            <strong>{resultado.totalKgCO2e} kg CO₂e</strong>
            <span>
              equivale a manejar unos {resultado.equivaleAKmEnCarro} km en carro a gasolina ·
              transporte {resultado.porCategoria.transporte} · alimentación{' '}
              {resultado.porCategoria.alimentacion} · energía {resultado.porCategoria.energia}
            </span>
          </div>

          {resultado.items.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th className="num">Cantidad</th>
                  <th className="num">kg CO₂e</th>
                </tr>
              </thead>
              <tbody>
                {resultado.items.map((item, indice) => (
                  <tr key={`${item.etiqueta}-${indice}`}>
                    <td>
                      {item.etiqueta}
                      {!item.verificado && (
                        <span title={item.fuente} style={{ color: 'var(--suave)' }}>
                          {' '}
                          *
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {item.cantidad} {UNIDADES[item.unidad] ?? item.unidad}
                    </td>
                    <td className="num">{item.kgCO2e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {resultado.sinReconocer.length > 0 && (
            <div className="avisos">
              <p>
                <strong>No entendí esto:</strong> {resultado.sinReconocer.join(' · ')}
              </p>
            </div>
          )}

          {resultado.advertencias.length > 0 && (
            <div className="avisos">
              {resultado.advertencias.map((aviso) => (
                <p key={aviso}>{aviso}</p>
              ))}
            </div>
          )}

          <p className="pie">
            * factor de emisión sin verificar. Este prototipo estima órdenes de magnitud para
            comparar hábitos; no sirve para reportar emisiones.
          </p>
        </section>
      )}
    </main>
  );
}
