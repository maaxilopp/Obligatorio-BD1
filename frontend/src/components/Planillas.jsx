import { useEffect, useState } from "react";
import { confirmar } from "./confirmar";
import { apiRequest } from "../services/api";
import { IconoCandado } from "./CatalogoBase";
import { colorEquipo } from "./colores";
import { InsigniaEquipo } from "./equipos";
import SelectorEdicion from "./SelectorEdicion";
import { diaCorto, fechaPendiente, fechasDe } from "./torneo";
import "./Planillas.css";

const DURACION = 60;
const HORAS_CORRECCION = 48;
const DIAS_LARGOS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function finDelPartido(partido, turno) {
  if (!turno) return null;
  return new Date(`${partido.dia.slice(0, 10)}T${turno.hora_fin}:00`).getTime();
}


function momentoLargo(milisegundos) {
  const fecha = new Date(milisegundos);
  const dos = (numero) => String(numero).padStart(2, "0");
  return `${DIAS_LARGOS[fecha.getDay()]} ${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)} a las ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

function etapaPlanilla(partido, fin, ahora, estadoTorneo) {
  if (partido.estado === "cancelado" || partido.estado === "postergado") {
    return "bloqueada";
  }
  if (fin === null || fin > ahora) return "pendiente";
  if (estadoTorneo === "inscripcion") return "inscripcion";
  if (partido.estado === "programado") return "carga";
  return ahora <= fin + HORAS_CORRECCION * 3600 * 1000
    ? "correccion"
    : "cerrada";
}

// El ganador estuvo abajo en el marcador en algún momento del partido
function huboRemontada(goles, idLocal) {
  let diferencia = 0;
  let localPerdio = false;
  let visitantePerdio = false;

  goles.forEach((gol) => {
    diferencia += gol.id_equipo_beneficiado === idLocal ? 1 : -1;
    if (diferencia < 0) localPerdio = true;
    if (diferencia > 0) visitantePerdio = true;
  });

  return (
    (diferencia > 0 && localPerdio) || (diferencia < 0 && visitantePerdio)
  );
}

// Reparte los eventos de un lado en niveles para que las etiquetas no se pisen
function conNiveles(eventos) {
  const ultimos = [];

  return [...eventos]
    .sort((a, b) => a.minuto - b.minuto)
    .map((evento) => {
      let nivel = ultimos.findIndex((minuto) => evento.minuto - minuto >= 7);
      if (nivel === -1) nivel = ultimos.length;
      ultimos[nivel] = evento.minuto;
      return { ...evento, nivel };
    });
}

function LineaTiempo({ eventos }) {
  return (
    <div className="linea-tiempo">
      <div className="linea-eje">
        <span className="linea-mitad" />

        {eventos.map((evento) => (
          <div
            key={evento.clave}
            className={`linea-evento ${evento.lado}`}
            style={{
              left: `${(evento.minuto / DURACION) * 100}%`,
              "--nivel": evento.nivel,
            }}
          >
            <span className="linea-texto">
              {evento.minuto}&apos; {evento.apellido}
              {evento.autogol ? " (e.c.)" : ""}
            </span>
            {evento.tipo === "gol" ? (
              <i className="linea-gol" />
            ) : (
              <i className={`tarjetita ${evento.color}`} />
            )}
          </div>
        ))}
      </div>

      <div className="linea-escala">
        <span>0&apos;</span>
        <span>30&apos;</span>
        <span>60&apos;</span>
      </div>
    </div>
  );
}

const FORMULARIO_INICIAL = {
  ci: "",
  minuto: "",
  autogol: false,
  color: "amarilla",
};

// Misma regla que validar_expulsion en la base
function problemaExpulsion(tipo, valores, minuto, goles, tarjetas) {
  const propias = tarjetas.filter((t) => t.ci_jugador === valores.ci);
  const roja = propias.find((t) => t.color === "roja" && t.minuto < minuto);
  if (roja) return `El jugador fue expulsado en el minuto ${roja.minuto}.`;

  const amarillas = propias
    .filter((t) => t.color === "amarilla")
    .map((t) => t.minuto);
  const esRoja = tipo === "tarjeta" && valores.color === "roja";
  const esAmarilla = tipo === "tarjeta" && valores.color === "amarilla";

  if (amarillas.length >= 2) {
    if (esAmarilla) return "El jugador ya tiene dos amarillas en este partido.";
    const segunda = Math.max(...amarillas);
    if (segunda < minuto) {
      return `El jugador fue expulsado por doble amarilla en el minuto ${segunda}.`;
    }
  }

  const segundaAmarilla = esAmarilla && amarillas.length === 1;
  if (!esRoja && !segundaAmarilla) return "";

  const expulsion = esRoja ? minuto : Math.max(amarillas[0], minuto);
  const posterior = [
    ...goles.filter((g) => g.ci_jugador === valores.ci),
    ...propias,
  ].find((evento) => evento.minuto > expulsion);
  if (!posterior) return "";

  return esRoja
    ? `El jugador tiene un gol o una tarjeta en el minuto ${posterior.minuto}: la roja no puede ser anterior.`
    : `El jugador tiene un gol o una tarjeta en el minuto ${posterior.minuto}, después de su segunda amarilla.`;
}

function FormularioEvento({
  tipo,
  jugadores,
  goles,
  tarjetas,
  guardando,
  onGuardar,
  onCancelar,
}) {
  const [valores, setValores] = useState(FORMULARIO_INICIAL);
  const [problema, setProblema] = useState("");

  function cambiar(campo, valor) {
    setValores({ ...valores, [campo]: valor });
    setProblema("");
  }

  function enviar(evento) {
    evento.preventDefault();
    const minuto = Number(valores.minuto);

    if (!valores.ci) {
      setProblema("Elegí un jugador.");
      return;
    }
    if (
      tipo !== "jugador" &&
      (valores.minuto === "" ||
        !Number.isInteger(minuto) ||
        minuto < 0 ||
        minuto > DURACION)
    ) {
      setProblema(`El minuto tiene que estar entre 0 y ${DURACION}.`);
      return;
    }
    if (tipo !== "jugador") {
      const expulsion = problemaExpulsion(tipo, valores, minuto, goles, tarjetas);
      if (expulsion) {
        setProblema(expulsion);
        return;
      }
    }
    onGuardar({ ...valores, minuto });
  }

  return (
    <form className="planilla-form" onSubmit={enviar} noValidate>
      <select
        aria-label="Jugador"
        value={valores.ci}
        onChange={(evento) => cambiar("ci", evento.target.value)}
      >
        <option value="">
          {jugadores.length === 0 ? "No hay jugadores" : "Elegir jugador"}
        </option>
        {jugadores.map((jugador) => (
          <option key={jugador.ci} value={jugador.ci}>
            {jugador.numero_camiseta} · {jugador.nombre} {jugador.apellido}
          </option>
        ))}
      </select>

      {tipo !== "jugador" && (
        <input
          type="number"
          min={0}
          max={DURACION}
          placeholder="Minuto"
          aria-label="Minuto"
          value={valores.minuto}
          onChange={(evento) => cambiar("minuto", evento.target.value)}
        />
      )}

      {tipo === "gol" && (
        <label className="planilla-form-check">
          <input
            type="checkbox"
            checked={valores.autogol}
            onChange={(evento) => cambiar("autogol", evento.target.checked)}
          />
          En contra
        </label>
      )}

      {tipo === "tarjeta" && (
        <select
          aria-label="Color"
          value={valores.color}
          onChange={(evento) => cambiar("color", evento.target.value)}
        >
          <option value="amarilla">Amarilla</option>
          <option value="roja">Roja</option>
        </select>
      )}

      {problema && <p className="jugadores-error">{problema}</p>}

      <div className="planilla-form-botones">
        <button type="submit" className="boton-pixel verde" disabled={guardando}>
          Agregar
        </button>
        <button type="button" className="boton-pixel" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TarjetaEquipo({
  equipo,
  jugadores,
  enPlanilla,
  goles,
  tarjetas,
  ciCapitan,
  jugado,
  editable,
  guardando,
  formulario,
  abrirFormulario,
  cerrarFormulario,
  onAgregarJugador,
  onQuitarJugador,
  onEliminar,
  onGuardarEvento,
}) {
  const presentes = jugadores.filter((j) => enPlanilla.has(j.ci));
  const ausentes = jugadores.filter((j) => !enPlanilla.has(j.ci));
  const disponibles = ausentes.filter((j) => !j.suspendido);
  const color = colorEquipo(equipo.id);
  const tipoAbierto =
    formulario?.idEquipo === equipo.id ? formulario.tipo : null;

  return (
    <article className="planilla-equipo">
      <header style={{ backgroundColor: color }}>
        <h2>{equipo.nombre}</h2>
        <span>{presentes.length} en planilla</span>
      </header>

      {presentes.length === 0 && (
        <p className="planilla-vacia">Todavía no hay jugadores en planilla.</p>
      )}

      <ul className="planilla-jugadores">
        {presentes.map((jugador) => {
          const golesJugador = goles.filter((g) => g.ci_jugador === jugador.ci);
          const tarjetasJugador = tarjetas.filter(
            (t) => t.ci_jugador === jugador.ci,
          );
          const tieneEventos =
            golesJugador.length > 0 || tarjetasJugador.length > 0;

          return (
            <li key={jugador.ci}>
              <span
                className="planilla-numero"
                style={{ backgroundColor: color }}
              >
                {jugador.numero_camiseta}
              </span>

              <strong>
                {jugador.nombre} {jugador.apellido}
                {jugador.ci === ciCapitan && (
                  <span className="planilla-capitan" title="Capitán">
                    C
                  </span>
                )}
              </strong>

              <div className="planilla-eventos">
                {golesJugador.map((gol) => (
                  <button
                    key={gol.id_gol}
                    type="button"
                    className="planilla-gol"
                    disabled={!editable || guardando}
                    title={editable ? "Eliminar gol" : undefined}
                    onClick={() => onEliminar("goles", gol.id_gol)}
                  >
                    {gol.minuto}&apos;{gol.autogol ? " e.c." : ""}
                  </button>
                ))}

                {tarjetasJugador.map((tarjeta) => (
                  <button
                    key={tarjeta.id_tarjeta}
                    type="button"
                    className="planilla-tarjeta"
                    disabled={!editable || guardando}
                    title={editable ? "Eliminar tarjeta" : undefined}
                    onClick={() => onEliminar("tarjetas", tarjeta.id_tarjeta)}
                  >
                    <i className={`tarjetita ${tarjeta.color}`} />
                    {tarjeta.minuto}&apos;
                  </button>
                ))}

                {editable && !tieneEventos && (
                  <button
                    type="button"
                    className="planilla-quitar"
                    disabled={guardando}
                    title="Quitar de la planilla"
                    aria-label={`Quitar a ${jugador.nombre} ${jugador.apellido} de la planilla`}
                    onClick={() => onQuitarJugador(jugador)}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {ausentes.length > 0 && (
        <div className="planilla-ausentes">
          <strong>{jugado ? "No jugaron:" : "Sin cargar:"}</strong>

          {ausentes.map((jugador) =>
            editable && !jugador.suspendido ? (
              <button
                key={jugador.ci}
                type="button"
                className="planilla-ausente"
                disabled={guardando}
                title="Agregar a la planilla"
                onClick={() => onAgregarJugador(jugador)}
              >
                {jugador.nombre} {jugador.apellido}
              </button>
            ) : (
              <span
                key={jugador.ci}
                className={
                  jugador.suspendido
                    ? "planilla-ausente suspendido"
                    : "planilla-ausente"
                }
              >
                {jugador.nombre} {jugador.apellido}
                {jugador.suspendido ? " - suspendido" : ""}
              </span>
            ),
          )}
        </div>
      )}

      {editable && (
        <div className="planilla-acciones">
          {tipoAbierto ? (
            <FormularioEvento
              key={tipoAbierto}
              tipo={tipoAbierto}
              jugadores={tipoAbierto === "jugador" ? disponibles : presentes}
              goles={goles}
              tarjetas={tarjetas}
              guardando={guardando}
              onCancelar={cerrarFormulario}
              onGuardar={(valores) => onGuardarEvento(tipoAbierto, valores)}
            />
          ) : (
            <>
              <button
                type="button"
                className="boton-pixel"
                onClick={() => abrirFormulario("jugador", equipo.id)}
              >
                + Jugador
              </button>
              <button
                type="button"
                className="boton-pixel menta"
                onClick={() => abrirFormulario("gol", equipo.id)}
              >
                + Gol
              </button>
              <button
                type="button"
                className="boton-pixel crema"
                onClick={() => abrirFormulario("tarjeta", equipo.id)}
              >
                + Tarjeta
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

async function pedirPlanilla(partido) {
  const id = partido.id_partido;
  const [plantel, planilla, goles, tarjetas, local, visitante] =
    await Promise.all([
      apiRequest(`/partidos/${id}/plantel`),
      apiRequest(`/partidos/${id}/planilla`),
      apiRequest(`/partidos/${id}/goles`),
      apiRequest(`/partidos/${id}/tarjetas`),
      apiRequest(`/equipos/${partido.id_equipo_local}`),
      apiRequest(`/equipos/${partido.id_equipo_visitante}`),
    ]);

  return {
    plantel,
    planilla,
    goles,
    tarjetas,
    capitanes: {
      [local.id_equipo]: local.ci_capitan,
      [visitante.id_equipo]: visitante.ci_capitan,
    },
  };
}

function Planillas({
  partidos = [],
  turnos = [],
  complejos = [],
  torneos = [],
  torneoSeleccionado = "",
  cambiarTorneo,
  onEdicionCreada,
  onActualizar,
  partidoInicial = null,
  onVolverFixture,
}) {
  const esAdmin = localStorage.getItem("rol") === "administrador";

  const [ahora] = useState(() => Date.now());
  const [fecha, setFecha] = useState(null);
  const [elegido, setElegido] = useState(partidoInicial);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(Boolean(partidoInicial));
  const [guardando, setGuardando] = useState(false);
  const [huboCambios, setHuboCambios] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  // null | { tipo: 'jugador' | 'gol' | 'tarjeta', idEquipo }
  const [formulario, setFormulario] = useState(null);
  // null = cerrada
  const [auditoria, setAuditoria] = useState(null);

  // Después de cerrar el partido se usa el dato actualizado de la lista
  const partido = elegido
    ? (partidos.find((p) => p.id_partido === elegido.id_partido) ?? elegido)
    : null;

  async function consultar(partidoElegido) {
    setCargando(true);
    setError("");

    try {
      setDatos(await pedirPlanilla(partidoElegido));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  // Si se llegó desde el fixture, la planilla abre directo
  useEffect(() => {
    if (!partidoInicial) return;

    pedirPlanilla(partidoInicial)
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [partidoInicial]);

  function elegirPartido(p) {
    setElegido(p);
    setDatos(null);
    setExito("");
    setFormulario(null);
    setAuditoria(null);
    consultar(p);
  }

  function volver() {
    if (partidoInicial) {
      onVolverFixture?.();
      return;
    }

    setElegido(null);
    setDatos(null);
    setError("");
    setExito("");
    setFormulario(null);
    setAuditoria(null);

    if (huboCambios) {
      setHuboCambios(false);
      onActualizar?.();
    }
  }

  async function ejecutar(accion, mensaje) {
    setGuardando(true);
    setError("");
    setExito("");

    try {
      await accion();
      await consultar(partido);
      setFormulario(null);
      setHuboCambios(true);
      if (auditoria !== null) await cargarAuditoria();
      setExito(mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function agregarJugador(jugador) {
    ejecutar(
      () =>
        apiRequest(`/partidos/${partido.id_partido}/planilla`, {
          method: "POST",
          body: JSON.stringify({
            ci_jugador: jugador.ci,
            id_equipo: jugador.id_equipo,
          }),
        }),
      `${jugador.nombre} ${jugador.apellido} entró en la planilla.`,
    );
  }

  function quitarJugador(jugador) {
    ejecutar(
      () =>
        apiRequest(`/partidos/${partido.id_partido}/planilla/${jugador.ci}`, {
          method: "DELETE",
        }),
      `${jugador.nombre} ${jugador.apellido} salió de la planilla.`,
    );
  }

  function guardarEvento(tipo, valores) {
    if (tipo === "jugador") {
      agregarJugador(datos.plantel.find((j) => j.ci === valores.ci));
      return;
    }

    if (tipo === "gol") {
      ejecutar(
        () =>
          apiRequest(`/partidos/${partido.id_partido}/goles`, {
            method: "POST",
            body: JSON.stringify({
              ci_jugador: valores.ci,
              minuto: valores.minuto,
              autogol: valores.autogol,
            }),
          }),
        "Gol registrado correctamente.",
      );
      return;
    }

    ejecutar(
      () =>
        apiRequest(`/partidos/${partido.id_partido}/tarjetas`, {
          method: "POST",
          body: JSON.stringify({
            ci_jugador: valores.ci,
            minuto: valores.minuto,
            color: valores.color,
          }),
        }),
      "Tarjeta registrada correctamente.",
    );
  }

  async function eliminarRegistro(tipo, id) {
    if (!(await confirmar("¿Eliminar este registro?"))) return;

    ejecutar(
      () =>
        apiRequest(`/partidos/${partido.id_partido}/${tipo}/${id}`, {
          method: "DELETE",
        }),
      "Registro eliminado.",
    );
  }

  async function cerrarPartido() {
    if (
      !(await confirmar(
        `¿Marcar el partido como jugado? Después solo se podrá corregir durante ${HORAS_CORRECCION} horas.`,
      ))
    ) {
      return;
    }

    setGuardando(true);
    setError("");

    try {
      await apiRequest(`/partidos/${partido.id_partido}/marcar-jugado`, {
        method: "POST",
      });
      setElegido({ ...partido, estado: "jugado" });
      setExito("¡Partido cerrado correctamente!");
      await onActualizar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cargarAuditoria() {
    try {
      setAuditoria(
        await apiRequest(`/partidos/${partido.id_partido}/auditoria`),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  // ---------- listado de partidos ----------

  if (!partido) {
    const fechas = fechasDe(partidos);
    const fechaActual =
      fecha ?? fechaPendiente(partidos) ?? fechas[fechas.length - 1];
    const partidosVisibles = partidos.filter(
      (p) => p.numero_fecha === fechaActual,
    );

    return (
      <section className="jugadores-pagina planillas-pagina">
        <SelectorEdicion
          torneos={torneos}
          torneoSeleccionado={torneoSeleccionado}
          cambiarTorneo={(id) => {
            setFecha(null);
            cambiarTorneo?.(id);
          }}
          onEdicionCreada={onEdicionCreada}
        />

        <div className="pagina-encabezado">
          <h1>Planillas</h1>
        </div>

        <div className="planillas-fechas">
          {fechas.map((numero) => (
            <button
              key={numero}
              type="button"
              className={fechaActual === numero ? "activa" : ""}
              onClick={() => setFecha(numero)}
            >
              Fecha {numero}
            </button>
          ))}
        </div>

        <div className="planillas-listado">
          {partidosVisibles.map((p) => (
            <button
              key={p.id_partido}
              type="button"
              className="planillas-partido"
              onClick={() => elegirPartido(p)}
            >
              <span className="planillas-fecha">{diaCorto(p.dia)}</span>

              <span className="planillas-equipos">
                <span className="planillas-lado">
                  <InsigniaEquipo
                    id={p.id_equipo_local}
                    nombre={p.equipo_local}
                  />
                  {p.equipo_local}
                </span>
                <strong>
                  {p.estado === "jugado"
                    ? `${p.goles_local} - ${p.goles_visitante}`
                    : "VS"}
                </strong>
                <span className="planillas-lado visitante">
                  {p.equipo_visitante}
                  <InsigniaEquipo
                    id={p.id_equipo_visitante}
                    nombre={p.equipo_visitante}
                  />
                </span>
              </span>

              <span className={`planillas-estado estado-${p.estado}`}>
                {p.estado}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ---------- planilla del partido ----------

  const turno = turnos.find((t) => t.id_turno === partido.id_turno);
  const complejo = complejos.find((c) => c.id_complejo === partido.id_complejo);
  const fin = finDelPartido(partido, turno);
  const torneo = torneos.find(
    (t) => String(t.id_torneo) === String(torneoSeleccionado),
  );
  const etapa = etapaPlanilla(partido, fin, ahora, torneo?.estado);
  const editable = etapa === "carga" || etapa === "correccion";
  const jugado = partido.estado === "jugado";

  const idLocal = partido.id_equipo_local;
  const idVisitante = partido.id_equipo_visitante;
  const equipos = [
    { id: idLocal, nombre: partido.equipo_local },
    { id: idVisitante, nombre: partido.equipo_visitante },
  ];

  const enPlanilla = new Set((datos?.planilla || []).map((j) => j.ci));
  const jugadorPorCi = new Map((datos?.plantel || []).map((j) => [j.ci, j]));
  const goles = datos?.goles || [];
  const tarjetas = datos?.tarjetas || [];

  const golesDe = (idEquipo) =>
    goles.filter((g) => g.id_equipo_beneficiado === idEquipo).length;
  const remontada = jugado && huboRemontada(goles, idLocal);

  const ladoDe = (idEquipo) => (idEquipo === idLocal ? "local" : "visitante");
  const eventos = [
    ...goles.map((gol) => ({
      clave: `gol-${gol.id_gol}`,
      tipo: "gol",
      minuto: gol.minuto,
      autogol: Boolean(gol.autogol),
      apellido: jugadorPorCi.get(gol.ci_jugador)?.apellido || gol.jugador,
      lado: ladoDe(gol.id_equipo_beneficiado),
    })),
    ...tarjetas.map((tarjeta) => {
      const jugador = jugadorPorCi.get(tarjeta.ci_jugador);
      return {
        clave: `tarjeta-${tarjeta.id_tarjeta}`,
        tipo: "tarjeta",
        minuto: tarjeta.minuto,
        color: tarjeta.color,
        apellido: jugador?.apellido || tarjeta.jugador,
        lado: ladoDe(jugador?.id_equipo),
      };
    }),
  ];
  const eventosLinea = [
    ...conNiveles(eventos.filter((e) => e.lado === "local")),
    ...conNiveles(eventos.filter((e) => e.lado === "visitante")),
  ];

  const faltaPlanilla = equipos.some(
    (equipo) =>
      !datos?.planilla.some((jugador) => jugador.id_equipo === equipo.id),
  );

  return (
    <section className="jugadores-pagina planillas-pagina">
      <div className="planilla-barra">
        <button type="button" className="planilla-volver" onClick={volver}>
          ← {partidoInicial ? "Fixture" : "Partidos"}
        </button>

        <div className="planilla-datos">
          <span>Partido Nº {partido.id_partido}</span>
          <span>Fecha {partido.numero_fecha}</span>
          <span>
            {diaCorto(partido.dia)}
            {turno ? ` - ${turno.hora_inicio}` : ""}
          </span>
          <span>
            {complejo ? `${complejo.nombre} - ` : ""}
            {partido.nombre_cancha}
          </span>
        </div>
      </div>

      <div className="planilla-cancha">
        <span className={`planilla-sello ${partido.estado}`}>
          {partido.estado}
        </span>

        <div className="planilla-marcador">
          <div className="planilla-rival">
            <InsigniaEquipo
              id={idLocal}
              nombre={partido.equipo_local}
              tamano="lg"
            />
            <strong>{partido.equipo_local}</strong>
          </div>

          <div className="planilla-resultado">
            <div>
              <span>{golesDe(idLocal)}</span>
              <span className="separador">-</span>
              <span>{golesDe(idVisitante)}</span>
            </div>
            {remontada && <small>Remontada</small>}
          </div>

          <div className="planilla-rival">
            <InsigniaEquipo
              id={idVisitante}
              nombre={partido.equipo_visitante}
              tamano="lg"
            />
            <strong>{partido.equipo_visitante}</strong>
          </div>
        </div>

        <LineaTiempo eventos={eventosLinea} />
      </div>

      {error && <p className="jugadores-error">{error}</p>}
      {exito && <p className="jugadores-exito">✓ {exito}</p>}
      {cargando && !datos && <p>Cargando…</p>}

      {datos && (
        <div className="planilla-equipos">
          {equipos.map((equipo) => (
            <TarjetaEquipo
              key={equipo.id}
              equipo={equipo}
              jugadores={datos.plantel.filter(
                (j) => j.id_equipo === equipo.id,
              )}
              enPlanilla={enPlanilla}
              goles={goles}
              tarjetas={tarjetas}
              ciCapitan={datos.capitanes[equipo.id]}
              jugado={jugado}
              editable={editable}
              guardando={guardando}
              formulario={formulario}
              abrirFormulario={(tipo, idEquipo) =>
                setFormulario({ tipo, idEquipo })
              }
              cerrarFormulario={() => setFormulario(null)}
              onAgregarJugador={agregarJugador}
              onQuitarJugador={quitarJugador}
              onEliminar={eliminarRegistro}
              onGuardarEvento={guardarEvento}
            />
          ))}
        </div>
      )}

      <div className="planilla-aviso">
        <IconoCandado />

        <div>
          {etapa === "correccion" && (
            <>
              <strong>
                Se puede corregir hasta el{" "}
                {momentoLargo(fin + HORAS_CORRECCION * 3600 * 1000)}
              </strong>
              <small>Cada corrección queda registrada en Auditoría.</small>
            </>
          )}
          {etapa === "cerrada" && (
            <>
              <strong>Planilla cerrada</strong>
              <small>
                Pasaron más de {HORAS_CORRECCION} horas desde el partido.
              </small>
            </>
          )}
          {etapa === "carga" && (
            <>
              <strong>Partido disputado: cargá la planilla</strong>
              <small>
                {faltaPlanilla
                  ? "Para cerrarlo tienen que estar en planilla jugadores de los dos equipos."
                  : `Al cerrarlo quedan ${HORAS_CORRECCION} horas para corregir.`}
              </small>
            </>
          )}
          {etapa === "pendiente" && (
            <>
              <strong>Todavía no se jugó</strong>
              <small>La planilla se habilita cuando termina el partido.</small>
            </>
          )}
          {etapa === "inscripcion" && (
            <>
              <strong>La edición todavía está en inscripción</strong>
              <small>La planilla se carga cuando la edición está en curso.</small>
            </>
          )}
          {etapa === "bloqueada" && (
            <>
              <strong>Partido {partido.estado}</strong>
              <small>No se puede cargar la planilla de este partido.</small>
            </>
          )}
        </div>

        {etapa === "carga" && (
          <button
            type="button"
            className="boton-pixel amarillo"
            disabled={guardando || faltaPlanilla}
            onClick={cerrarPartido}
          >
            Marcar como jugado
          </button>
        )}

        {esAdmin && jugado && (
          <button
            type="button"
            className="boton-pixel"
            onClick={() =>
              auditoria === null ? cargarAuditoria() : setAuditoria(null)
            }
          >
            {auditoria === null ? "Ver auditoría" : "Ocultar auditoría"}
          </button>
        )}
      </div>

      {auditoria !== null && (
        <div className="planilla-auditoria">
          {auditoria.length === 0 ? (
            <p>Este partido no tuvo correcciones.</p>
          ) : (
            <table className="jugadores-tabla">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((registro) => (
                  <tr key={registro.id_auditoria}>
                    <td className="cat-mono">
                      {String(registro.fecha_hora)
                        .replace("T", " ")
                        .slice(0, 16)}
                    </td>
                    <td>{registro.accion}</td>
                    <td>{registro.detalle}</td>
                    <td>{registro.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

export default Planillas;
