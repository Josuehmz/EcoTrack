'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { Analisis } from '@/lib/types';

const EJEMPLOS = [
  'Hoy usamos 5 camionetas de reparto y gastamos 200kWh de luz',
  'Hicimos 40 domicilios en moto y sacamos 25 kg de basura',
  'Dos camiones hicieron 120 km en total y gastamos 45 m3 de gas',
  'Tres camionetas, 60 km cada una, y reciclamos 18 kg',
];

const UNIDADES: Record<string, string> = {
  km: 'km',
  porcion: 'porción(es)',
  kWh: 'kWh',
  m3: 'm³',
  kg: 'kg',
};

const CATEGORIAS: Record<string, string> = {
  flota: 'Flota',
  energia: 'Energía',
  residuos: 'Residuos',
  transporte: 'Transporte',
  alimentacion: 'Alimentación',
};

interface Turno {
  readonly id: number;
  readonly texto: string;
  readonly analisis: Analisis | null;
  readonly error: string | null;
}

export default function Pagina() {
  const [texto, setTexto] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // El hilo crece hacia abajo: sin esto, la respuesta nueva queda fuera de
  // pantalla y el dueño del negocio cree que no pasó nada.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turnos, cargando]);

  const totalDia = turnos.reduce((suma, turno) => suma + (turno.analisis?.totalKgCO2e ?? 0), 0);
  const totalRedondeado = Math.round(totalDia * 100) / 100;

  async function enviar(entrada: string) {
    const limpio = entrada.trim();
    if (limpio.length < 3 || cargando) return;

    setTexto('');
    setCargando(true);
    const id = Date.now();

    try {
      const respuesta = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio }),
      });
      const cuerpo = await respuesta.json();
      setTurnos((previos) => [
        ...previos,
        respuesta.ok
          ? { id, texto: limpio, analisis: cuerpo.data as Analisis, error: null }
          : { id, texto: limpio, analisis: null, error: cuerpo?.error?.mensaje ?? 'No se pudo analizar.' },
      ]);
    } catch {
      setTurnos((previos) => [
        ...previos,
        { id, texto: limpio, analisis: null, error: 'No se pudo contactar el servicio.' },
      ]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <div>
          <h1>EcoTrack AI</h1>
          <p>Cuéntame el día de tu negocio y te digo cuánto pesó.</p>
        </div>
        {turnos.length > 0 && (
          <div className="marcador" aria-live="polite">
            <strong>{totalRedondeado}</strong>
            <span>kg CO₂e hoy</span>
          </div>
        )}
      </header>

      <section className="hilo">
        {turnos.length === 0 && (
          <div className="vacio">
            <p>
              Escríbelo como se lo contarías a un socio: <em>&ldquo;Hoy usamos 5 camionetas de
              reparto y gastamos 200kWh de luz&rdquo;</em>. Sin formularios.
            </p>
          </div>
        )}

        {turnos.map((turno) => (
          <article key={turno.id} className="turno">
            <p className="burbuja-usuario">{turno.texto}</p>

            {turno.error !== null && <p className="burbuja-error">{turno.error}</p>}

            {turno.analisis !== null && <Analisis analisis={turno.analisis} />}
          </article>
        ))}

        {cargando && <p className="pensando">Analizando…</p>}
        <div ref={finRef} />
      </section>

      <form
        className="compositor"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar(texto);
        }}
      >
        <div className="ejemplos">
          {EJEMPLOS.map((ejemplo) => (
            <button key={ejemplo} type="button" disabled={cargando} onClick={() => void enviar(ejemplo)}>
              {ejemplo}
            </button>
          ))}
        </div>
        <div className="fila">
          <input
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Hoy usamos 5 camionetas de reparto y gastamos 200kWh de luz"
            maxLength={600}
            aria-label="Describe la actividad de tu negocio"
          />
          <button type="submit" disabled={cargando || texto.trim().length < 3}>
            {cargando ? '…' : 'Analizar'}
          </button>
        </div>
        <p className="pie">
          Estimación con factores sin verificar: sirve para comparar decisiones, no para reportar.{' '}
          <Link href="/personal">¿Eres una persona y no un negocio?</Link>
        </p>
      </form>
    </main>
  );
}

function Analisis({ analisis }: { analisis: Analisis }) {
  const mayor = analisis.mayorContribuyente;

  return (
    <div className="burbuja-analisis">
      <p className="total-linea">
        <strong>{analisis.totalKgCO2e} kg CO₂e</strong>
        <span>≈ {analisis.equivaleAKmEnCarro} km en carro</span>
        <span className="motor">{analisis.motor === 'ia' ? 'IA' : 'reglas'}</span>
      </p>

      {mayor !== null && analisis.items.length > 1 && (
        <p className="titular">
          Lo que más pesa hoy: <strong>{mayor.etiqueta}</strong>, {mayor.kgCO2e} kg.
        </p>
      )}

      {analisis.items.length > 0 && (
        <ul className="items">
          {analisis.items.map((item, indice) => (
            <li key={`${item.clave}-${indice}`}>
              <span className="etiqueta">
                {item.etiqueta}
                <small> · {CATEGORIAS[item.categoria] ?? item.categoria}</small>
              </span>
              <span className="cantidad">
                {item.cantidad} {UNIDADES[item.unidad] ?? item.unidad}
                {item.detalle !== undefined && <small> ({item.detalle})</small>}
              </span>
              <span className="kg">{item.kgCO2e} kg</span>
            </li>
          ))}
        </ul>
      )}

      {analisis.recomendaciones.length > 0 && (
        <div className="recomendaciones">
          <h2>Qué puedes hacer mañana</h2>
          {analisis.recomendaciones.map((recomendacion) => (
            <div key={recomendacion.titulo} className="recomendacion">
              <p className="accion">
                {recomendacion.titulo}
                <span className="ahorro">
                  −{recomendacion.ahorroKgCO2e} kg ({recomendacion.ahorroPorcentaje}%)
                </span>
              </p>
              <p className="porque">{recomendacion.detalle}</p>
            </div>
          ))}
        </div>
      )}

      {analisis.sinReconocer.length > 0 && (
        <p className="aviso">
          <strong>No entendí:</strong> {analisis.sinReconocer.join(' · ')}. El total no lo incluye.
        </p>
      )}

      {analisis.advertencias.map((advertencia) => (
        <p key={advertencia} className="aviso">
          {advertencia}
        </p>
      ))}
    </div>
  );
}
