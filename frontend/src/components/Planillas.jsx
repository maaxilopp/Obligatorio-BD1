
import { useState } from 'react';
import { InsigniaEquipo } from './equipos';
import './Planillas.css';

function Planillas({ partidos = [] }) {
  const [partidoSeleccionado, setPartidoSeleccionado] = useState(null);

  return (
    <section className="planillas-contenedor">

      <div className="planillas-encabezado">
        <p className="planillas-etiqueta">
          TORNEO INTERFACULTADES
        </p>
        <h1>Planillas</h1>
        <p className="planillas-subtitulo">
          Seleccioná un partido para consultar su planilla.
        </p>
      </div>

      <div className="planillas-listado">
        {partidos.length === 0 ? (
          <p>No hay partidos disponibles.</p>
        ) : (
          partidos.map((partido) => (
            <button
              type="button"
              className={
                partidoSeleccionado?.id_partido === partido.id_partido
                  ? 'planillas-partido seleccionado'
                  : 'planillas-partido'
              }
              key={partido.id_partido}
              onClick={() => setPartidoSeleccionado(partido)}
            >
              <span className="planillas-fecha">
                Fecha {partido.numero_fecha}
              </span>

              <div className="planillas-equipos">
                <span className="planillas-equipo">
                  <InsigniaEquipo
                    nombre={partido.equipo_local}
                  />
                  {partido.equipo_local}
                </span>

                <strong>VS</strong>

                <span className="planillas-equipo">
                  {partido.equipo_visitante}
                  <InsigniaEquipo
                    nombre={partido.equipo_visitante}
                  />
                </span>
              </div>

              <span className={`planillas-estado estado-${partido.estado}`}>
                {partido.estado}
              </span>
            </button>
          ))
        )}
      </div>

      {partidoSeleccionado && (
        <div className="planillas-detalle">
          <h2>Planilla del partido</h2>
          <p>
            {partidoSeleccionado.equipo_local}
            {' vs '}
            {partidoSeleccionado.equipo_visitante}
          </p>
          <p>
            Acá vamos a mostrar jugadores, goles y tarjetas.
          </p>
        </div>
      )}

    </section>
  );
}

export default Planillas;
