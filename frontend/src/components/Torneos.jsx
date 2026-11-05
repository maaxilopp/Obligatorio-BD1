import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import {
  Acciones,
  BotonesPanel,
  Buscador,
  Campo,
  Catalogo,
  Chips,
  FilaVacia,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";

const ESTADOS = [
  { valor: "inscripcion", etiqueta: "Inscripción" },
  { valor: "en curso", etiqueta: "En curso" },
  { valor: "finalizado", etiqueta: "Finalizado" },
];

// El estado solo avanza: inscripción -> en curso -> finalizado
const SIGUIENTE = {
  inscripcion: { estado: "en curso", boton: "Iniciar torneo" },
  "en curso": { estado: "finalizado", boton: "Finalizar" },
};

const FORMULARIO_VACIO = {
  nombre: "",
  anio: String(new Date().getFullYear()),
  semestre: "1",
  fecha_inicio: "",
  fecha_fin: "",
};

function etiquetaEstado(estado) {
  return ESTADOS.find((e) => e.valor === estado)?.etiqueta || estado;
}

function claseEstado(estado) {
  return `estado-${estado.replace(" ", "-")}`;
}

function formatearFecha(iso = "") {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

function validar(f) {
  const errores = [];
  const anio = Number(f.anio);

  if (!f.nombre.trim()) errores.push("El nombre no puede estar vacío.");
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    errores.push("El año tiene que estar entre 2000 y 2100.");
  }
  if (!f.fecha_inicio || !f.fecha_fin) {
    errores.push("Faltan la fecha de inicio y la de fin.");
  } else {
    if (f.fecha_fin < f.fecha_inicio) {
      errores.push("La fecha de fin no puede ser anterior a la de inicio.");
    }
    if (Number(f.fecha_inicio.slice(0, 4)) !== anio) {
      errores.push("El año del torneo debe coincidir con el de la fecha de inicio.");
    }
  }
  return errores;
}

function Torneos() {
  const [torneos, setTorneos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  function pedirDatos() {
    return apiRequest("/torneos")
      .then((lista) =>
        setTorneos(
          [...lista].sort(
            (a, b) => b.anio - a.anio || b.semestre - a.semestre,
          ),
        ),
      )
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    pedirDatos();
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const encontrados = torneos.filter(
    (torneo) =>
      !texto ||
      torneo.nombre.toLowerCase().includes(texto) ||
      String(torneo.anio).includes(texto),
  );
  const visibles = estadoFiltro
    ? encontrados.filter((torneo) => torneo.estado === estadoFiltro)
    : encontrados;
  const cantidad = (estado) =>
    encontrados.filter((torneo) => torneo.estado === estado).length;

  function abrirNuevo() {
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function abrirEditar(torneo) {
    setEdicion({ modo: "editar", id: torneo.id_torneo });
    setFormulario({
      nombre: torneo.nombre,
      anio: String(torneo.anio),
      semestre: String(torneo.semestre),
      fecha_inicio: torneo.fecha_inicio.slice(0, 10),
      fecha_fin: torneo.fecha_fin.slice(0, 10),
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

  const esNuevo = edicion?.modo === "nuevo";
  const errores = validar(formulario);
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
      if (esNuevo) {
        await apiRequest("/torneos", {
          method: "POST",
          body: JSON.stringify(datos),
        });
        setMensajeExito(`El torneo ${datos.nombre} fue creado en etapa de inscripción.`);
      } else {
        await apiRequest(`/torneos/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setMensajeExito("¡Torneo guardado correctamente!");
      }

      setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function avanzarEstado(torneo) {
    const paso = SIGUIENTE[torneo.estado];
    if (!paso) return;
    if (
      !window.confirm(
        `¿${paso.boton} "${torneo.nombre}"? Este cambio no se puede deshacer.`,
      )
    ) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/torneos/${torneo.id_torneo}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: paso.estado }),
      });
      setMensajeExito(
        `${torneo.nombre} pasó a "${etiquetaEstado(paso.estado)}".`,
      );
      await pedirDatos();
    } catch (err) {
      setError(`No se pudo cambiar el estado: ${err.message}`);
    }
  }

  async function eliminar(torneo) {
    if (!window.confirm(`¿Eliminar el torneo "${torneo.nombre}" (${torneo.anio})?`)) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/torneos/${torneo.id_torneo}`, { method: "DELETE" });
      setMensajeExito(`El torneo ${torneo.nombre} fue eliminado.`);
      if (edicion?.id === torneo.id_torneo) setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  const panel = edicion && (
    <PanelLateral titulo={esNuevo ? "Nuevo torneo" : "Editar torneo"}>
      <form onSubmit={guardar} noValidate>
        <Campo id="torneo-nombre" etiqueta="Nombre">
          <input
            id="torneo-nombre"
            name="nombre"
            maxLength={100}
            value={formulario.nombre}
            onChange={cambiarCampo}
            placeholder="Torneo Interfacultades"
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

          <Campo id="torneo-semestre" etiqueta="Semestre">
            <select
              id="torneo-semestre"
              name="semestre"
              value={formulario.semestre}
              onChange={cambiarCampo}
            >
              <option value="1">1º semestre</option>
              <option value="2">2º semestre</option>
            </select>
          </Campo>
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

        {esNuevo && (
          <p className="cat-aviso">
            Todo torneo nuevo empieza en etapa de inscripción.
          </p>
        )}

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar={esNuevo ? "Crear" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>
    </PanelLateral>
  );

  return (
    <Catalogo
      titulo="Torneos"
      textoNuevo="+ Nuevo torneo"
      onNuevo={abrirNuevo}
      exito={mensajeExito}
      error={error}
      panel={panel}
      filtros={
        <>
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Nombre o año"
            etiqueta="Buscar torneo"
          />
          <Chips
            valor={estadoFiltro}
            onChange={setEstadoFiltro}
            opciones={[
              { valor: "", etiqueta: "Todos", cantidad: encontrados.length },
              ...ESTADOS.map((e) => ({
                valor: e.valor,
                etiqueta: e.etiqueta,
                cantidad: cantidad(e.valor),
              })),
            ]}
          />
        </>
      }
    >
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
            hayDatos={visibles.length > 0}
            texto="No hay torneos que coincidan con la búsqueda."
          />

          {visibles.map((torneo) => (
            <tr
              key={torneo.id_torneo}
              className={edicion?.id === torneo.id_torneo ? "seleccionado" : ""}
            >
              <td>
                <strong className="cat-principal">{torneo.nombre}</strong>
                <small className="cat-secundario">
                  {torneo.anio} · {torneo.semestre}º semestre
                </small>
              </td>
              <td className="cat-mono">
                {formatearFecha(torneo.fecha_inicio)} →{" "}
                {formatearFecha(torneo.fecha_fin)}
              </td>
              <td>
                <span className={`cat-estado ${claseEstado(torneo.estado)}`}>
                  {etiquetaEstado(torneo.estado)}
                </span>
              </td>
              <td>
                <Acciones
                  nombre={torneo.nombre}
                  onEditar={() => abrirEditar(torneo)}
                  onBorrar={() => eliminar(torneo)}
                  extra={
                    SIGUIENTE[torneo.estado] && (
                      <button
                        type="button"
                        className="cat-boton-texto"
                        onClick={() => avanzarEstado(torneo)}
                      >
                        {SIGUIENTE[torneo.estado].boton}
                      </button>
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Catalogo>
  );
}

export default Torneos;
