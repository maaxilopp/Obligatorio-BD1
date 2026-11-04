import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { InsigniaEquipo } from "./equipos";
import {
  Acciones,
  BotonesPanel,
  Buscador,
  Campo,
  Catalogo,
  FilaVacia,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";

const MAX_PLANTEL = 10;
const MIN_PLANTEL = 5;

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

// Número de camiseta editable: se guarda al salir del campo o con Enter
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

function CatalogoEquipos() {
  const [torneos, setTorneos] = useState([]);
  const [facultades, setFacultades] = useState([]);
  const [torneoId, setTorneoId] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

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

  function cargarEquipos(idTorneo) {
    return apiRequest(`/equipos?id_torneo=${idTorneo}`)
      .then((lista) => {
        setEquipos(lista);
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
        const ordenados = [...listaTorneos].sort(
          (a, b) => b.anio - a.anio || b.semestre - a.semestre,
        );
        setTorneos(ordenados);
        setFacultades(listaFacultades);

        if (ordenados.length === 0) {
          setCargando(false);
          return null;
        }
        // Abre en la edición que está en inscripción (si hay) o en la última
        const inicial =
          ordenados.find((t) => t.estado === "inscripcion") || ordenados[0];
        setTorneoId(String(inicial.id_torneo));
        return cargarEquipos(inicial.id_torneo);
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

  const texto = busqueda.trim().toLowerCase();
  const visibles = equipos.filter(
    (equipo) =>
      !texto ||
      equipo.nombre.toLowerCase().includes(texto) ||
      equipo.facultad.toLowerCase().includes(texto),
  );

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
      await Promise.all([cargarPlantel(equipo), cargarEquipos(torneoId)]);
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
      await apiRequest(
        `/equipos/${equipo.id_equipo}/jugadores/${jugador.ci}`,
        { method: "DELETE" },
      );
      setErrorPlantel("");
      const nuevo = await cargarPlantel(equipo);
      if (nuevo && !nuevo.some((j) => j.ci === formulario.ci_capitan)) {
        setFormulario((f) => ({ ...f, ci_capitan: "" }));
      }
      await cargarEquipos(torneoId);
    } catch (err) {
      setErrorPlantel(`No se pudo quitar: ${err.message}`);
    }
  }

  async function cambiarCamiseta(equipo, jugador, numero) {
    try {
      await apiRequest(
        `/equipos/${equipo.id_equipo}/jugadores/${jugador.ci}`,
        { method: "PUT", body: JSON.stringify({ numero_camiseta: numero }) },
      );
      setErrorPlantel("");
      await cargarPlantel(equipo);
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
    if (!enInscripcion) {
      setError(
        "Los equipos solo se pueden inscribir mientras el torneo está en etapa de inscripción.",
      );
      return;
    }
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
    setIntentoGuardar(false);
    setError("");
    reiniciarPlantel();
  }

  function abrirEditar(equipo, lista = equipos) {
    setEdicion({ modo: "editar", id: equipo.id_equipo });
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
        const lista = await cargarEquipos(torneoId);
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
        await cargarEquipos(torneoId);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(equipo) {
    if (!window.confirm(`¿Dar de baja a ${equipo.nombre}? Se borra también su plantel.`)) {
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
              <option value="">Sin capitán</option>
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
                    setNuevoJugador({ ...nuevoJugador, ci: evento.target.value })
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

  return (
    <Catalogo
      titulo="Equipos"
      textoNuevo="+ Nuevo equipo"
      onNuevo={abrirNuevo}
      exito={mensajeExito}
      error={error}
      panel={panel}
      filtros={
        <>
          <div className="cat-selector-torneo">
            <label htmlFor="equipos-torneo">Edición</label>
            <select
              id="equipos-torneo"
              value={torneoId}
              onChange={(evento) => cambiarTorneo(evento.target.value)}
            >
              {torneos.map((t) => (
                <option key={t.id_torneo} value={t.id_torneo}>
                  {t.nombre} - {t.anio}
                </option>
              ))}
            </select>
            {torneo && (
              <span
                className={`cat-estado estado-${torneo.estado.replace(" ", "-")}`}
              >
                {torneo.estado === "inscripcion"
                  ? "Inscripción"
                  : torneo.estado === "en curso"
                    ? "En curso"
                    : "Finalizado"}
              </span>
            )}
          </div>

          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Equipo o facultad"
            etiqueta="Buscar equipo"
          />
        </>
      }
    >
      <table className="jugadores-tabla">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Facultad</th>
            <th>Capitán</th>
            <th>Jugadores</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>

        <tbody>
          <FilaVacia
            columnas={5}
            cargando={cargando}
            hayDatos={visibles.length > 0}
            texto="No hay equipos inscriptos en esta edición."
          />

          {visibles.map((equipo) => (
            <tr
              key={equipo.id_equipo}
              className={edicion?.id === equipo.id_equipo ? "seleccionado" : ""}
            >
              <td>
                <span className="cat-con-color">
                  <InsigniaEquipo id={equipo.id_equipo} nombre={equipo.nombre} />
                  {equipo.nombre}
                </span>
              </td>
              <td>{equipo.facultad}</td>
              <td>{equipo.capitan || "Sin capitán"}</td>
              <td className="cat-mono">
                {equipo.cantidad_jugadores}/{MAX_PLANTEL}
                {equipo.cantidad_jugadores < MIN_PLANTEL && " ⚠"}
              </td>
              <td>
                <Acciones
                  nombre={equipo.nombre}
                  onEditar={() => abrirEditar(equipo)}
                  onBorrar={() => eliminar(equipo)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Catalogo>
  );
}

export default CatalogoEquipos;
