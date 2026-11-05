import { useEffect, useState } from "react";
import { confirmar } from "./confirmar";
import { apiRequest } from "../services/api";
import {
  Acciones,
  BotonesPanel,
  Campo,
  FilaVacia,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";
import { colorEquipo } from "./colores";
import SelectorEdicion from "./SelectorEdicion";
import {
  diaCorto,
  fechaPendiente,
  formatearCi,
  ordenarTorneos,
} from "./torneo";
import "./Sanciones.css";

const ETIQUETA_MOTIVO = {
  roja: "Roja",
  "acumulacion de amarillas": "Acumulación",
  disciplinaria: "Disciplinaria",
};

const MAX_FECHA = 127;

// Orden de las cartas de la próxima fecha
const ORDEN_MOTIVO = ["roja", "acumulacion de amarillas", "disciplinaria"];

const FORMULARIO_VACIO = {
  ci_jugador: "",
  numero_fecha_inicio: "1",
  cantidad_fechas: "1",
  descripcion: "",
};

function enteroEntre(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo;
}

function validar(f) {
  const errores = [];
  if (!f.ci_jugador) errores.push("Elegí un jugador.");
  if (!enteroEntre(f.numero_fecha_inicio, 1, MAX_FECHA)) {
    errores.push(`La fecha de inicio tiene que estar entre 1 y ${MAX_FECHA}.`);
  }
  if (!enteroEntre(f.cantidad_fechas, 1, MAX_FECHA)) {
    errores.push(`La cantidad de fechas tiene que estar entre 1 y ${MAX_FECHA}.`);
  }
  if (!f.descripcion.trim()) errores.push("Escribí el motivo de la sanción.");
  if (f.descripcion.trim().length > 255) {
    errores.push("El motivo no puede tener más de 255 caracteres.");
  }
  return errores;
}

// 3, 2 -> "3 y 4" | 3, 3 -> "3, 4 y 5" | 3, 6 -> "3 a 8"
function textoFechas(inicio, cantidad) {
  if (cantidad === 1) return String(inicio);
  if (cantidad > 3) return `${inicio} a ${inicio + cantidad - 1}`;
  const fechas = Array.from({ length: cantidad }, (_, i) => inicio + i);
  return `${fechas.slice(0, -1).join(", ")} y ${fechas.at(-1)}`;
}

function cumpleEnFecha(sancion, fecha) {
  return (
    fecha >= sancion.numero_fecha_inicio &&
    fecha < sancion.numero_fecha_inicio + sancion.cantidad_fechas
  );
}

// Lo que se ve sobre la carta según el motivo de la sanción
function encabezadoCarta(sancion) {
  if (sancion.motivo === "roja") return "Roja directa";
  if (sancion.motivo === "disciplinaria") return "Disciplinaria";
  const amarillas = sancion.descripcion?.match(/\d+/)?.[0] || "3";
  return `${amarillas} amarillas`;
}

function CartaSancion({ sancion, jugador }) {
  const tipo =
    sancion.motivo === "roja"
      ? "roja"
      : sancion.motivo === "disciplinaria"
        ? "disciplinaria"
        : "amarilla";
  const cantidad = sancion.cantidad_fechas;
  const fechas = textoFechas(sancion.numero_fecha_inicio, cantidad);

  return (
    <article className="sancion-item">
      <div className={`carta-marco ${tipo}`}>
        {tipo === "amarilla" && (
          <>
            <span className="carta-fondo uno" />
            <span className="carta-fondo dos" />
          </>
        )}

        <div className="carta">
          <small>{encabezadoCarta(sancion)}</small>
          <strong>
            {jugador?.nombre}
            <br />
            {jugador?.apellido}
          </strong>
          {tipo === "disciplinaria" && <p>{sancion.descripcion}</p>}
          <small>
            {cantidad === 1 ? "Fecha" : "Fechas"} {fechas}
          </small>
        </div>
      </div>

      <span className="sancion-facultad">
        <i style={{ backgroundColor: colorEquipo(jugador?.id_equipo) }} />
        {jugador?.facultad}
      </span>
    </article>
  );
}

function Sanciones() {
  // El planillero solo consulta; el resto es del administrador
  const esAdmin = localStorage.getItem("rol") === "administrador";

  const [torneos, setTorneos] = useState([]);
  const [torneoId, setTorneoId] = useState("");
  const [sanciones, setSanciones] = useState([]);
  const [partidos, setPartidos] = useState([]);
  // Jugadores inscriptos en la edición, con su equipo y facultad
  const [inscriptos, setInscriptos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // "" | "tarjetas" | "disciplinarias"
  const [filtro, setFiltro] = useState("");

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  function cargarTorneo(idTorneo) {
    return Promise.all([
      apiRequest(`/sanciones?id_torneo=${idTorneo}`),
      apiRequest(`/equipos?id_torneo=${idTorneo}`),
      apiRequest(`/partidos?id_torneo=${idTorneo}`),
    ])
      .then(async ([listaSanciones, equipos, listaPartidos]) => {
        const planteles = await Promise.all(
          equipos.map((equipo) =>
            apiRequest(`/equipos/${equipo.id_equipo}/jugadores`).then((js) =>
              js.map((j) => ({
                ...j,
                equipo: equipo.nombre,
                id_equipo: equipo.id_equipo,
                facultad: equipo.facultad,
              })),
            ),
          ),
        );
        setSanciones(listaSanciones);
        setPartidos(listaPartidos);
        setInscriptos(planteles.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    apiRequest("/torneos")
      .then((lista) => {
        const ordenados = ordenarTorneos(lista);
        setTorneos(ordenados);
        if (ordenados.length === 0) {
          setCargando(false);
          return null;
        }
        // Abre en la edición en curso (si hay) o en la última
        const inicial =
          ordenados.find((t) => t.estado === "en curso") || ordenados[0];
        setTorneoId(String(inicial.id_torneo));
        return cargarTorneo(inicial.id_torneo);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  function cambiarTorneo(idTorneo) {
    setTorneoId(idTorneo);
    setEdicion(null);
    setError("");
    setMensajeExito("");
    setCargando(true);
    cargarTorneo(idTorneo);
  }

  function edicionCreada(torneo) {
    setTorneos((anteriores) => ordenarTorneos([...anteriores, torneo]));
    cambiarTorneo(String(torneo.id_torneo));
  }

  const jugadorPorCi = new Map(inscriptos.map((j) => [j.ci, j]));
  const nombreJugador = (ci) => {
    const jugador = jugadorPorCi.get(ci);
    return jugador ? `${jugador.nombre} ${jugador.apellido}` : ci;
  };

  // Las sanciones por tarjeta las genera la base; las disciplinarias se cargan acá
  const porTarjeta = sanciones.filter((s) => s.id_tarjeta !== null);
  const disciplinarias = sanciones.filter((s) => s.id_tarjeta === null);
  const visibles =
    filtro === "tarjetas"
      ? porTarjeta
      : filtro === "disciplinarias"
        ? disciplinarias
        : sanciones;

  // Quiénes no pueden jugar la próxima fecha
  const proximaFecha = fechaPendiente(partidos);
  const diaProximaFecha = partidos
    .filter(
      (p) => p.numero_fecha === proximaFecha && p.estado !== "cancelado",
    )
    .map((p) => p.dia)
    .sort()[0];
  const suspendidos =
    proximaFecha === null
      ? []
      : sanciones
          .filter((s) => cumpleEnFecha(s, proximaFecha))
          .sort(
            (a, b) =>
              ORDEN_MOTIVO.indexOf(a.motivo) - ORDEN_MOTIVO.indexOf(b.motivo),
          );

  // ---------- alta, edición y baja ----------

  function abrirNueva() {
    setEdicion({ modo: "nuevo" });
    setFormulario({
      ...FORMULARIO_VACIO,
      numero_fecha_inicio: String(proximaFecha ?? 1),
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function abrirEditar(sancion) {
    setEdicion({ modo: "editar", id: sancion.id_sancion });
    setFormulario({
      ci_jugador: sancion.ci_jugador,
      numero_fecha_inicio: String(sancion.numero_fecha_inicio),
      cantidad_fechas: String(sancion.cantidad_fechas),
      descripcion: sancion.descripcion || "",
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function cerrar() {
    setEdicion(null);
    setError("");
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario({ ...formulario, [name]: value });
    setError("");
  }

  const esNueva = edicion?.modo === "nuevo";
  const errores = validar(formulario);
  const original = sanciones.find((s) => s.id_sancion === edicion?.id);
  const sinCambios =
    Boolean(original) &&
    formulario.ci_jugador === original.ci_jugador &&
    Number(formulario.numero_fecha_inicio) === original.numero_fecha_inicio &&
    Number(formulario.cantidad_fechas) === original.cantidad_fechas &&
    formulario.descripcion.trim() === (original.descripcion || "");

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    const datos = {
      ci_jugador: formulario.ci_jugador,
      id_torneo: Number(torneoId),
      motivo: "disciplinaria",
      numero_fecha_inicio: Number(formulario.numero_fecha_inicio),
      cantidad_fechas: Number(formulario.cantidad_fechas),
      descripcion: formulario.descripcion.trim(),
    };

    try {
      if (esNueva) {
        await apiRequest("/sanciones", {
          method: "POST",
          body: JSON.stringify(datos),
        });
        setMensajeExito(`Se sancionó a ${nombreJugador(datos.ci_jugador)}.`);
      } else {
        await apiRequest(`/sanciones/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setMensajeExito("¡Sanción guardada correctamente!");
      }

      setEdicion(null);
      await cargarTorneo(torneoId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(sancion) {
    if (
      !(await confirmar(
        `¿Eliminar la sanción de ${nombreJugador(sancion.ci_jugador)}?`,
      ))
    ) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/sanciones/${sancion.id_sancion}`, { method: "DELETE" });
      setMensajeExito("La sanción fue eliminada.");
      if (edicion?.id === sancion.id_sancion) setEdicion(null);
      await cargarTorneo(torneoId);
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  // Jugadores agrupados por equipo para el selector
  const equiposConJugadores = [...new Set(inscriptos.map((j) => j.equipo))];

  const filtros = [
    { valor: "", etiqueta: "Todas", cantidad: sanciones.length },
    { valor: "tarjetas", etiqueta: "Tarjetas", cantidad: porTarjeta.length },
    {
      valor: "disciplinarias",
      etiqueta: "Disciplinarias",
      cantidad: disciplinarias.length,
    },
  ];

  const panel = esAdmin && edicion && (
    <PanelLateral titulo="Sanción disciplinaria" className="sanciones-panel">
      <form onSubmit={guardar} noValidate>
        <Campo id="sancion-jugador" etiqueta="Jugador">
          <select
            id="sancion-jugador"
            name="ci_jugador"
            value={formulario.ci_jugador}
            onChange={cambiarCampo}
          >
            <option value="">Elegir</option>
            {equiposConJugadores.map((equipo) => (
              <optgroup key={equipo} label={equipo}>
                {inscriptos
                  .filter((j) => j.equipo === equipo)
                  .map((jugador) => (
                    <option key={jugador.ci} value={jugador.ci}>
                      {jugador.nombre} {jugador.apellido} -{" "}
                      {formatearCi(jugador.ci)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Campo>

        <div className="jugador-fila">
          <Campo id="sancion-inicio" etiqueta="Desde la fecha">
            <input
              id="sancion-inicio"
              name="numero_fecha_inicio"
              type="number"
              min={1}
              max={MAX_FECHA}
              value={formulario.numero_fecha_inicio}
              onChange={cambiarCampo}
            />
          </Campo>

          <Campo id="sancion-cantidad" etiqueta="Fechas">
            <input
              id="sancion-cantidad"
              name="cantidad_fechas"
              type="number"
              min={1}
              max={MAX_FECHA}
              value={formulario.cantidad_fechas}
              onChange={cambiarCampo}
            />
          </Campo>
        </div>

        <Campo id="sancion-descripcion" etiqueta="Motivo">
          <textarea
            id="sancion-descripcion"
            name="descripcion"
            maxLength={255}
            value={formulario.descripcion}
            onChange={cambiarCampo}
            placeholder="Qué pasó"
          />
        </Campo>

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar="Guardar"
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>
    </PanelLateral>
  );

  return (
    <section className="jugadores-pagina sanciones-pagina">
      <SelectorEdicion
        torneos={torneos}
        torneoSeleccionado={torneoId}
        cambiarTorneo={cambiarTorneo}
        onEdicionCreada={edicionCreada}
      />

      <div className="pagina-encabezado">
        <h1>Sanciones</h1>

        {esAdmin && (
          <button
            type="button"
            className="boton-pixel lila"
            onClick={abrirNueva}
          >
            + Sanción disciplinaria
          </button>
        )}
      </div>

      {error && !panel && <p className="jugadores-error">{error}</p>}
      {mensajeExito && <p className="jugadores-exito">✓ {mensajeExito}</p>}

      {proximaFecha !== null && !cargando && (
        <section className="sanciones-proxima">
          <header>
            <h2>No juegan la Fecha {proximaFecha}</h2>
            <span>{diaCorto(diaProximaFecha)}</span>
          </header>

          {suspendidos.length === 0 ? (
            <p className="sanciones-sin-suspendidos">
              Nadie está suspendido para esta fecha.
            </p>
          ) : (
            <div className="sanciones-cartas">
              {suspendidos.map((sancion) => (
                <CartaSancion
                  key={sancion.id_sancion}
                  sancion={sancion}
                  jugador={jugadorPorCi.get(sancion.ci_jugador)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div
        className={panel ? "jugadores-cuerpo con-panel" : "jugadores-cuerpo"}
      >
        <div className="jugadores-tarjeta">
          <div className="sanciones-historial-cabecera">
            <h2>Historial</h2>

            <div className="jugadores-chips">
              {filtros.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  className={filtro === opcion.valor ? "activo" : ""}
                  onClick={() => setFiltro(opcion.valor)}
                >
                  {opcion.etiqueta} <span>{opcion.cantidad}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="jugadores-tabla-contenedor">
            <table className="jugadores-tabla">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Motivo</th>
                  <th>Fechas</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>

              <tbody>
                <FilaVacia
                  columnas={4}
                  cargando={cargando}
                  hayDatos={visibles.length > 0}
                  texto="No hay sanciones en esta edición."
                />

                {visibles.map((sancion) => {
                  const porTarjeta = sancion.id_tarjeta !== null;
                  const jugador = jugadorPorCi.get(sancion.ci_jugador);

                  return (
                    <tr
                      key={sancion.id_sancion}
                      className={
                        edicion?.id === sancion.id_sancion ? "seleccionado" : ""
                      }
                    >
                      <td>
                        <div className="jugador-celda">
                          <span
                            className="jugador-facultad-color"
                            style={{
                              backgroundColor: colorEquipo(jugador?.id_equipo),
                            }}
                          />
                          <div>
                            <strong>{nombreJugador(sancion.ci_jugador)}</strong>
                            <small>{jugador?.facultad}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="sancion-motivo">
                          {porTarjeta && (
                            <i
                              className={
                                sancion.motivo === "roja"
                                  ? "tarjetita roja"
                                  : "tarjetita amarilla"
                              }
                            />
                          )}
                          <span
                            className={`cat-estado motivo-${sancion.motivo.replaceAll(" ", "-")}`}
                            title={
                              porTarjeta
                                ? `${sancion.descripcion}. Se corrige desde la planilla.`
                                : sancion.descripcion || undefined
                            }
                          >
                            {ETIQUETA_MOTIVO[sancion.motivo] || sancion.motivo}
                          </span>
                        </span>
                      </td>
                      <td className="cat-mono">
                        {textoFechas(
                          sancion.numero_fecha_inicio,
                          sancion.cantidad_fechas,
                        )}
                      </td>
                      <td>
                        {esAdmin && !porTarjeta && (
                          <Acciones
                            nombre="la sanción"
                            onEditar={() => abrirEditar(sancion)}
                            onBorrar={() => eliminar(sancion)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {panel}
      </div>
    </section>
  );
}

export default Sanciones;
