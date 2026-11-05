import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { colorEquipo } from "./colores";
import { InsigniaEquipo } from "./equipos";
import {
  Acciones,
  BotonesPanel,
  Campo,
  IconoCandado,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";
import SelectorEdicion from "./SelectorEdicion";
import { ordenarTorneos } from "./torneo";
import "./Equipos.css";

const MAX_PLANTEL = 10;
const MIN_PLANTEL = 5;
const MAX_DOCENTES = 2;

const ETIQUETA_TIPO = {
  grado: "Grado",
  posgrado: "Posgrado",
  docente: "Docente",
  funcionario: "Funcionario",
};

const FORMULARIO_VACIO = { nombre: "", id_facultad: "", ci_capitan: "" };

function validar(f, esNuevo) {
  const errores = [];
  if (!f.nombre.trim()) errores.push("El nombre no puede estar vacío.");
  if (f.nombre.trim().length > 50) {
    errores.push("El nombre no puede tener más de 50 caracteres.");
  }
  if (esNuevo && !f.id_facultad) errores.push("Elegí una facultad.");
  return errores;
}

function CamisetaInput({ valor, deshabilitado, onGuardar }) {
  const [texto, setTexto] = useState(String(valor));

  async function confirmar() {
    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < 1 || numero > 99) {
      setTexto(String(valor));
      return;
    }
    if (numero === valor) return;
    const salioBien = await onGuardar(numero);
    if (!salioBien) setTexto(String(valor));
  }

  return (
    <input
      type="number"
      min={1}
      max={99}
      value={texto}
      disabled={deshabilitado}
      aria-label="Número de camiseta"
      onChange={(evento) => setTexto(evento.target.value)}
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") evento.currentTarget.blur();
      }}
    />
  );
}

function Camiseta({ numero, color, capitan }) {
  return (
    <div className="camiseta">
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <path
          d="M28 6 L6 24 L18 40 L26 34 L26 86 L66 86 L66 34 L74 40 L86 24 L64 6 L54 14 Q46 20 38 14 Z"
          fill={color}
          stroke="#191720"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M28 6 L38 14 Q46 20 54 14 L64 6"
          fill="none"
          stroke="#191720"
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </svg>
      <strong>{numero}</strong>
      {capitan && (
        <span className="camiseta-capitan" title="Capitán">
          C
        </span>
      )}
    </div>
  );
}

function CatalogoEquipos({ equipoInicial = null }) {
  const [torneos, setTorneos] = useState([]);
  const [facultades, setFacultades] = useState([]);
  const [torneoId, setTorneoId] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Equipo que se muestra debajo de las tarjetas, con su plantel
  const [seleccionId, setSeleccionId] = useState(null);
  const [plantelVista, setPlantelVista] = useState([]);
  // Con partidos cargados ya no se suman equipos
  const [hayPartidos, setHayPartidos] = useState(false);

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  // Plantel del equipo que se está editando
  const [plantel, setPlantel] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [nuevoJugador, setNuevoJugador] = useState({ ci: "", camiseta: "" });
  const [errorPlantel, setErrorPlantel] = useState("");

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  const torneo = torneos.find((t) => String(t.id_torneo) === torneoId);
  const enInscripcion = torneo?.estado === "inscripcion";
  const motivoSinAlta = !enInscripcion
    ? "Los equipos solo se inscriben mientras la edición está en inscripción"
    : hayPartidos
      ? "La edición ya tiene partidos: para sumar un equipo hay que borrarlos"
      : undefined;

  function verPlantel(idEquipo) {
    setSeleccionId(idEquipo);
    if (!idEquipo) {
      setPlantelVista([]);
      return Promise.resolve();
    }
    return apiRequest(`/equipos/${idEquipo}/jugadores`)
      .then(setPlantelVista)
      .catch((err) => setError(err.message));
  }

  function cargarEquipos(idTorneo, idElegido = null) {
    return Promise.all([
      apiRequest(`/equipos?id_torneo=${idTorneo}`),
      apiRequest(`/partidos?id_torneo=${idTorneo}`),
    ])
      .then(([lista, partidos]) => {
        setEquipos(lista);
        setHayPartidos(partidos.some((p) => p.estado !== "cancelado"));
        const elegido =
          lista.find((e) => e.id_equipo === idElegido) || lista[0] || null;
        verPlantel(elegido?.id_equipo ?? null);
        return lista;
      })
      .catch((err) => {
        setError(err.message);
        return [];
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    Promise.all([apiRequest("/torneos"), apiRequest("/facultades")])
      .then(([listaTorneos, listaFacultades]) => {
        const ordenados = ordenarTorneos(listaTorneos);
        setTorneos(ordenados);
        setFacultades(listaFacultades);

        if (ordenados.length === 0) {
          setCargando(false);
          return null;
        }
        const inicial =
          ordenados.find((t) => t.id_torneo === equipoInicial?.id_torneo) ||
          ordenados.find((t) => t.estado === "inscripcion") ||
          ordenados[0];
        setTorneoId(String(inicial.id_torneo));
        return cargarEquipos(inicial.id_torneo, equipoInicial?.id_equipo);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  function cambiarTorneo(idTorneo) {
    setTorneoId(idTorneo);
    cerrar();
    setMensajeExito("");
    setCargando(true);
    cargarEquipos(idTorneo);
  }

  function edicionCreada(nuevo) {
    setTorneos((anteriores) => ordenarTorneos([...anteriores, nuevo]));
    cambiarTorneo(String(nuevo.id_torneo));
  }

  // ---------- plantel ----------

  async function cargarPlantel(equipo, lista = equipos) {
    try {
      const [propio, candidatos, otros] = await Promise.all([
        apiRequest(`/equipos/${equipo.id_equipo}/jugadores`),
        apiRequest(`/jugadores?id_facultad=${equipo.id_facultad}`),
        Promise.all(
          lista
            .filter((e) => e.id_equipo !== equipo.id_equipo)
            .map((e) => apiRequest(`/equipos/${e.id_equipo}/jugadores`)),
        ),
      ]);

      // Un jugador solo puede estar en un equipo por edición
      const ocupados = new Set([...propio, ...otros.flat()].map((j) => j.ci));
      setPlantel(propio);
      setDisponibles(candidatos.filter((j) => !ocupados.has(j.ci)));
      return propio;
    } catch (err) {
      setErrorPlantel(err.message);
      return null;
    }
  }

  async function agregarJugador(equipo) {
    const camiseta = Number(nuevoJugador.camiseta);
    if (!nuevoJugador.ci) {
      setErrorPlantel("Elegí un jugador.");
      return;
    }
    if (!Number.isInteger(camiseta) || camiseta < 1 || camiseta > 99) {
      setErrorPlantel("La camiseta tiene que ser un número entre 1 y 99.");
      return;
    }

    try {
      await apiRequest(`/equipos/${equipo.id_equipo}/jugadores`, {
        method: "POST",
        body: JSON.stringify({
          ci_jugador: nuevoJugador.ci,
          numero_camiseta: camiseta,
        }),
      });
      setNuevoJugador({ ci: "", camiseta: "" });
      setErrorPlantel("");
      await Promise.all([
        cargarPlantel(equipo),
        cargarEquipos(torneoId, equipo.id_equipo),
      ]);
    } catch (err) {
      setErrorPlantel(err.message);
    }
  }

  async function quitarJugador(equipo, jugador) {
    if (
      !window.confirm(
        `¿Sacar a ${jugador.nombre} ${jugador.apellido} del plantel de ${equipo.nombre}?`,
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/equipos/${equipo.id_equipo}/jugadores/${jugador.ci}`, {
        method: "DELETE",
      });
      setErrorPlantel("");
      const nuevo = await cargarPlantel(equipo);
      if (nuevo && !nuevo.some((j) => j.ci === formulario.ci_capitan)) {
        setFormulario((f) => ({ ...f, ci_capitan: "" }));
      }
      await cargarEquipos(torneoId, equipo.id_equipo);
    } catch (err) {
      setErrorPlantel(`No se pudo quitar: ${err.message}`);
    }
  }

  async function cambiarCamiseta(equipo, jugador, numero) {
    try {
      await apiRequest(`/equipos/${equipo.id_equipo}/jugadores/${jugador.ci}`, {
        method: "PUT",
        body: JSON.stringify({ numero_camiseta: numero }),
      });
      setErrorPlantel("");
      await Promise.all([cargarPlantel(equipo), verPlantel(equipo.id_equipo)]);
      return true;
    } catch (err) {
      setErrorPlantel(err.message);
      return false;
    }
  }

  // ---------- alta, edición y baja del equipo ----------

  function reiniciarPlantel() {
    setPlantel([]);
    setDisponibles([]);
    setNuevoJugador({ ci: "", camiseta: "" });
    setErrorPlantel("");
  }

  function abrirNuevo() {
    setMensajeExito("");
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
    setIntentoGuardar(false);
    setError("");
    reiniciarPlantel();
  }

  function abrirEditar(equipo, lista = equipos) {
    setEdicion({ modo: "editar", id: equipo.id_equipo });
    setSeleccionId(equipo.id_equipo);
    setFormulario({
      nombre: equipo.nombre,
      id_facultad: String(equipo.id_facultad),
      ci_capitan: equipo.ci_capitan || "",
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
    reiniciarPlantel();
    cargarPlantel(equipo, lista);
  }

  function cerrar() {
    setEdicion(null);
    setError("");
    reiniciarPlantel();
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario({ ...formulario, [name]: value });
    setError("");
  }

  const esNuevo = edicion?.modo === "nuevo";
  const equipoEditado = equipos.find((e) => e.id_equipo === edicion?.id);
  const errores = validar(formulario, esNuevo);
  const sinCambios =
    Boolean(equipoEditado) &&
    formulario.nombre.trim() === equipoEditado.nombre &&
    formulario.ci_capitan === (equipoEditado.ci_capitan || "");

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    try {
      if (esNuevo) {
        const creado = await apiRequest("/equipos", {
          method: "POST",
          body: JSON.stringify({
            nombre: formulario.nombre.trim(),
            id_torneo: Number(torneoId),
            id_facultad: Number(formulario.id_facultad),
          }),
        });
        const lista = await cargarEquipos(torneoId, creado.id_equipo);
        abrirEditar(creado, lista);
        setMensajeExito(
          `${creado.nombre} fue inscripto. Cargá su plantel y elegí al capitán.`,
        );
      } else {
        await apiRequest(`/equipos/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify({
            nombre: formulario.nombre.trim(),
            ci_capitan: formulario.ci_capitan || null,
          }),
        });
        setMensajeExito("¡Equipo guardado correctamente!");
        setEdicion(null);
        reiniciarPlantel();
        await cargarEquipos(torneoId, edicion.id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(equipo) {
    if (!window.confirm(`¿Dar de baja a ${equipo.nombre}?`)) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/equipos/${equipo.id_equipo}`, { method: "DELETE" });
      setMensajeExito(`${equipo.nombre} fue dado de baja.`);
      if (edicion?.id === equipo.id_equipo) cerrar();
      await cargarEquipos(torneoId);
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  const panel = edicion && (
    <PanelLateral titulo={esNuevo ? "Nuevo equipo" : "Editar equipo"}>
      <form onSubmit={guardar} noValidate>
        <Campo id="equipo-nombre" etiqueta="Nombre">
          <input
            id="equipo-nombre"
            name="nombre"
            maxLength={50}
            value={formulario.nombre}
            onChange={cambiarCampo}
            required
          />
        </Campo>

        <Campo
          id="equipo-facultad"
          etiqueta={esNuevo ? "Facultad" : "Facultad (no se modifica)"}
        >
          <select
            id="equipo-facultad"
            name="id_facultad"
            value={formulario.id_facultad}
            onChange={cambiarCampo}
            disabled={!esNuevo}
          >
            <option value="">Elegir</option>
            {facultades.map((facultad) => (
              <option key={facultad.id_facultad} value={facultad.id_facultad}>
                {facultad.nombre}
              </option>
            ))}
          </select>
        </Campo>

        {esNuevo ? (
          <p className="cat-aviso">
            El capitán se elige después de cargar el plantel, porque tiene que
            ser uno de sus jugadores.
          </p>
        ) : (
          <Campo id="equipo-capitan" etiqueta="Capitán">
            <select
              id="equipo-capitan"
              name="ci_capitan"
              value={formulario.ci_capitan}
              onChange={cambiarCampo}
            >
              {enInscripcion && <option value="">Sin capitán</option>}
              {plantel.map((jugador) => (
                <option key={jugador.ci} value={jugador.ci}>
                  {jugador.nombre} {jugador.apellido}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar={esNuevo ? "Inscribir equipo" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>

      {!esNuevo && equipoEditado && (
        <div className="cat-seccion">
          <h3>
            Plantel ({plantel.length}/{MAX_PLANTEL})
          </h3>

          {!enInscripcion && (
            <p className="cat-aviso">
              El plantel solo se puede modificar mientras el torneo está en
              inscripción.
            </p>
          )}

          {plantel.length < MIN_PLANTEL && (
            <p className="cat-aviso">
              Hacen falta al menos {MIN_PLANTEL} jugadores para poder iniciar el
              torneo.
            </p>
          )}

          <ul className="cat-lista">
            {plantel.map((jugador) => (
              <li key={jugador.ci}>
                <div className="cat-camiseta">
                  <CamisetaInput
                    key={`${jugador.ci}-${jugador.numero_camiseta}`}
                    valor={jugador.numero_camiseta}
                    deshabilitado={!enInscripcion}
                    onGuardar={(numero) =>
                      cambiarCamiseta(equipoEditado, jugador, numero)
                    }
                  />
                  <div>
                    <strong>
                      {jugador.nombre} {jugador.apellido}
                      {jugador.es_capitan && (
                        <span className="cat-capitan">Capitán</span>
                      )}
                    </strong>
                    <small>{ETIQUETA_TIPO[jugador.tipo] || jugador.tipo}</small>
                  </div>
                </div>

                {enInscripcion && (
                  <Acciones
                    nombre={`${jugador.nombre} ${jugador.apellido}`}
                    onBorrar={() => quitarJugador(equipoEditado, jugador)}
                  />
                )}
              </li>
            ))}
          </ul>

          {enInscripcion && plantel.length < MAX_PLANTEL && (
            <div className="cat-mini-form">
              <div className="ancho">
                <select
                  aria-label="Jugador a agregar"
                  value={nuevoJugador.ci}
                  onChange={(evento) =>
                    setNuevoJugador({
                      ...nuevoJugador,
                      ci: evento.target.value,
                    })
                  }
                >
                  <option value="">
                    {disponibles.length === 0
                      ? "No quedan jugadores disponibles de esta facultad"
                      : "Elegir jugador"}
                  </option>
                  {disponibles.map((jugador) => (
                    <option key={jugador.ci} value={jugador.ci}>
                      {jugador.apellido}, {jugador.nombre} ·{" "}
                      {ETIQUETA_TIPO[jugador.tipo] || jugador.tipo}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="number"
                min={1}
                max={99}
                placeholder="Camiseta"
                aria-label="Número de camiseta"
                value={nuevoJugador.camiseta}
                onChange={(evento) =>
                  setNuevoJugador({
                    ...nuevoJugador,
                    camiseta: evento.target.value,
                  })
                }
              />

              <button
                type="button"
                className="cat-boton-agregar"
                onClick={() => agregarJugador(equipoEditado)}
              >
                + Agregar
              </button>
            </div>
          )}

          {errorPlantel && <p className="jugadores-error">{errorPlantel}</p>}
        </div>
      )}
    </PanelLateral>
  );

  const seleccionado = equipos.find((e) => e.id_equipo === seleccionId);
  const totalJugadores = equipos.reduce(
    (total, equipo) => total + Number(equipo.cantidad_jugadores),
    0,
  );
  const docentes = plantelVista.filter(
    (j) => j.tipo === "docente" || j.tipo === "funcionario",
  ).length;
  const lugaresLibres = Math.max(MAX_PLANTEL - plantelVista.length, 0);

  return (
    <section className="jugadores-pagina equipos-pagina">
      <SelectorEdicion
        torneos={torneos}
        torneoSeleccionado={torneoId}
        cambiarTorneo={cambiarTorneo}
        onEdicionCreada={edicionCreada}
      />

      <div className="pagina-encabezado">
        <div>
          <h1>Equipos</h1>
          <div className="pastillas equipos-resumen">
            <span className="pastilla">
              <strong>{equipos.length}</strong> equipos
            </span>
            <span className="pastilla">
              <strong>{totalJugadores}</strong> jugadores en planteles
            </span>
          </div>
        </div>

        <button
          type="button"
          className="boton-pixel rojo"
          disabled={Boolean(motivoSinAlta)}
          title={motivoSinAlta}
          onClick={abrirNuevo}
        >
          + Nuevo equipo
        </button>
      </div>

      {error && !panel && <p className="jugadores-error">{error}</p>}
      {mensajeExito && <p className="jugadores-exito">✓ {mensajeExito}</p>}

      <div
        className={panel ? "jugadores-cuerpo con-panel" : "jugadores-cuerpo"}
      >
        <div>
          {cargando && <p>Cargando…</p>}
          {!cargando && equipos.length === 0 && (
            <p className="equipos-vacio">
              No hay equipos inscriptos en esta edición.
            </p>
          )}

          <div className="equipos-tarjetas">
            {equipos.map((equipo) => {
              const activo = equipo.id_equipo === seleccionId;
              return (
                <button
                  key={equipo.id_equipo}
                  type="button"
                  className={
                    activo ? "equipo-tarjeta activo" : "equipo-tarjeta"
                  }
                  style={
                    activo
                      ? { backgroundColor: colorEquipo(equipo.id_equipo) }
                      : undefined
                  }
                  onClick={() => {
                    if (edicion) cerrar();
                    verPlantel(equipo.id_equipo);
                  }}
                >
                  <span className="equipo-tarjeta-cabecera">
                    <InsigniaEquipo
                      id={equipo.id_equipo}
                      nombre={equipo.nombre}
                    />
                    <span>
                      <strong>{equipo.nombre}</strong>
                      <small>{equipo.facultad}</small>
                    </span>
                  </span>

                  <span
                    className={
                      equipo.cantidad_jugadores < MIN_PLANTEL
                        ? "cupos incompleto"
                        : "cupos"
                    }
                  >
                    {Array.from({ length: MAX_PLANTEL }, (_, i) => (
                      <span
                        key={i}
                        className={i < equipo.cantidad_jugadores ? "lleno" : ""}
                      />
                    ))}
                  </span>

                  <small className="equipo-capitan">
                    Capitán: {equipo.capitan || "sin asignar"}
                  </small>
                </button>
              );
            })}
          </div>

          {seleccionado && (
            <article className="equipo-detalle">
              <header
                style={{
                  backgroundColor: colorEquipo(seleccionado.id_equipo),
                }}
              >
                <InsigniaEquipo
                  id={seleccionado.id_equipo}
                  nombre={seleccionado.nombre}
                  tamano="lg"
                />

                <div className="equipo-detalle-nombre">
                  <h2>{seleccionado.nombre}</h2>
                  <span>{seleccionado.facultad}</span>
                </div>

                <span className="equipo-dato">
                  {plantelVista.length} de {MAX_PLANTEL} jugadores
                </span>
                <span className="equipo-dato">
                  Docentes y funcionarios: {docentes} de {MAX_DOCENTES}
                </span>

                <Acciones
                  nombre={seleccionado.nombre}
                  onEditar={() => abrirEditar(seleccionado)}
                  onBorrar={
                    enInscripcion ? () => eliminar(seleccionado) : undefined
                  }
                />
              </header>

              <div className="equipo-plantel">
                {plantelVista.map((jugador) => (
                  <div className="equipo-jugador" key={jugador.ci}>
                    <Camiseta
                      numero={jugador.numero_camiseta}
                      color={colorEquipo(seleccionado.id_equipo)}
                      capitan={jugador.es_capitan}
                    />
                    <strong>
                      {jugador.nombre}
                      <br />
                      {jugador.apellido}
                    </strong>
                    {(jugador.tipo === "docente" ||
                      jugador.tipo === "funcionario") && (
                      <span className={`jugador-tipo tipo-${jugador.tipo}`}>
                        {ETIQUETA_TIPO[jugador.tipo]}
                      </span>
                    )}
                  </div>
                ))}

                {Array.from({ length: lugaresLibres }, (_, i) => (
                  <div className="equipo-jugador" key={`libre-${i}`}>
                    <button
                      type="button"
                      className="equipo-libre"
                      disabled={!enInscripcion}
                      aria-label="Agregar jugador"
                      onClick={() => abrirEditar(seleccionado)}
                    >
                      +
                    </button>
                    <small>Libre</small>
                  </div>
                ))}
              </div>

              <footer className="equipo-pie">
                {enInscripcion ? (
                  <strong>
                    Plantel abierto: se puede modificar hasta iniciar la
                    edición.
                  </strong>
                ) : (
                  <>
                    <IconoCandado />
                    <strong>
                      Plantel cerrado:{" "}
                      {torneo?.estado === "en curso"
                        ? "el torneo está en curso."
                        : "el torneo finalizó."}
                    </strong>
                  </>
                )}
              </footer>
            </article>
          )}
        </div>

        {panel}
      </div>
    </section>
  );
}

export default CatalogoEquipos;
