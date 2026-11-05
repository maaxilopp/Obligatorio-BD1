import { useEffect, useState } from "react";
import { confirmar } from "./confirmar";
import "./Fixture.css";
import { InsigniaEquipo } from "./equipos";
import EditarPartido from "./EditarPartido";
import SelectorEdicion from "./SelectorEdicion";
import { apiRequest } from "../services/api";

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function diaCorto(dia) {
  if (!dia) return "";
  const [anio, mes, numero] = dia.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, numero);
  return `${DIAS_SEMANA[fecha.getDay()]} ${String(numero).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

function plural(cantidad, singular, varios) {
  return cantidad === 1 ? singular : varios;
}

function IconoLapiz() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 13l1-4 7-7 3 3-7 7-4 1zM9.5 3.5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconoTacho() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5M7 6.5v5M9 6.5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Fixture({
  partidos = [],
  turnos = [],
  complejos = [],
  torneos = [],
  torneoSeleccionado = "",
  cambiarTorneo,
  onEdicionCreada,
  onPartidosActualizados,
  onAbrirPlanilla,
}) {
  const esAdmin = localStorage.getItem("rol") === "administrador";
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [formulario, setFormulario] = useState(null);

  const [errorEdicion, setErrorEdicion] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  const [canchas, setCanchas] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [suspendidos, setSuspendidos] = useState({});
  useEffect(() => {
    if (complejos.length === 0) return;

    Promise.all(
      complejos.map((complejo) =>
        apiRequest(`/complejos/${complejo.id_complejo}/canchas`).then((lista) =>
          lista.map((cancha) => ({ ...cancha, complejo: complejo.nombre })),
        ),
      ),
    )
      .then((listas) => setCanchas(listas.flat()))
      .catch(() => setCanchas([]));
  }, [complejos]);

  useEffect(() => {
    if (!torneoSeleccionado) return;

    apiRequest(`/equipos?id_torneo=${torneoSeleccionado}`)
      .then(setEquipos)
      .catch(() => setEquipos([]));
  }, [torneoSeleccionado]);

  const idPorNombre = Object.fromEntries(
    equipos.map((equipo) => [equipo.nombre, equipo.id_equipo]),
  );

  const total = partidos.length;
  const contar = (estado) =>
    partidos.filter((partido) => partido.estado === estado).length;

  const jugados = contar("jugado");
  const programados = contar("programado");
  const postergados = contar("postergado");
  const cancelados = contar("cancelado");

  const fechas = [
    ...new Set(partidos.map((partido) => partido.numero_fecha)),
  ].sort((a, b) => a - b);

  const partidosDe = (fecha) =>
    partidos.filter((partido) => partido.numero_fecha === fecha);

  // Una fecha está terminada si y solo si todo lo que no se canceló ya se jugó
  const fechaTerminada = (fecha) => {
    const vigentes = partidosDe(fecha).filter((p) => p.estado !== "cancelado");
    return vigentes.length > 0 && vigentes.every((p) => p.estado === "jugado");
  };

  const proximaFecha = fechas.length > 0 ? fechas[fechas.length - 1] + 1 : 1;

  const fechaPorDefecto =
    fechas.find((fecha) => !fechaTerminada(fecha)) ??
    fechas[fechas.length - 1] ??
    1;

  const fechaActiva = fechaSeleccionada ?? fechaPorDefecto;
  const torneoActual = torneos.find(
    (t) => String(t.id_torneo) === String(torneoSeleccionado),
  );
  const diaDeFecha = (fecha) =>
    partidosDe(fecha)
      .map((p) => p.dia)
      .sort()[0] || "";
  const partidosFecha = partidosDe(fechaActiva);
  const pendientes = partidosFecha
    .filter((p) => p.estado === "programado" || p.estado === "postergado")
    .map((p) => p.id_partido);
  const clavePendientes = pendientes.join(",");

  useEffect(() => {
    if (!clavePendientes) return;

    const ids = clavePendientes.split(",");

    Promise.all(
      ids.map((id) =>
        apiRequest(`/partidos/${id}/plantel`).then((plantel) => {
          const porEquipo = {};
          plantel
            .filter((jugador) => jugador.suspendido)
            .forEach((jugador) => {
              porEquipo[jugador.equipo] = (porEquipo[jugador.equipo] || 0) + 1;
            });
          return [id, porEquipo];
        }),
      ),
    )
      .then((resultados) =>
        setSuspendidos((anteriores) => ({
          ...anteriores,
          ...Object.fromEntries(resultados),
        })),
      )
      .catch(() => {});
  }, [clavePendientes]);

  function elegirFecha(fecha) {
    setFechaSeleccionada(fecha);
    setFormulario(null);
  }

  function abrirNuevo(numeroFecha) {
    setErrorEdicion("");
    setMensajeExito("");
    setFormulario({ modo: "nuevo", numero_fecha: numeroFecha });
  }

  function abrirEditar(partido) {
    setErrorEdicion("");
    setMensajeExito("");
    setFormulario({
      modo: "editar",
      partido: {
        ...partido,
        id_equipo_local:
          partido.id_equipo_local ?? idPorNombre[partido.equipo_local],
        id_equipo_visitante:
          partido.id_equipo_visitante ?? idPorNombre[partido.equipo_visitante],
      },
    });
  }

  async function guardarPartido(datos) {
    setErrorEdicion("");
    setMensajeExito("");

    const cuerpo = {
      id_torneo: Number(torneoSeleccionado),
      numero_fecha: datos.numero_fecha,
      id_equipo_local: datos.id_equipo_local,
      id_equipo_visitante: datos.id_equipo_visitante,
      dia: datos.dia,
      id_turno: datos.id_turno,
      id_complejo: datos.id_complejo,
      nombre_cancha: datos.nombre_cancha,
    };

    try {
      if (formulario.modo === "nuevo") {
        await apiRequest("/partidos", {
          method: "POST",
          body: JSON.stringify(cuerpo),
        });
        setMensajeExito("¡Partido creado correctamente!");
      } else {
        const partido = formulario.partido;
        const id = partido.id_partido;

        const camposModificados =
          datos.numero_fecha !== partido.numero_fecha ||
          datos.dia !== partido.dia ||
          datos.id_turno !== partido.id_turno ||
          datos.id_complejo !== partido.id_complejo ||
          datos.nombre_cancha !== partido.nombre_cancha;

        if (camposModificados) {
          await apiRequest(`/partidos/${id}`, {
            method: "PUT",
            body: JSON.stringify(cuerpo),
          });
        }

        if (datos.estado !== partido.estado) {
          await apiRequest(`/partidos/${id}/estado`, {
            method: "PATCH",
            body: JSON.stringify({ estado: datos.estado }),
          });
        }

        setMensajeExito("¡Partido guardado correctamente!");
      }

      setFormulario(null);
      setFechaSeleccionada(datos.numero_fecha);

      if (onPartidosActualizados) {
        await onPartidosActualizados();
      }
    } catch (error) {
      setErrorEdicion(`No se pudieron guardar los cambios: ${error.message}`);
    }
  }

  async function eliminarPartido(partido) {
    const confirmado = await confirmar(
      `¿Eliminar ${partido.equipo_local} vs ${partido.equipo_visitante}?`,
    );
    if (!confirmado) return;

    setErrorEdicion("");
    setMensajeExito("");

    try {
      await apiRequest(`/partidos/${partido.id_partido}`, { method: "DELETE" });
      setMensajeExito("Partido eliminado.");

      if (formulario?.partido?.id_partido === partido.id_partido) {
        setFormulario(null);
      }

      if (onPartidosActualizados) {
        await onPartidosActualizados();
      }
    } catch (error) {
      setErrorEdicion(`No se pudo eliminar el partido: ${error.message}`);
    }
  }

  return (
    <section className="fixture-contenedor">
      <SelectorEdicion
        torneos={torneos}
        torneoSeleccionado={torneoSeleccionado}
        cambiarTorneo={cambiarTorneo}
        onEdicionCreada={onEdicionCreada}
      />

      <h1>Fixture</h1>

      <div className="fixture-encabezado">
        {/* Resumen de los partidos */}
        <div className="fixture-resumen">
          <span>
            <strong>{total}</strong> {plural(total, "partido", "partidos")}
          </span>
          <span className="resumen-jugado">
            <strong>{jugados}</strong> {plural(jugados, "jugado", "jugados")}
          </span>
          <span className="resumen-programado">
            <strong>{programados}</strong>{" "}
            {plural(programados, "programado", "programados")}
          </span>
          <span className="resumen-postergado">
            <strong>{postergados}</strong>{" "}
            {plural(postergados, "postergado", "postergados")}
          </span>
          <span className="resumen-cancelado">
            <strong>{cancelados}</strong>{" "}
            {plural(cancelados, "cancelado", "cancelados")}
          </span>
        </div>

        {esAdmin && (
          <button
            type="button"
            className="fixture-boton-nuevo"
            onClick={() => abrirNuevo(fechaActiva)}
          >
            + Partido
          </button>
        )}
      </div>

      {/* Selección de fechas */}
      <div className="fixture-fechas">
        {fechas.map((fecha) => {
          const terminada = fechaTerminada(fecha);
          const delaFecha = partidosDe(fecha);
          const primerDia = delaFecha.map((p) => p.dia).sort()[0];
          const jugadosFecha = delaFecha.filter(
            (p) => p.estado === "jugado",
          ).length;

          return (
            <button
              key={fecha}
              type="button"
              className={
                fechaActiva === fecha ? "fixture-fecha activa" : "fixture-fecha"
              }
              onClick={() => elegirFecha(fecha)}
            >
              <strong>
                Fecha {fecha}
                {terminada && <span className="fixture-fecha-check">✓</span>}
              </strong>
              <small>
                {terminada
                  ? `${jugadosFecha} ${plural(jugadosFecha, "jugado", "jugados")}`
                  : diaCorto(primerDia)}
              </small>
            </button>
          );
        })}

        {esAdmin && (
          <button
            type="button"
            className="fixture-fecha sin-programar"
            onClick={() => abrirNuevo(proximaFecha)}
          >
            <strong>Fecha {proximaFecha}</strong>
            <small>Sin programar</small>
          </button>
        )}
      </div>

      {errorEdicion && <p className="error">{errorEdicion}</p>}

      {mensajeExito && (
        <p className="fixture-mensaje-exito">✓ {mensajeExito}</p>
      )}

      <div className="fixture-cuerpo">
        {/* Listado de encuentros */}
        <div className="fixture-partidos">
          {partidosFecha.length === 0 ? (
            <p className="fixture-vacio">No hay partidos para esta fecha.</p>
          ) : (
            partidosFecha.map((partido) => {
              const turno = turnos.find(
                (t) => Number(t.id_turno) === Number(partido.id_turno),
              );

              const complejo = complejos.find(
                (c) => Number(c.id_complejo) === Number(partido.id_complejo),
              );

              const avisos = [];

              if (partido.estado === "postergado") {
                avisos.push("Falta reprogramar");
              }

              Object.entries(suspendidos[partido.id_partido] || {}).forEach(
                ([equipo, cantidad]) => {
                  if (
                    partido.estado === "programado" ||
                    partido.estado === "postergado"
                  ) {
                    avisos.push(
                      `${equipo} llega con ${cantidad} ${plural(cantidad, "suspendido", "suspendidos")}`,
                    );
                  }
                },
              );

              const editable = esAdmin && partido.estado !== "jugado";
              const seleccionado =
                formulario?.partido?.id_partido === partido.id_partido;

              return (
                <article
                  className={
                    seleccionado
                      ? "fixture-tarjeta seleccionado"
                      : "fixture-tarjeta"
                  }
                  key={partido.id_partido}
                >
                  <div className="fixture-enfrentamiento">
                    <div className="fixture-equipo-con-escudo">
                      <InsigniaEquipo
                        id={
                          partido.id_equipo_local ??
                          idPorNombre[partido.equipo_local]
                        }
                        nombre={partido.equipo_local}
                      />
                      <span className="fixture-equipo">
                        {partido.equipo_local}
                      </span>
                    </div>

                    {partido.estado === "jugado" ? (
                      <span className="fixture-vs fixture-marcador">
                        {partido.goles_local} - {partido.goles_visitante}
                      </span>
                    ) : (
                      <span className="fixture-vs">vs</span>
                    )}

                    <div className="fixture-equipo-con-escudo visitante">
                      <span className="fixture-equipo">
                        {partido.equipo_visitante}
                      </span>
                      <InsigniaEquipo
                        id={
                          partido.id_equipo_visitante ??
                          idPorNombre[partido.equipo_visitante]
                        }
                        nombre={partido.equipo_visitante}
                      />
                    </div>
                  </div>

                  <div className="fixture-detalles">
                    <div className="fixture-detalles-fila">
                      <strong
                        className={
                          partido.estado === "postergado" ||
                          partido.estado === "cancelado"
                            ? "fixture-horario tachado"
                            : "fixture-horario"
                        }
                      >
                        {turno?.hora_inicio || "--:--"}
                      </strong>

                      <span
                        className={`fixture-estado estado-${partido.estado}`}
                      >
                        {partido.estado}
                      </span>
                    </div>

                    <span className="fixture-lugar">
                      {diaCorto(partido.dia)}
                      {" · "}
                      {complejo?.nombre || "Complejo no disponible"}
                      {" - "}
                      {partido.nombre_cancha}
                    </span>

                    {avisos.map((aviso) => (
                      <span key={aviso} className="fixture-aviso">
                        {aviso}
                      </span>
                    ))}

                    {partido.estado !== "cancelado" && onAbrirPlanilla && (
                      <button
                        type="button"
                        className="fixture-boton-planilla"
                        onClick={() => onAbrirPlanilla(partido)}
                      >
                        Planilla
                      </button>
                    )}

                    {editable && (
                      <div className="fixture-acciones">
                        <button
                          type="button"
                          title="Editar partido"
                          aria-label="Editar partido"
                          onClick={() => abrirEditar(partido)}
                        >
                          <IconoLapiz />
                        </button>
                        <button
                          type="button"
                          className="fixture-boton-borrar"
                          title="Eliminar partido"
                          aria-label="Eliminar partido"
                          onClick={() => eliminarPartido(partido)}
                        >
                          <IconoTacho />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {formulario && (
          <EditarPartido
            key={
              formulario.partido?.id_partido ??
              `nuevo-${formulario.numero_fecha}`
            }
            partido={formulario.partido}
            numeroFecha={formulario.numero_fecha}
            diaSugerido={diaDeFecha(formulario.numero_fecha)}
            diaMinimo={torneoActual?.fecha_inicio}
            diaMaximo={torneoActual?.fecha_fin}
            turnos={turnos}
            canchas={canchas}
            equipos={equipos}
            partidos={partidos}
            onCambio={() => setErrorEdicion("")}
            onCancelar={() => setFormulario(null)}
            onGuardar={guardarPartido}
          />
        )}
      </div>
    </section>
  );
}

export default Fixture;
