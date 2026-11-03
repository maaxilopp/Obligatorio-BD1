
import { useState } from 'react';
import './Fixture.css';
import { InsigniaEquipo } from './equipos';
import EditarPartido from './EditarPartido';
import { apiRequest } from '../services/api';

function Fixture({
  partidos = [],
  turnos = [],
  complejos = [],
  onPartidosActualizados
}) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(1);
  const [partidoEditando, setPartidoEditando] = useState(null);
  
const [errorEdicion, setErrorEdicion] = useState('');
const [mensajeExito, setMensajeExito] = useState('');


async function guardarPartido(datos) {
  if (!partidoEditando) return;

  setErrorEdicion('');
  setMensajeExito('');

  try {
    const id = partidoEditando.id_partido;

    const datosActualizados = {
      id_torneo: partidoEditando.id_torneo,
      numero_fecha: datos.numero_fecha,
      id_equipo_local: partidoEditando.id_equipo_local,
      id_equipo_visitante: partidoEditando.id_equipo_visitante,
      dia: datos.dia,
      id_turno: datos.id_turno,
      id_complejo: datos.id_complejo,
      nombre_cancha: datos.nombre_cancha
    };

    const camposModificados =
      datos.numero_fecha !== partidoEditando.numero_fecha ||
      datos.dia !== partidoEditando.dia ||
      datos.id_turno !== partidoEditando.id_turno ||
      datos.id_complejo !== partidoEditando.id_complejo ||
      datos.nombre_cancha !== partidoEditando.nombre_cancha;

    if (camposModificados) {
      await apiRequest(`/partidos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datosActualizados)
      });
    }

    if (datos.estado !== partidoEditando.estado) {
      await apiRequest(`/partidos/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado: datos.estado
        })
      });
    }

    setMensajeExito('¡Partido guardado correctamente!');
    setPartidoEditando(null);

    if (onPartidosActualizados) {
      await onPartidosActualizados();
    }

  } catch (error) {
    setErrorEdicion(
      `No se pudieron guardar todos los cambios: ${error.message}`
    );
  }
}


async function seleccionarPartidoEditar(partido) {
  setErrorEdicion('');

  try {
    const datosCompletos = await apiRequest(
      `/partidos/${partido.id_partido}/administracion`
    );

    setPartidoEditando({
      ...partido,
      ...datosCompletos
    });
  } catch (error) {
    setErrorEdicion(error.message);
  }
}


  // Contamos los partidos según su estado
  const total = partidos.length;

  const jugados = partidos.filter(
    (partido) => partido.estado === 'jugado'
  ).length;

  const programados = partidos.filter(
    (partido) => partido.estado === 'programado'
  ).length;

  const postergados = partidos.filter(
    (partido) => partido.estado === 'postergado'
  ).length;

  const cancelados = partidos.filter(
    (partido) => partido.estado === 'cancelado'
  ).length;

  // Obtenemos las fechas del torneo
  const fechas = [...new Set(
    partidos.map((partido) => partido.numero_fecha)
  )].sort((a, b) => a - b);

  // Filtramos los partidos de la fecha seleccionada
  const partidosFecha = partidos.filter(
    (partido) => partido.numero_fecha === fechaSeleccionada
  );

  return (
    <section className="fixture-contenedor">

      <div className="fixture-encabezado">
        <div>
          <p className="fixture-etiqueta">TORNEO INTERFACULTADES</p>
          <h1>Fixture</h1>
        </div>
      </div>

      {/* Resumen de los partidos */}
      <div className="fixture-resumen">
        <span>{total} partidos</span>
        <span className="resumen-jugado">{jugados} jugados</span>
        <span className="resumen-programado">
          {programados} programados
        </span>
        <span className="resumen-postergado">
          {postergados} postergados
        </span>
        <span className="resumen-cancelado">
          {cancelados} cancelados
        </span>
      </div>

      {/* Selección de fechas */}
      <div className="fixture-fechas">
        {fechas.map((fecha) => {
          const cantidad = partidos.filter(
            (partido) => partido.numero_fecha === fecha
          ).length;

          return (
            <button
              key={fecha}
              type="button"
              className={
                fechaSeleccionada === fecha
                  ? 'fixture-fecha activa'
                  : 'fixture-fecha'
              }
              onClick={() => setFechaSeleccionada(fecha)}
            >
              <strong>Fecha {fecha}</strong>
              <small>{cantidad} partidos</small>
            </button>
          );
        })}
      </div>

      {/* Listado de encuentros */}
      {errorEdicion && (
  <p className="error">{errorEdicion}</p>
)}

{mensajeExito && (
  <p className="fixture-mensaje-exito">
    ✓ {mensajeExito}
  </p>
)}

<div className="fixture-cuerpo">
      <div className="fixture-partidos">

        {partidosFecha.length === 0 ? (
          <p>No hay partidos para esta fecha.</p>
        ) : (
          
partidosFecha.map((partido) => {
  const turno = turnos.find(
    (t) => Number(t.id_turno) === Number(partido.id_turno)
  );

  const complejo = complejos.find(
    (c) => Number(c.id_complejo) === Number(partido.id_complejo)
  );

  return (

            <article
              className="fixture-partido"
              key={partido.id_partido}
            >


            <div className="fixture-enfrentamiento">
            <div className="fixture-equipo-con-escudo">
                <InsigniaEquipo
                id={partido.id_local}
                nombre={partido.equipo_local}
                />
                <span className="fixture-equipo">
                {partido.equipo_local}
                </span>
            </div>

            <span className="fixture-vs">VS</span>

            <div className="fixture-equipo-con-escudo">
                <span className="fixture-equipo">
                {partido.equipo_visitante}
                </span>
                <InsigniaEquipo
                id={partido.id_visitante}
                nombre={partido.equipo_visitante}
                />
            </div>
            </div>


              
<div className="fixture-detalles">

  <strong className="fixture-horario">
    {turno?.hora_inicio || 'Sin horario'}
  </strong>

  <span className="fixture-estado-texto">
    {partido.estado}
  </span>

  <span className="fixture-dia">
    {partido.dia}
  </span>

  <span>
    {complejo?.nombre || 'Complejo no disponible'}
    {' · '}
    {partido.nombre_cancha}
  </span>

  <span
    className={`fixture-estado estado-${partido.estado}`}
  >
    {partido.estado}
  </span>

  

{partido.estado !== 'jugado' && (
  <button
    type="button"
    className="fixture-boton-editar"
    onClick={() => seleccionarPartidoEditar(partido)}
  >
    ✎ Editar
  </button>
)}



</div>


            </article>
          );
        })
    )}


      </div>

{partidoEditando && (
  <EditarPartido
    key={partidoEditando.id_partido}
    partido={partidoEditando}
    turnos={turnos}
    complejos={complejos}
    onCancelar={() => setPartidoEditando(null)}
    onGuardar={guardarPartido}
  />
)}

</div>

    </section>
  );
}

export default Fixture;
