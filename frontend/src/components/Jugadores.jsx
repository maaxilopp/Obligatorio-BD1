import { useEffect, useState } from "react";
import { confirmar } from "./confirmar";
import "./Jugadores.css";
import { colorEquipo } from "./colores";
import { apiRequest } from "../services/api";

const TIPOS = [
  { valor: "grado", etiqueta: "Grado" },
  { valor: "posgrado", etiqueta: "Posgrado" },
  { valor: "docente", etiqueta: "Docente" },
  { valor: "funcionario", etiqueta: "Funcionario" },
];

const FORMULARIO_VACIO = {
  ci: "",
  nombre: "",
  apellido: "",
  email: "",
  fecha_nacimiento: "",
  id_facultad: "",
  tipo: "grado",
};

const PATRON_CI = /^[0-9]{7,8}$/;
const PATRON_EMAIL = /^[^@ ]+@[^@ ]+\.[^@ ]+$/;

function formatearCedula(ci = "") {
  const cuerpo = ci.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${ci.slice(-1)}`;
}

function iniciales(nombre = "", apellido = "") {
  return `${nombre.trim()[0] || ""}${apellido.trim()[0] || ""}`.toUpperCase();
}

function edad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const [anio, mes, dia] = fechaNacimiento.split("-").map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - anio;
  if (
    hoy.getMonth() + 1 < mes ||
    (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)
  ) {
    anios -= 1;
  }
  return anios;
}

function hoyISO() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function etiquetaTipo(tipo) {
  return TIPOS.find((t) => t.valor === tipo)?.etiqueta || tipo;
}

function validar(formulario, esNuevo) {
  const errores = [];

  if (esNuevo && !PATRON_CI.test(formulario.ci)) {
    errores.push("La cédula debe tener 7 u 8 dígitos, sin puntos ni guión.");
  }
  if (!formulario.nombre.trim() || !formulario.apellido.trim()) {
    errores.push("El nombre y el apellido no pueden estar vacíos.");
  }
  if (!PATRON_EMAIL.test(formulario.email.trim())) {
    errores.push("El email no tiene un formato válido.");
  }
  if (!formulario.fecha_nacimiento) {
    errores.push("Falta la fecha de nacimiento.");
  } else if (
    formulario.fecha_nacimiento >= hoyISO() ||
    formulario.fecha_nacimiento < "1920-01-01"
  ) {
    errores.push(
      "La fecha de nacimiento tiene que ser una fecha pasada (desde 1920).",
    );
  }
  if (!formulario.id_facultad) {
    errores.push("Elegí una facultad.");
  }

  return errores;
}

function Avatar({ jugador, grande = false }) {
  return (
    <span
      className={grande ? "jugador-avatar grande" : "jugador-avatar"}
      style={
        grande
          ? undefined
          : { backgroundColor: colorEquipo(jugador.id_facultad) }
      }
    >
      {iniciales(jugador.nombre, jugador.apellido) || "?"}
    </span>
  );
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

function Jugadores() {
  const [jugadores, setJugadores] = useState([]);
  const [facultades, setFacultades] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  // null | { modo: 'nuevo' } | { modo: 'editar', ci }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  function pedirDatos() {
    return Promise.all([apiRequest("/jugadores"), apiRequest("/facultades")])
      .then(([listaJugadores, listaFacultades]) => {
        setJugadores(listaJugadores);
        setFacultades(listaFacultades);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    pedirDatos();
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const soloDigitos = texto.replace(/\D/g, "");

  const encontrados = jugadores.filter((jugador) => {
    if (!texto) return true;
    const nombreCompleto =
      `${jugador.nombre} ${jugador.apellido}`.toLowerCase();
    return (
      nombreCompleto.includes(texto) ||
      (soloDigitos.length > 0 && jugador.ci.includes(soloDigitos))
    );
  });

  const visibles = tipoFiltro
    ? encontrados.filter((jugador) => jugador.tipo === tipoFiltro)
    : encontrados;

  const cantidadTipo = (tipo) =>
    encontrados.filter((jugador) => jugador.tipo === tipo).length;

  function abrirNuevo() {
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function abrirEditar(jugador) {
    setEdicion({ modo: "editar", ci: jugador.ci });
    setFormulario({
      ci: jugador.ci,
      nombre: jugador.nombre,
      apellido: jugador.apellido,
      email: jugador.email,
      fecha_nacimiento: jugador.fecha_nacimiento,
      id_facultad: String(jugador.id_facultad),
      tipo: jugador.tipo,
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
    const valor = name === "ci" ? value.replace(/\D/g, "").slice(0, 8) : value;
    setFormulario({ ...formulario, [name]: valor });
    setError("");
  }

  const esNuevo = edicion?.modo === "nuevo";
  const errores = validar(formulario, esNuevo);

  // Al editar, Guardar solo se habilita si cambió algo respecto al jugador original
  // (se compara como se va a guardar: sin espacios sobrantes y el email en minúscula)
  const original = jugadores.find((jugador) => jugador.ci === edicion?.ci);
  const sinCambios =
    Boolean(original) &&
    formulario.nombre.trim() === original.nombre &&
    formulario.apellido.trim() === original.apellido &&
    formulario.email.trim().toLowerCase() === original.email &&
    formulario.fecha_nacimiento === original.fecha_nacimiento &&
    Number(formulario.id_facultad) === original.id_facultad &&
    formulario.tipo === original.tipo;

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    const datos = {
      nombre: formulario.nombre.trim(),
      apellido: formulario.apellido.trim(),
      email: formulario.email.trim().toLowerCase(),
      fecha_nacimiento: formulario.fecha_nacimiento,
      id_facultad: Number(formulario.id_facultad),
      tipo: formulario.tipo,
    };

    try {
      if (esNuevo) {
        await apiRequest("/jugadores", {
          method: "POST",
          body: JSON.stringify({ ci: formulario.ci, ...datos }),
        });
        setMensajeExito(`${datos.nombre} ${datos.apellido} fue agregado.`);
      } else {
        await apiRequest(`/jugadores/${edicion.ci}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setMensajeExito("¡Jugador guardado correctamente!");
      }

      setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(jugador) {
    const confirmado = await confirmar(
      `¿Eliminar a ${jugador.nombre} ${jugador.apellido} (${formatearCedula(jugador.ci)})?`,
    );
    if (!confirmado) return;

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/jugadores/${jugador.ci}`, { method: "DELETE" });
      setMensajeExito(`${jugador.nombre} ${jugador.apellido} fue eliminado.`);
      if (edicion?.ci === jugador.ci) setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  const facultadElegida = facultades.find(
    (facultad) =>
      String(facultad.id_facultad) === String(formulario.id_facultad),
  );
  const edadElegida = edad(formulario.fecha_nacimiento);

  return (
    <section className="jugadores-pagina">
      <div className="jugadores-encabezado">
        <div>
          <p className="jugadores-etiqueta">CATÁLOGO DE: </p>
          <h1>Jugadores</h1>
        </div>

        <button
          type="button"
          className="jugadores-boton-nuevo"
          onClick={abrirNuevo}
        >
          + Nuevo jugador
        </button>
      </div>

      {error && !edicion && <p className="jugadores-error">{error}</p>}
      {mensajeExito && <p className="jugadores-exito">✓ {mensajeExito}</p>}

      <div
        className={edicion ? "jugadores-cuerpo con-panel" : "jugadores-cuerpo"}
      >
        <div className="jugadores-tarjeta">
          <div className="jugadores-filtros">
            <label className="jugadores-buscador">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle
                  cx="7"
                  cy="7"
                  r="4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M10.5 10.5L14 14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              <input
                type="search"
                placeholder="Nombre, apellido o cédula"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                aria-label="Buscar jugador"
              />
            </label>

            <div className="jugadores-chips">
              <button
                type="button"
                className={tipoFiltro === "" ? "activo" : ""}
                onClick={() => setTipoFiltro("")}
              >
                Todos <span>{encontrados.length}</span>
              </button>

              {TIPOS.map((tipo) => (
                <button
                  key={tipo.valor}
                  type="button"
                  className={tipoFiltro === tipo.valor ? "activo" : ""}
                  onClick={() => setTipoFiltro(tipo.valor)}
                >
                  {tipo.etiqueta} <span>{cantidadTipo(tipo.valor)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="jugadores-tabla-contenedor">
            <table className="jugadores-tabla">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Cédula</th>
                  <th>Facultad</th>
                  <th>Tipo</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>

              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="5" className="jugadores-vacio">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!cargando && visibles.length === 0 && (
                  <tr>
                    <td colSpan="5" className="jugadores-vacio">
                      No hay jugadores que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}

                {visibles.map((jugador) => (
                  <tr
                    key={jugador.ci}
                    className={edicion?.ci === jugador.ci ? "seleccionado" : ""}
                  >
                    <td>
                      <div className="jugador-celda">
                        <Avatar jugador={jugador} />
                        <div>
                          <strong>
                            {jugador.nombre} {jugador.apellido}
                          </strong>
                          <small title={jugador.email}>{jugador.email}</small>
                        </div>
                      </div>
                    </td>
                    <td className="jugador-cedula">
                      {formatearCedula(jugador.ci)}
                    </td>
                    <td>
                      <span className="jugador-facultad">
                        <span
                          className="jugador-facultad-color"
                          style={{
                            backgroundColor: colorEquipo(jugador.id_facultad),
                          }}
                        />
                        {jugador.facultad}
                      </span>
                    </td>
                    <td>
                      <span className={`jugador-tipo tipo-${jugador.tipo}`}>
                        {etiquetaTipo(jugador.tipo)}
                      </span>
                    </td>
                    <td>
                      <div className="jugador-acciones">
                        <button
                          type="button"
                          title="Editar jugador"
                          aria-label={`Editar a ${jugador.nombre} ${jugador.apellido}`}
                          onClick={() => abrirEditar(jugador)}
                        >
                          <IconoLapiz />
                        </button>
                        <button
                          type="button"
                          className="borrar"
                          title="Eliminar jugador"
                          aria-label={`Eliminar a ${jugador.nombre} ${jugador.apellido}`}
                          onClick={() => eliminar(jugador)}
                        >
                          <IconoTacho />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {edicion && (
          <aside className="jugador-panel">
            <div className="jugador-panel-titulo">
              <h2>{esNuevo ? "Nuevo jugador" : "Editar jugador"}</h2>
            </div>

            <form onSubmit={guardar} noValidate>
              <div
                className="jugador-ficha"
                style={{
                  backgroundColor: facultadElegida
                    ? colorEquipo(facultadElegida.id_facultad)
                    : "#e5e4e7",
                }}
              >
                <Avatar jugador={formulario} grande />
                <div className="jugador-ficha-texto">
                  <strong>
                    {`${formulario.nombre} ${formulario.apellido}`.trim() ||
                      "Nuevo jugador"}
                  </strong>
                  <span>{facultadElegida?.nombre || "Sin facultad"}</span>
                  <small>
                    {etiquetaTipo(formulario.tipo)}
                    {edadElegida !== null &&
                      edadElegida >= 0 &&
                      ` · ${edadElegida} años`}
                  </small>
                </div>
              </div>

              <div className="jugador-campo">
                <label htmlFor="jugador-ci">
                  {esNuevo
                    ? "Cédula (sin puntos ni guión)"
                    : "Cédula (no se modifica)"}
                </label>
                <input
                  id="jugador-ci"
                  name="ci"
                  inputMode="numeric"
                  value={formulario.ci}
                  onChange={cambiarCampo}
                  disabled={!esNuevo}
                  placeholder={esNuevo ? "12345678" : undefined}
                  required
                />
              </div>

              <div className="jugador-fila">
                <div className="jugador-campo">
                  <label htmlFor="jugador-nombre">Nombre</label>
                  <input
                    id="jugador-nombre"
                    name="nombre"
                    maxLength={50}
                    value={formulario.nombre}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="jugador-campo">
                  <label htmlFor="jugador-apellido">Apellido</label>
                  <input
                    id="jugador-apellido"
                    name="apellido"
                    maxLength={50}
                    value={formulario.apellido}
                    onChange={cambiarCampo}
                    required
                  />
                </div>
              </div>

              <div className="jugador-campo">
                <label htmlFor="jugador-email">Email</label>
                <input
                  id="jugador-email"
                  name="email"
                  type="email"
                  maxLength={100}
                  value={formulario.email}
                  onChange={cambiarCampo}
                  required
                />
              </div>

              <div className="jugador-fila">
                <div className="jugador-campo">
                  <label htmlFor="jugador-nacimiento">Nacimiento</label>
                  <input
                    id="jugador-nacimiento"
                    name="fecha_nacimiento"
                    type="date"
                    min="1920-01-01"
                    max={hoyISO()}
                    value={formulario.fecha_nacimiento}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="jugador-campo">
                  <label htmlFor="jugador-facultad">Facultad</label>
                  <select
                    id="jugador-facultad"
                    name="id_facultad"
                    value={formulario.id_facultad}
                    onChange={cambiarCampo}
                    required
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
                </div>
              </div>

              <div className="jugador-campo">
                <span className="jugador-campo-etiqueta">Tipo</span>
                <div className="jugador-tipos">
                  {TIPOS.map((tipo) => (
                    <button
                      key={tipo.valor}
                      type="button"
                      className={
                        formulario.tipo === tipo.valor ? "elegido" : ""
                      }
                      onClick={() =>
                        setFormulario({ ...formulario, tipo: tipo.valor })
                      }
                    >
                      {tipo.etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              {intentoGuardar && errores.length > 0 && (
                <ul className="jugador-problemas">
                  {errores.map((problema) => (
                    <li key={problema}>{problema}</li>
                  ))}
                </ul>
              )}

              {error && <p className="jugadores-error">{error}</p>}

              <div className="jugador-botones">
                <button
                  type="submit"
                  className="guardar"
                  disabled={sinCambios}
                  title={sinCambios ? 'No hay cambios para guardar' : undefined}
                >
                  {esNuevo ? "Crear" : "Guardar"}
                </button>
                <button type="button" className="cancelar" onClick={cerrar}>
                  Cancelar
                </button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

export default Jugadores;
