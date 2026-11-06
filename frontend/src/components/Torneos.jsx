import { useEffect, useState } from "react";
import { confirmar } from "./confirmar";
import { apiRequest } from "../services/api";
import {
  Acciones,
  BotonesPanel,
  Campo,
  FilaVacia,
  IconoLapiz,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";
import { InsigniaEquipo } from "./equipos";
import {
  fechaCompleta,
  fechaPendiente,
  fechasDe,
  fechaTerminada,
  ordenarTorneos,
} from "./torneo";
import "./Torneos.css";

const MIN_PLANTEL = 5;
const MAX_PLANTEL = 10;

const ESTADOS = [
  { valor: "inscripcion", etiqueta: "Inscripción" },
  { valor: "en curso", etiqueta: "En curso" },
  { valor: "finalizado", etiqueta: "Finalizado" },
];

function etiquetaEstado(estado) {
  return ESTADOS.find((e) => e.valor === estado)?.etiqueta || estado;
}

function nombreSugerido(anio, semestre) {
  return `Torneo Interfacultades ${anio} - ${semestre}º semestre`;
}

// La edición que sigue a la última cargada
function proximaEdicion(torneos) {
  const ultima = torneos[0];
  if (!ultima) return { anio: new Date().getFullYear(), semestre: 1 };
  return ultima.semestre === 1
    ? { anio: ultima.anio, semestre: 2 }
    : { anio: ultima.anio + 1, semestre: 1 };
}

function validar(f, torneos, idActual, partidos) {
  const errores = [];
  const anio = Number(f.anio);

  if (!f.nombre.trim()) errores.push("El nombre no puede estar vacío.");
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    errores.push("El año tiene que estar entre 2000 y 2100.");
  }
  if (
    torneos.some(
      (t) =>
        t.id_torneo !== idActual &&
        t.anio === anio &&
        t.semestre === Number(f.semestre),
    )
  ) {
    errores.push("Ya existe una edición para ese año y semestre.");
  }
  if (!f.fecha_inicio || !f.fecha_fin) {
    errores.push("Faltan la fecha de inicio y la de fin.");
  } else {
    if (f.fecha_fin < f.fecha_inicio) {
      errores.push("La fecha de fin no puede ser anterior a la de inicio.");
    }
    if (Number(f.fecha_inicio.slice(0, 4)) !== anio) {
      errores.push(
        "El año del torneo debe coincidir con el de la fecha de inicio.",
      );
    }
    const dias = partidos
      .filter((p) => p.estado !== "cancelado")
      .map((p) => p.dia.slice(0, 10))
      .sort();
    if (
      dias.length > 0 &&
      (dias[0] < f.fecha_inicio || dias.at(-1) > f.fecha_fin)
    ) {
      errores.push(
        `Hay partidos entre el ${fechaCompleta(dias[0])} y el ${fechaCompleta(dias.at(-1))}: la edición tiene que incluirlos.`,
      );
    }
  }
  return errores;
}

function sumarDias(iso, dias) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia + dias);
  const dos = (numero) => String(numero).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function tamanoFixture(cantidadEquipos) {
  if (cantidadEquipos < 2) return { fechas: 0, partidos: 0 };
  return {
    fechas: cantidadEquipos % 2 === 0 ? cantidadEquipos - 1 : cantidadEquipos,
    partidos: (cantidadEquipos * (cantidadEquipos - 1)) / 2,
  };
}

function Estados({ estado }) {
  const actual = ESTADOS.findIndex((e) => e.valor === estado);

  return (
    <ol className="torneo-estados">
      {ESTADOS.map((paso, indice) => {
        // Finalizado es el último: no queda ningún paso "en marcha"
        const hecho = indice < actual || estado === "finalizado";
        const clase = hecho
          ? "hecho"
          : indice === actual
            ? "actual"
            : "pendiente";

        return (
          <li key={paso.valor} className={clase}>
            <span>{hecho ? "✓" : indice + 1}</span>
            {paso.etiqueta}
          </li>
        );
      })}
    </ol>
  );
}

function EdicionActual({ torneo, equipos, partidos, onEditar, onFinalizar }) {
  const fechas = fechasDe(partidos);
  const pendiente = fechaPendiente(partidos);
  const jugadores = equipos.reduce(
    (total, equipo) => total + Number(equipo.cantidad_jugadores),
    0,
  );
  const goles = partidos
    .filter((p) => p.estado === "jugado")
    .reduce(
      (total, p) => total + Number(p.goles_local) + Number(p.goles_visitante),
      0,
    );
  const pendientes = partidos.filter(
    (p) => p.estado === "programado" || p.estado === "postergado",
  ).length;

  return (
    <article className="torneo-tarjeta">
      <header>
        <div>
          <small>
            {torneo.estado === "en curso" ? "EDICIÓN ACTUAL" : "EDICIÓN"}
          </small>
          <h2>
            {torneo.anio} - {torneo.semestre}º semestre
          </h2>
          <p>
            {torneo.nombre} - {fechaCompleta(torneo.fecha_inicio)} al{" "}
            {fechaCompleta(torneo.fecha_fin)}
          </p>
        </div>

        <Acciones nombre={torneo.nombre} onEditar={onEditar} />
      </header>

      <div className="torneo-cuerpo">
        <Estados estado={torneo.estado} />

        {fechas.length > 0 && (
          <div>
            <h3>Fechas</h3>
            <div className="torneo-fechas">
              {fechas.map((fecha) => {
                const clase = fechaTerminada(partidos, fecha)
                  ? "hecha"
                  : fecha === pendiente
                    ? "actual"
                    : "";
                return (
                  <div key={fecha}>
                    <span className={clase} />
                    <small>F{fecha}</small>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="torneo-numeros">
          <div>
            <strong>{equipos.length}</strong> equipos
          </div>
          <div>
            <strong>{jugadores}</strong> jugadores
          </div>
          <div>
            <strong>{partidos.length}</strong> partidos
          </div>
          <div>
            <strong>{goles}</strong> goles
          </div>
        </div>

        {torneo.estado === "en curso" && (
          <div className="torneo-pie">
            <button
              type="button"
              className="boton-pixel rojo"
              disabled={pendientes > 0}
              onClick={onFinalizar}
            >
              Pasar a Finalizado
            </button>
            {pendientes > 0 && (
              <small>
                {pendientes === 1
                  ? "Queda 1 partido sin jugar: hay que jugarlo o cancelarlo."
                  : `Quedan ${pendientes} partidos sin jugar: hay que jugarlos o cancelarlos.`}
              </small>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Paso({ numero, titulo, texto, activo, children }) {
  return (
    <article className={activo ? "torneo-paso" : "torneo-paso inactivo"}>
      <header>
        <span className="torneo-paso-numero">{numero}</span>
        <div>
          <h2>{titulo}</h2>
          <p>{texto}</p>
        </div>
      </header>
      {children}
    </article>
  );
}

function estadoEquipo(equipo) {
  const faltan = MIN_PLANTEL - equipo.cantidad_jugadores;
  if (faltan > 0) {
    return {
      listo: false,
      texto: faltan === 1 ? "Falta 1 jugador" : `Faltan ${faltan} jugadores`,
    };
  }
  if (!equipo.ci_capitan) return { listo: false, texto: "Falta capitán" };
  return { listo: true, texto: "Listo para jugar" };
}

function AsistenteEdicion({
  torneo,
  equipos,
  partidos,
  facultades,
  onVolver,
  onEditar,
  onRecargar,
  onVerPlantel,
  onExito,
  onIniciada,
}) {
  const [nuevo, setNuevo] = useState({ nombre: "", id_facultad: "" });
  const [primerDia, setPrimerDia] = useState(torneo.fecha_inicio.slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cantidad = equipos.length;
  const { fechas, partidos: totalPartidos } = tamanoFixture(cantidad);
  const hayFixture = partidos.length > 0;

  const faltaPlantel = equipos.filter(
    (e) => e.cantidad_jugadores < MIN_PLANTEL,
  );
  const faltaCapitan = equipos.filter((e) => !e.ci_capitan);
  const ultimoDia =
    fechas > 0 && primerDia ? sumarDias(primerDia, 7 * (fechas - 1)) : "";

  let motivoFixture = "";
  if (cantidad < 2) {
    motivoFixture = "Se necesitan al menos 2 equipos.";
  } else if (faltaPlantel.length > 0) {
    motivoFixture = `Para generar el fixture todos los equipos necesitan al menos ${MIN_PLANTEL} jugadores: revisá ${faltaPlantel.map((e) => e.nombre).join(", ")}.`;
  } else if (!primerDia) {
    motivoFixture = "Elegí el día de la fecha 1.";
  } else if (primerDia < torneo.fecha_inicio.slice(0, 10)) {
    motivoFixture = "La fecha 1 no puede ser anterior al inicio de la edición.";
  } else if (ultimoDia > torneo.fecha_fin.slice(0, 10)) {
    motivoFixture = `La última fecha caería el ${fechaCompleta(ultimoDia)}, después del fin de la edición.`;
  }

  let motivoInicio = "";
  if (cantidad < 2) {
    motivoInicio = "Se necesitan al menos 2 equipos.";
  } else if (faltaPlantel.length > 0) {
    motivoInicio = `Falta completar el plantel de ${faltaPlantel.map((e) => e.nombre).join(", ")}.`;
  } else if (faltaCapitan.length > 0) {
    motivoInicio = `Falta elegir capitán en ${faltaCapitan.map((e) => e.nombre).join(", ")}.`;
  } else if (!hayFixture) {
    motivoInicio = "Primero generá el fixture.";
  }

  async function inscribir(evento) {
    evento.preventDefault();
    setError("");

    const nombre = nuevo.nombre.trim();
    if (!nombre) {
      setError("Escribí el nombre del equipo.");
      return;
    }
    if (!nuevo.id_facultad) {
      setError("Elegí una facultad.");
      return;
    }

    setGuardando(true);
    try {
      await apiRequest("/equipos", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          id_torneo: torneo.id_torneo,
          id_facultad: Number(nuevo.id_facultad),
        }),
      });
      setNuevo({ nombre: "", id_facultad: "" });
      onExito(`${nombre} fue inscripto.`);
      await onRecargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function generarFixture() {
    setGuardando(true);
    setError("");
    try {
      await apiRequest(`/torneos/${torneo.id_torneo}/fixture`, {
        method: "POST",
        body: JSON.stringify({ primer_dia: primerDia }),
      });
      onExito("El fixture fue generado.");
      await onRecargar();
    } catch (err) {
      setError(`No se pudo generar el fixture: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  }

  async function iniciar() {
    if (
      !(await confirmar(
        `¿Iniciar "${torneo.nombre}"? Los planteles quedan cerrados y el estado no vuelve atrás.`,
      ))
    ) {
      return;
    }

    setGuardando(true);
    setError("");
    try {
      await apiRequest(`/torneos/${torneo.id_torneo}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "en curso" }),
      });
      onExito(`${torneo.nombre} ya está en curso.`);
      await onIniciada();
    } catch (err) {
      setError(`No se pudo iniciar: ${err.message}`);
      setGuardando(false);
    }
  }

  return (
    <div className="torneo-asistente">
      <button type="button" className="planilla-volver" onClick={onVolver}>
        ← Torneos
      </button>

      <div className="torneo-nueva">
        <div>
          <small>EDICIÓN NUEVA</small>
          <h2>
            {torneo.anio} - {torneo.semestre}º semestre
          </h2>
          <p>
            {torneo.nombre} - {fechaCompleta(torneo.fecha_inicio)} al{" "}
            {fechaCompleta(torneo.fecha_fin)}
          </p>
        </div>

        <Estados estado={torneo.estado} />

        <div className="jugador-acciones">
          <button
            type="button"
            title="Editar edición"
            aria-label="Editar edición"
            onClick={onEditar}
          >
            <IconoLapiz />
          </button>
        </div>
      </div>

      {error && <p className="jugadores-error">{error}</p>}

      <Paso
        numero={1}
        titulo="Inscribir equipos"
        texto={`Cada equipo necesita entre ${MIN_PLANTEL} y ${MAX_PLANTEL} jugadores de su facultad, con hasta 2 docentes o funcionarios.`}
        activo
      >
        <ul className="torneo-equipos">
          {equipos.map((equipo) => {
            const estado = estadoEquipo(equipo);
            const incompleto = equipo.cantidad_jugadores < MIN_PLANTEL;

            return (
              <li key={equipo.id_equipo}>
                <div className="torneo-equipo-nombre">
                  <InsigniaEquipo
                    id={equipo.id_equipo}
                    nombre={equipo.nombre}
                  />
                  <div>
                    <strong>{equipo.nombre}</strong>
                    <small>{equipo.facultad}</small>
                  </div>
                </div>

                <div className="torneo-equipo-plantel">
                  <span className={incompleto ? "cupos incompleto" : "cupos"}>
                    {Array.from({ length: MAX_PLANTEL }, (_, i) => (
                      <span
                        key={i}
                        className={i < equipo.cantidad_jugadores ? "lleno" : ""}
                      />
                    ))}
                  </span>
                  <strong>
                    {equipo.cantidad_jugadores}/{MAX_PLANTEL} - Capitán:{" "}
                    {equipo.capitan || "sin asignar"}
                  </strong>
                </div>

                <span
                  className={
                    estado.listo
                      ? "torneo-equipo-estado listo"
                      : "torneo-equipo-estado"
                  }
                >
                  {estado.texto}
                </span>

                <button
                  type="button"
                  className="torneo-boton-plantel"
                  onClick={() =>
                    onVerPlantel({
                      id_torneo: torneo.id_torneo,
                      id_equipo: equipo.id_equipo,
                    })
                  }
                >
                  Plantel
                </button>
              </li>
            );
          })}
        </ul>

        {!hayFixture ? (
          <form className="torneo-inscribir" onSubmit={inscribir} noValidate>
            <Campo id="nuevo-equipo-nombre" etiqueta="Nombre del equipo">
              <input
                id="nuevo-equipo-nombre"
                maxLength={50}
                placeholder="Ej: Analisis FODA FC"
                value={nuevo.nombre}
                onChange={(evento) =>
                  setNuevo({ ...nuevo, nombre: evento.target.value })
                }
              />
            </Campo>

            <Campo id="nuevo-equipo-facultad" etiqueta="Facultad">
              <select
                id="nuevo-equipo-facultad"
                value={nuevo.id_facultad}
                onChange={(evento) =>
                  setNuevo({ ...nuevo, id_facultad: evento.target.value })
                }
              >
                <option value="">Elegir</option>
                {facultades.map((facultad) => (
                  <option
                    key={facultad.id_facultad}
                    value={facultad.id_facultad}
                  >
                    {facultad.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <button
              type="submit"
              className="boton-pixel rojo"
              disabled={guardando}
            >
              + Inscribir equipo
            </button>
          </form>
        ) : (
          <p className="torneo-nota">
            Con el fixture generado ya no se suman equipos.
          </p>
        )}
      </Paso>

      <Paso
        numero={2}
        titulo="Generar el fixture"
        texto="Cada fecha se juega una semana después de la anterior, en la primera cancha y turno libres."
        activo={cantidad >= 2}
      >
        {hayFixture ? (
          <p className="torneo-nota listo">
            ✓ Fixture generado: {partidos.length}{" "}
            {partidos.length === 1 ? "partido" : "partidos"} en{" "}
            {fechasDe(partidos).length}{" "}
            {fechasDe(partidos).length === 1 ? "fecha" : "fechas"}.
          </p>
        ) : (
          <div className="torneo-fixture">
            <div className="torneo-fixture-fila">
              <Campo id="fixture-dia" etiqueta="Día de la fecha 1">
                <input
                  id="fixture-dia"
                  type="date"
                  min={torneo.fecha_inicio.slice(0, 10)}
                  max={torneo.fecha_fin.slice(0, 10)}
                  value={primerDia}
                  onChange={(evento) => setPrimerDia(evento.target.value)}
                />
              </Campo>

              <div className="pastillas">
                <span className="pastilla">
                  <strong>{cantidad}</strong>{" "}
                  {cantidad === 1 ? "equipo" : "equipos"}
                </span>
                <span className="pastilla">
                  <strong>{fechas}</strong> {fechas === 1 ? "fecha" : "fechas"}
                </span>
                <span className="pastilla">
                  <strong>{totalPartidos}</strong>{" "}
                  {totalPartidos === 1 ? "partido" : "partidos"}
                </span>
              </div>

              <button
                type="button"
                className="boton-pixel amarillo"
                disabled={guardando || Boolean(motivoFixture)}
                onClick={generarFixture}
              >
                Generar fixture
              </button>
            </div>

            {motivoFixture && (
              <p className="torneo-alerta">
                <i className="tarjetita roja" />
                {motivoFixture}
              </p>
            )}
          </div>
        )}
      </Paso>

      <Paso
        numero={3}
        titulo="Iniciar la edición"
        texto={
          'Pasa a "En curso". Desde ese momento los planteles quedan cerrados y el estado ya no vuelve atrás.'
        }
        activo={!motivoInicio}
      >
        <div className="torneo-iniciar">
          <button
            type="button"
            className="boton-pixel verde"
            disabled={guardando || Boolean(motivoInicio)}
            onClick={iniciar}
          >
            Iniciar edición
          </button>
          {motivoInicio && <small>{motivoInicio}</small>}
        </div>
      </Paso>
    </div>
  );
}

function Torneos({ onVerPlantel }) {
  const [torneos, setTorneos] = useState([]);
  const [facultades, setFacultades] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Edición abierta: en inscripción se ve el asistente, si no, su tarjeta
  const [seleccionId, setSeleccionId] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  async function cargarEdicion(idTorneo) {
    if (!idTorneo) {
      setEquipos([]);
      setPartidos([]);
      return;
    }

    try {
      const [listaEquipos, listaPartidos] = await Promise.all([
        apiRequest(`/equipos?id_torneo=${idTorneo}`),
        apiRequest(`/partidos?id_torneo=${idTorneo}`),
      ]);
      setEquipos(listaEquipos);
      setPartidos(listaPartidos);
    } catch (err) {
      setError(err.message);
    }
  }

  function seleccionar(idTorneo) {
    setSeleccionId(idTorneo);
    setEquipos([]);
    setPartidos([]);
    return cargarEdicion(idTorneo);
  }

  async function pedirTorneos() {
    const lista = ordenarTorneos(await apiRequest("/torneos"));
    setTorneos(lista);
    return lista;
  }

  useEffect(() => {
    Promise.all([apiRequest("/torneos"), apiRequest("/facultades")])
      .then(([lista, listaFacultades]) => {
        const ordenados = ordenarTorneos(lista);
        setTorneos(ordenados);
        setFacultades(listaFacultades);
        const inicial =
          ordenados.find((t) => t.estado === "en curso") ||
          ordenados.find((t) => t.estado === "finalizado");
        return seleccionar(inicial?.id_torneo ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
    // Solo al abrir la pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const torneo = torneos.find((t) => t.id_torneo === seleccionId);

  function abrirNueva() {
    const { anio, semestre } = proximaEdicion(torneos);
    setEdicion({ modo: "nuevo" });
    setFormulario({
      nombre: nombreSugerido(anio, semestre),
      anio: String(anio),
      semestre: String(semestre),
      fecha_inicio: "",
      fecha_fin: "",
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function abrirEditar(elegido) {
    setEdicion({ modo: "editar", id: elegido.id_torneo });
    setFormulario({
      nombre: elegido.nombre,
      anio: String(elegido.anio),
      semestre: String(elegido.semestre),
      fecha_inicio: elegido.fecha_inicio.slice(0, 10),
      fecha_fin: elegido.fecha_fin.slice(0, 10),
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function cerrar() {
    setEdicion(null);
    setError("");
  }

  // Mientras el nombre sea el sugerido, acompaña al año y al semestre
  function cambiarDatos(cambios) {
    const siguiente = { ...formulario, ...cambios };
    if (
      formulario.nombre === nombreSugerido(formulario.anio, formulario.semestre)
    ) {
      siguiente.nombre = nombreSugerido(siguiente.anio, siguiente.semestre);
    }
    setFormulario(siguiente);
    setError("");
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    if (name === "anio") {
      cambiarDatos({ anio: value });
      return;
    }
    setFormulario({ ...formulario, [name]: value });
    setError("");
  }

  const esNueva = edicion?.modo === "nuevo";
  // Los partidos cargados son los de la edición que se está editando
  const errores = formulario
    ? validar(formulario, torneos, edicion?.id, esNueva ? [] : partidos)
    : [];
  const original = torneos.find((t) => t.id_torneo === edicion?.id);
  const sinCambios =
    Boolean(original) &&
    formulario.nombre.trim() === original.nombre &&
    Number(formulario.anio) === original.anio &&
    Number(formulario.semestre) === original.semestre &&
    formulario.fecha_inicio === original.fecha_inicio.slice(0, 10) &&
    formulario.fecha_fin === original.fecha_fin.slice(0, 10);

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    const datos = {
      nombre: formulario.nombre.trim(),
      anio: Number(formulario.anio),
      semestre: Number(formulario.semestre),
      fecha_inicio: formulario.fecha_inicio,
      fecha_fin: formulario.fecha_fin,
    };

    try {
      if (esNueva) {
        const creado = await apiRequest("/torneos", {
          method: "POST",
          body: JSON.stringify(datos),
        });
        setEdicion(null);
        await pedirTorneos();
        await seleccionar(creado.id_torneo);
        setMensajeExito(`${datos.nombre} fue creada en etapa de inscripción.`);
      } else {
        await apiRequest(`/torneos/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setEdicion(null);
        await pedirTorneos();
        setMensajeExito("¡Edición guardada correctamente!");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function finalizar() {
    if (
      !(await confirmar(
        `¿Pasar "${torneo.nombre}" a Finalizado? Este cambio no se puede deshacer.`,
      ))
    ) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/torneos/${torneo.id_torneo}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "finalizado" }),
      });
      setMensajeExito(`${torneo.nombre} pasó a "Finalizado".`);
      await pedirTorneos();
    } catch (err) {
      setError(`No se pudo cambiar el estado: ${err.message}`);
    }
  }

  async function eliminar(elegido) {
    if (
      !(await confirmar(
        `¿Eliminar la edición "${elegido.nombre}"? No se puede deshacer.`,
      ))
    ) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/torneos/${elegido.id_torneo}`, { method: "DELETE" });
      setMensajeExito(`${elegido.nombre} fue eliminada.`);
      if (edicion?.id === elegido.id_torneo) setEdicion(null);
      if (seleccionId === elegido.id_torneo) await seleccionar(null);
      await pedirTorneos();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  const panel = edicion && (
    <PanelLateral
      titulo={esNueva ? "Nueva edición" : "Editar edición"}
      className="torneos-panel"
    >
      <form onSubmit={guardar} noValidate>
        <Campo id="torneo-nombre" etiqueta="Nombre">
          <input
            id="torneo-nombre"
            name="nombre"
            maxLength={100}
            value={formulario.nombre}
            onChange={cambiarCampo}
            required
          />
        </Campo>

        <div className="jugador-fila">
          <Campo id="torneo-anio" etiqueta="Año">
            <input
              id="torneo-anio"
              name="anio"
              type="number"
              min={2000}
              max={2100}
              value={formulario.anio}
              onChange={cambiarCampo}
              required
            />
          </Campo>

          <div className="jugador-campo">
            <span className="jugador-campo-etiqueta">Semestre</span>
            <div className="jugador-tipos">
              {["1", "2"].map((semestre) => (
                <button
                  key={semestre}
                  type="button"
                  className={formulario.semestre === semestre ? "elegido" : ""}
                  onClick={() => cambiarDatos({ semestre })}
                >
                  {semestre}º
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="jugador-fila">
          <Campo id="torneo-inicio" etiqueta="Inicio">
            <input
              id="torneo-inicio"
              name="fecha_inicio"
              type="date"
              value={formulario.fecha_inicio}
              onChange={cambiarCampo}
              required
            />
          </Campo>

          <Campo id="torneo-fin" etiqueta="Fin">
            <input
              id="torneo-fin"
              name="fecha_fin"
              type="date"
              min={formulario.fecha_inicio || undefined}
              value={formulario.fecha_fin}
              onChange={cambiarCampo}
              required
            />
          </Campo>
        </div>

        {esNueva && (
          <p className="torneos-arranca">
            Arranca en{" "}
            <span className="cat-estado estado-inscripcion">Inscripción</span>
          </p>
        )}

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar={esNueva ? "Crear edición" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>
    </PanelLateral>
  );

  const enAsistente = torneo?.estado === "inscripcion";

  return (
    <section className="jugadores-pagina torneos-pagina">
      {!enAsistente && (
        <div className="pagina-encabezado">
          <div>
            <p className="jugadores-etiqueta">EDICIONES</p>
            <h1>Torneos</h1>
          </div>

          <button
            type="button"
            className="boton-pixel rojo"
            onClick={abrirNueva}
          >
            + Nueva edición
          </button>
        </div>
      )}

      {error && !panel && <p className="jugadores-error">{error}</p>}
      {mensajeExito && <p className="jugadores-exito">✓ {mensajeExito}</p>}

      <div
        className={panel ? "jugadores-cuerpo con-panel" : "jugadores-cuerpo"}
      >
        <div>
          {enAsistente ? (
            <AsistenteEdicion
              key={torneo.id_torneo}
              torneo={torneo}
              equipos={equipos}
              partidos={partidos}
              facultades={facultades}
              onVolver={() => seleccionar(null)}
              onEditar={() => abrirEditar(torneo)}
              onRecargar={() => cargarEdicion(torneo.id_torneo)}
              onVerPlantel={onVerPlantel}
              onExito={setMensajeExito}
              onIniciada={pedirTorneos}
            />
          ) : (
            <>
              {torneo && (
                <EdicionActual
                  torneo={torneo}
                  equipos={equipos}
                  partidos={partidos}
                  onEditar={() => abrirEditar(torneo)}
                  onFinalizar={finalizar}
                />
              )}

              <div className="jugadores-tarjeta torneos-lista">
                <div className="jugadores-tabla-contenedor">
                  <table className="jugadores-tabla">
                    <thead>
                      <tr>
                        <th>Edición</th>
                        <th>Fechas</th>
                        <th>Estado</th>
                        <th aria-label="Acciones" />
                      </tr>
                    </thead>

                    <tbody>
                      <FilaVacia
                        columnas={4}
                        cargando={cargando}
                        hayDatos={torneos.length > 0}
                        texto="Todavía no hay ediciones."
                      />

                      {torneos.map((fila) => (
                        <tr
                          key={fila.id_torneo}
                          className={
                            fila.id_torneo === seleccionId ? "seleccionado" : ""
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="torneos-abrir"
                              onClick={() => seleccionar(fila.id_torneo)}
                            >
                              <strong className="cat-principal">
                                {fila.anio} - {fila.semestre}º semestre
                              </strong>
                              <small className="cat-secundario">
                                {fila.nombre}
                              </small>
                            </button>
                          </td>
                          <td className="cat-mono">
                            <span className="torneo-rango">
                              <span>
                                <small>Desde</small>
                                {fechaCompleta(fila.fecha_inicio)}
                              </span>
                              <span>
                                <small>Hasta</small>
                                {fechaCompleta(fila.fecha_fin)}
                              </span>
                            </span>
                          </td>
                          <td>
                            <span
                              className={`cat-estado estado-${fila.estado.replace(" ", "-")}`}
                            >
                              {etiquetaEstado(fila.estado)}
                            </span>
                          </td>
                          <td>
                            <Acciones
                              nombre={fila.nombre}
                              onBorrar={() => eliminar(fila)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {panel}
      </div>
    </section>
  );
}

export default Torneos;
