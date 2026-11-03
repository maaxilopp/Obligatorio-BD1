import './TablaPosiciones.css';
import { InsigniaEquipo } from './equipos';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "2026-11-08" -> Date local (sin corrimiento por zona horaria)
function parsearDia(dia) {
  if (!dia) return null;
  const [anio, mes, numero] = String(dia).substring(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, numero);
}

function diaCorto(dia) {
  const fecha = parsearDia(dia);
  if (!fecha) return '';
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${DIAS[fecha.getDay()].substring(0, 3)} ${dd}/${mm}`;
}

function diaLargo(dia) {
  const fecha = parsearDia(dia);
  if (!fecha) return '';
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${DIAS[fecha.getDay()]} ${dd}/${mm}`;
}

function conSigno(numero) {
  const valor = Number(numero);
  return valor > 0 ? `+${valor}` : `${valor}`;
}

// "Complejo Deportivo UCU" + "Cancha 1" -> "UCU 1"
function nombreCancha(partido, complejos) {
  const complejo = complejos.find((c) => c.id_complejo === partido.id_complejo);
  const corto = complejo ? complejo.nombre.split(' ').pop() : '';
  const cancha = (partido.nombre_cancha || '').split(' ').pop();
  return `${corto} ${cancha}`.trim();
}

function TablaPosiciones({
  torneos = [],
  torneoSeleccionado = '',
  cambiarTorneo,
  posiciones = [],
  rachas = [],
  partidos = [],
  goleadores = [],
  turnos = [],
  complejos = [],
  sanciones = [],
  irA,
}) {
  const lider = posiciones[0];

  const idPorNombre = Object.fromEntries(
    posiciones.map((equipo) => [equipo.equipo, equipo.id_equipo])
  );
  const horaTurno = Object.fromEntries(
    turnos.map((turno) => [turno.id_turno, turno.hora_inicio])
  );

  const vigentes = partidos.filter((p) => p.estado !== 'cancelado');

  // Próxima fecha: la primera que todavía tiene partidos sin jugar
  const pendientes = vigentes.filter((p) => p.estado !== 'jugado');
  const proximaFecha = pendientes.length
    ? Math.min(...pendientes.map((p) => p.numero_fecha))
    : null;
  const partidosProxima = vigentes.filter((p) => p.numero_fecha === proximaFecha);
  const diaProxima = partidosProxima.map((p) => p.dia).sort()[0];

  const complejoProxima = complejos.find(
    (c) => c.id_complejo === partidosProxima[0]?.id_complejo
  );

  // Última fecha con resultados
  const jugados = vigentes.filter((p) => p.estado === 'jugado');
  const ultimaFecha = jugados.length
    ? Math.max(...jugados.map((p) => p.numero_fecha))
    : null;
  const resultados = jugados.filter((p) => p.numero_fecha === ultimaFecha);
  const diaUltima = resultados.map((p) => p.dia).sort()[0];

  const suspendidos = proximaFecha
    ? sanciones.filter(
        (s) =>
          s.numero_fecha_inicio <= proximaFecha &&
          proximaFecha <= s.numero_fecha_inicio + s.cantidad_fechas - 1
      ).length
    : 0;

  const torneoActual = torneos.find(
    (t) => String(t.id_torneo) === String(torneoSeleccionado)
  );

  return (
    <div className="posiciones-pagina">
      {proximaFecha && (
        <div className="banner-fecha">
          Fecha {proximaFecha} - {diaLargo(diaProxima)}
          {complejoProxima && <> en el {complejoProxima.nombre}</>}
        </div>
      )}

      <section className="posiciones-contenedor">
        <div className="posiciones-encabezado">
          <div>
            <div className="posiciones-edicion">
              <span>EDICIÓN</span>
              <select
                value={torneoSeleccionado}
                onChange={(event) => cambiarTorneo(event.target.value)}
              >
                {torneos.map((torneo) => (
                  <option key={torneo.id_torneo} value={torneo.id_torneo}>
                    {torneo.nombre}
                  </option>
                ))}
                {!torneoActual && <option value="">Seleccioná un torneo</option>}
              </select>
            </div>

            <h1 className="titulo-pixel">Tabla de posiciones</h1>

            <p className="posiciones-cita">
              “El resultado es una impostura: lo que importa es la nobleza de los
              recursos”
              <br />- Marcelo Bielsa
            </p>
          </div>

          {lider && (
            <div className="lider-circulo">
              <span className="lider-etiqueta">LÍDER DEL TORNEO</span>
              <InsigniaEquipo id={lider.id_equipo} nombre={lider.equipo} tamano="lg" />
              <strong>{lider.equipo}</strong>
              <span className="lider-datos">
                {lider.pts} pts - {conSigno(lider.dg)} - {lider.gf} GF
              </span>
            </div>
          )}
        </div>

        <div className="posiciones-grilla">
          <div className="posiciones-principal">
            {posiciones.length === 0 ? (
              <p>No hay posiciones disponibles para este torneo.</p>
            ) : (
              <div className="tarjeta tabla-tarjeta">
                <table className="tabla-posiciones">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="col-equipo">Equipo</th>
                      <th className="col-num">PJ</th>
                      <th className="col-num">G</th>
                      <th className="col-num">E</th>
                      <th className="col-num">P</th>
                      <th className="col-num">GF</th>
                      <th className="col-num">GC</th>
                      <th className="col-num">DG</th>
                      <th>Racha</th>
                      <th className="col-pts">Pts</th>
                    </tr>
                  </thead>

                  <tbody>
                    {posiciones.map((equipo) => {
                      const racha = (
                        rachas.find((r) => r.equipo === equipo.equipo)?.ultimos_3 || ''
                      )
                        .split(' ')
                        .filter((r) => ['G', 'E', 'P'].includes(r));

                      return (
                        <tr key={equipo.id_equipo}>
                          <td className="col-puesto">{equipo.posicion}</td>
                          <td className="col-equipo">
                            <div className="equipo-info">
                              <InsigniaEquipo id={equipo.id_equipo} nombre={equipo.equipo} />
                              <div>
                                <strong>{equipo.equipo}</strong>
                                <small>{equipo.facultad}</small>
                              </div>
                            </div>
                          </td>
                          <td className="col-num">{equipo.pj}</td>
                          <td className="col-num">{equipo.pg}</td>
                          <td className="col-num">{equipo.pe}</td>
                          <td className="col-num">{equipo.pp}</td>
                          <td className="col-num">{equipo.gf}</td>
                          <td className="col-num">{equipo.gc}</td>
                          <td className="col-num col-dg">{conSigno(equipo.dg)}</td>
                          <td>
                            <div className="racha-equipo">
                              {racha.map((resultado, index) => (
                                <span
                                  key={index}
                                  className={`racha-cuadro racha-${resultado}`}
                                >
                                  {resultado}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="col-pts">{equipo.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {ultimaFecha && (
              <>
                <div className="resultados-titulo">
                  <h2 className="titulo-pixel">Resultados de la Fecha {ultimaFecha}</h2>
                  <span className="texto-mono">{diaCorto(diaUltima)}</span>
                </div>

                <div className="resultados-grilla">
                  {resultados.map((partido) => (
                    <article key={partido.id_partido} className="tarjeta resultado-tarjeta">
                      <div className="resultado-marcador">
                        <InsigniaEquipo
                          id={idPorNombre[partido.equipo_local]}
                          nombre={partido.equipo_local}
                          tamano="sm2"
                        />
                        <span className="marcador">
                          {partido.goles_local} - {partido.goles_visitante}
                        </span>
                        <InsigniaEquipo
                          id={idPorNombre[partido.equipo_visitante]}
                          nombre={partido.equipo_visitante}
                          tamano="sm2"
                        />
                      </div>
                      <div className="resultado-equipos">
                        <strong>{partido.equipo_local}</strong>
                        <strong>{partido.equipo_visitante}</strong>
                      </div>
                      <p className="texto-mono resultado-detalle">
                        {nombreCancha(partido, complejos)} - {horaTurno[partido.id_turno]} -{' '}
                        <button type="button" onClick={() => irA('Planillas')}>
                          Ver planilla
                        </button>
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>

          <aside className="posiciones-lateral">
            {proximaFecha && (
              <div className="tarjeta lateral-tarjeta">
                <div className="lateral-encabezado lateral-azul">
                  <h3 className="titulo-pixel">Fecha {proximaFecha}</h3>
                  <span className="texto-mono">{diaCorto(diaProxima)}</span>
                </div>

                {partidosProxima.map((partido) => (
                  <div key={partido.id_partido} className="fixture-partido">
                    <div className="fixture-equipos">
                      <div>
                        <InsigniaEquipo
                          id={idPorNombre[partido.equipo_local]}
                          nombre={partido.equipo_local}
                          tamano="sm"
                        />
                        <strong>{partido.equipo_local}</strong>
                      </div>
                      <div>
                        <InsigniaEquipo
                          id={idPorNombre[partido.equipo_visitante]}
                          nombre={partido.equipo_visitante}
                          tamano="sm"
                        />
                        <strong>{partido.equipo_visitante}</strong>
                      </div>
                    </div>

                    {partido.estado === 'postergado' ? (
                      <span className="etiqueta-postergado">Postergado</span>
                    ) : (
                      <span className="texto-mono fixture-hora">
                        {horaTurno[partido.id_turno]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {goleadores.length > 0 && (
              <div className="tarjeta lateral-tarjeta">
                <div className="lateral-encabezado lateral-verde">
                  <h3 className="titulo-pixel">Goleadores</h3>
                </div>

                {goleadores.slice(0, 7).map((goleador) => (
                  <div key={`${goleador.jugador}-${goleador.equipo}`} className="goleador-fila">
                    <span className="goleador-puesto">{goleador.posicion}</span>
                    <InsigniaEquipo
                      id={idPorNombre[goleador.equipo]}
                      nombre={goleador.equipo}
                      tamano="sm"
                    />
                    <strong>{goleador.jugador}</strong>
                    <span className="goleador-goles">{goleador.goles}</span>
                  </div>
                ))}
              </div>
            )}

            {proximaFecha && (
              <button
                type="button"
                className="tarjeta aviso-suspendidos"
                onClick={() => irA('Sanciones')}
              >
                <span className="icono-tarjetas">
                  <span className="tarjeta-roja" />
                  <span className="tarjeta-amarilla" />
                </span>
                <span className="titulo-pixel">
                  {suspendidos} {suspendidos === 1 ? 'suspendido' : 'suspendidos'} para la
                  Fecha {proximaFecha}
                </span>
                <span className="aviso-flecha">→</span>
              </button>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

export default TablaPosiciones;
