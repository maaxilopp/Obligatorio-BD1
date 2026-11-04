
import { useState } from 'react';
import { apiRequest } from '../services/api';
import { InsigniaEquipo } from './equipos';
import './Planillas.css';

function Planillas({ partidos = [], onActualizar }) {
  const [fecha, setFecha] = useState(null);
  const [partido, setPartido] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [gol, setGol] = useState({
    ci_jugador: '', minuto: '', autogol: false
  });
  const [tarjeta, setTarjeta] = useState({
    ci_jugador: '', minuto: '', color: 'amarilla'
  });

  const fechas = [...new Set(partidos.map(p => p.numero_fecha))]
    .sort((a, b) => a - b);
  const fechaActual = fecha ?? fechas[0];
  const partidosVisibles = partidos.filter(
    p => p.numero_fecha === fechaActual
  );
  const editable = partido &&
    ['programado', 'postergado'].includes(partido.estado);

  async function consultar(partidoElegido) {
    setCargando(true);
    setError('');
    setDatos(null);
    try {
      const id = partidoElegido.id_partido;
      const [plantel, planilla, goles, tarjetas] = await Promise.all([
        apiRequest(`/partidos/${id}/plantel`),
        apiRequest(`/partidos/${id}/planilla`),
        apiRequest(`/partidos/${id}/goles`),
        apiRequest(`/partidos/${id}/tarjetas`)
      ]);
      setDatos({ plantel, planilla, goles, tarjetas });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function elegirPartido(p) {
    setPartido(p);
    setExito('');
    setGol({ ci_jugador: '', minuto: '', autogol: false });
    setTarjeta({ ci_jugador: '', minuto: '', color: 'amarilla' });
    consultar(p);
  }

  async function ejecutar(accion, mensaje) {
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await accion();
      await consultar(partido);
      setExito(mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function cambiarJugador(jugador) {
    const incluido = datos.planilla.some(
      j => j.ci_jugador === jugador.ci
    );
    const id = partido.id_partido;

    ejecutar(
      () => incluido
        ? apiRequest(`/partidos/${id}/planilla/${jugador.ci}`, {
            method: 'DELETE'
          })
        : apiRequest(`/partidos/${id}/planilla`, {
            method: 'POST',
            body: JSON.stringify({
              ci_jugador: jugador.ci,
              id_equipo: jugador.id_equipo
            })
          }),
      'Planilla actualizada correctamente.'
    );
  }

  async function registrarGol(e) {
    e.preventDefault();
    await ejecutar(
      () => apiRequest(`/partidos/${partido.id_partido}/goles`, {
        method: 'POST',
        body: JSON.stringify({
          ci_jugador: gol.ci_jugador,
          minuto: Number(gol.minuto),
          autogol: gol.autogol
        })
      }),
      'Gol registrado correctamente.'
    );
    setGol({ ci_jugador: '', minuto: '', autogol: false });
  }

  async function registrarTarjeta(e) {
    e.preventDefault();
    await ejecutar(
      () => apiRequest(`/partidos/${partido.id_partido}/tarjetas`, {
        method: 'POST',
        body: JSON.stringify({
          ci_jugador: tarjeta.ci_jugador,
          minuto: Number(tarjeta.minuto),
          color: tarjeta.color
        })
      }),
      'Tarjeta registrada correctamente.'
    );
    setTarjeta({ ci_jugador: '', minuto: '', color: 'amarilla' });
  }

  async function eliminarRegistro(tipo, id) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await ejecutar(
      () => apiRequest(
        `/partidos/${partido.id_partido}/${tipo}/${id}`,
        { method: 'DELETE' }
      ),
      'Registro eliminado.'
    );
  }

  async function cerrarPartido() {
    if (!window.confirm(
      '¿Marcar este partido como jugado? Esta acción cierra la carga de la planilla.'
    )) return;

    setGuardando(true);
    setError('');
    try {
      await apiRequest(
        `/partidos/${partido.id_partido}/marcar-jugado`,
        { method: 'POST' }
      );
      setPartido({ ...partido, estado: 'jugado' });
      setExito('¡Partido cerrado correctamente!');
      await onActualizar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const jugadoresIncluidos = datos
    ? datos.plantel.filter(j =>
        datos.planilla.some(p => p.ci_jugador === j.ci)
      )
    : [];

  return (
    <section className="planillas-contenedor">
      <div className="planillas-encabezado">
        <p className="planillas-etiqueta">TORNEO INTERFACULTADES</p>
        <h1>Planillas</h1>
        <p className="planillas-subtitulo">
          Gestión de jugadores, goles y tarjetas por partido.
        </p>
      </div>

      <div className="planillas-fechas">
        {fechas.map(numero => (
          <button
            key={numero}
            type="button"
            className={fechaActual === numero ? 'activa' : ''}
            onClick={() => {
              setFecha(numero);
              setPartido(null);
              setDatos(null);
            }}
          >
            Fecha {numero}
          </button>
        ))}
      </div>

      <div className="planillas-listado">
        {partidosVisibles.map(p => (
          <button
            key={p.id_partido}
            type="button"
            className={
              partido?.id_partido === p.id_partido
                ? 'planillas-partido seleccionado'
                : 'planillas-partido'
            }
            onClick={() => elegirPartido(p)}
          >
            <span className="planillas-fecha">
              Fecha {p.numero_fecha}
            </span>
            <div className="planillas-equipos">
              <span className="planillas-equipo">
                <InsigniaEquipo
                  id={p.id_equipo_local}
                  nombre={p.equipo_local}
                />
                {p.equipo_local}
              </span>
              <strong>
                {p.estado === 'jugado'
                  ? `${p.goles_local} - ${p.goles_visitante}`
                  : 'VS'}
              </strong>
              <span className="planillas-equipo">
                {p.equipo_visitante}
                <InsigniaEquipo
                  id={p.id_equipo_visitante}
                  nombre={p.equipo_visitante}
                />
              </span>
            </div>
            <span className={`planillas-estado estado-${p.estado}`}>
              {p.estado}
            </span>
          </button>
        ))}
      </div>

      {partido && (
        <div className="planillas-detalle">
          <div className="planillas-detalle-cabecera">
            <div>
              <p className="planillas-etiqueta">PLANILLA DEL ENCUENTRO</p>
              <h2>
                {partido.equipo_local} vs {partido.equipo_visitante}
              </h2>
            </div>
            <button type="button" onClick={() => {
              setPartido(null);
              setDatos(null);
            }}>
              Cerrar vista ×
            </button>
          </div>

          {cargando && <p>Cargando...</p>}
          {error && <p className="error">{error}</p>}
          {exito && <p className="planillas-exito">{exito}</p>}

          {datos && (
            <>
              <div className="planillas-jugadores">
                {[partido.equipo_local, partido.equipo_visitante].map(
                  equipo => (
                    <div className="planillas-plantel" key={equipo}>
                      <h3>{equipo}</h3>
                      {datos.plantel.filter(j => j.equipo === equipo)
                        .map(j => {
                          const incluido = datos.planilla.some(
                            p => p.ci_jugador === j.ci
                          );
                          return (
                            <div className="planillas-jugador" key={j.ci}>
                              <span>
                                #{j.numero_camiseta} {j.nombre} {j.apellido}
                                {j.suspendido ? ' (suspendido)' : ''}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  !editable || guardando ||
                                  Boolean(j.suspendido)
                                }
                                onClick={() => cambiarJugador(j)}
                              >
                                {incluido ? 'Quitar' : 'Agregar'}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )
                )}
              </div>

              {editable && (
                <div className="planillas-formularios">
                  <form onSubmit={registrarGol}>
                    <h3>⚽ Registrar gol</h3>
                    <select
                      required
                      value={gol.ci_jugador}
                      onChange={e => setGol({
                        ...gol, ci_jugador: e.target.value
                      })}
                    >
                      <option value="">Seleccionar jugador</option>
                      {jugadoresIncluidos.map(j => (
                        <option key={j.ci} value={j.ci}>
                          {j.nombre} {j.apellido} — {j.equipo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      placeholder="Minuto"
                      required
                      value={gol.minuto}
                      onChange={e => setGol({
                        ...gol, minuto: e.target.value
                      })}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={gol.autogol}
                        onChange={e => setGol({
                          ...gol, autogol: e.target.checked
                        })}
                      /> Autogol
                    </label>
                    <button disabled={guardando || jugadoresIncluidos.length === 0}>
                        Agregar gol
                    </button>
                  </form>

                  <form onSubmit={registrarTarjeta}>
                    <h3>🟨 Registrar tarjeta</h3>
                    <select
                      required
                      value={tarjeta.ci_jugador}
                      onChange={e => setTarjeta({
                        ...tarjeta, ci_jugador: e.target.value
                      })}
                    >
                      <option value="">Seleccionar jugador</option>
                      {jugadoresIncluidos.map(j => (
                        <option key={j.ci} value={j.ci}>
                          {j.nombre} {j.apellido} — {j.equipo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      required
                      placeholder="Minuto"
                      value={tarjeta.minuto}
                      onChange={e => setTarjeta({
                        ...tarjeta, minuto: e.target.value
                      })}
                    />
                    <select
                      value={tarjeta.color}
                      onChange={e => setTarjeta({
                        ...tarjeta, color: e.target.value
                      })}
                    >
                      <option value="amarilla">Amarilla</option>
                      <option value="roja">Roja</option>
                    </select>
                    <button disabled={guardando || jugadoresIncluidos.length === 0}>
                        Agregar tarjeta
                    </button>
                  </form>
                </div>
              )}

              <div className="planillas-registros-grid">
                <div className="planillas-registros">
                  <h3>Goles ({datos.goles.length})</h3>
                  {datos.goles.length === 0 && <p>Sin goles registrados.</p>}
                  {datos.goles.map(g => (
                    <div className="planillas-registro" key={g.id_gol}>
                      <span>
                        ⚽ {g.minuto}' — {g.jugador}
                        {g.autogol ? ' (autogol)' : ''}
                      </span>
                      {editable && (
                        <button
                          disabled={guardando}
                          onClick={() => eliminarRegistro('goles', g.id_gol)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="planillas-registros">
                  <h3>Tarjetas ({datos.tarjetas.length})</h3>
                  {datos.tarjetas.length === 0 && <p>Sin tarjetas.</p>}
                  {datos.tarjetas.map(t => (
                    <div className="planillas-registro" key={t.id_tarjeta}>
                      <span>
                        {t.color === 'roja' ? '🟥' : '🟨'}
                        {' '}{t.minuto}' — {t.jugador}
                      </span>
                      {editable && (
                        <button
                          disabled={guardando}
                          onClick={() =>
                            eliminarRegistro('tarjetas', t.id_tarjeta)
                          }
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {editable && (
                <button
                  type="button"
                  className="planillas-cerrar-partido"
                  disabled={guardando}
                  onClick={cerrarPartido}
                >
                  ✓ Marcar partido como jugado
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default Planillas;
