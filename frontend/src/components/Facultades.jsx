import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { colorEquipo } from "./colores";
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

function validar(nombre) {
  const errores = [];
  if (!nombre.trim()) errores.push("El nombre no puede estar vacío.");
  if (nombre.trim().length > 100) {
    errores.push("El nombre no puede tener más de 100 caracteres.");
  }
  return errores;
}

function Facultades() {
  const [facultades, setFacultades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [nombre, setNombre] = useState("");
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  function pedirDatos() {
    return apiRequest("/facultades")
      .then(setFacultades)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    pedirDatos();
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const visibles = facultades.filter((facultad) =>
    facultad.nombre.toLowerCase().includes(texto),
  );

  function abrirNueva() {
    setEdicion({ modo: "nuevo" });
    setNombre("");
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function abrirEditar(facultad) {
    setEdicion({ modo: "editar", id: facultad.id_facultad });
    setNombre(facultad.nombre);
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
  }

  function cerrar() {
    setEdicion(null);
    setError("");
  }

  const esNueva = edicion?.modo === "nuevo";
  const errores = validar(nombre);
  const original = facultades.find((f) => f.id_facultad === edicion?.id);
  const sinCambios = Boolean(original) && nombre.trim() === original.nombre;

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    const datos = { nombre: nombre.trim() };

    try {
      if (esNueva) {
        await apiRequest("/facultades", {
          method: "POST",
          body: JSON.stringify(datos),
        });
        setMensajeExito(`La facultad ${datos.nombre} fue agregada.`);
      } else {
        await apiRequest(`/facultades/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setMensajeExito("¡Facultad guardada correctamente!");
      }

      setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(facultad) {
    if (!window.confirm(`¿Eliminar la facultad ${facultad.nombre}?`)) return;

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/facultades/${facultad.id_facultad}`, {
        method: "DELETE",
      });
      setMensajeExito(`La facultad ${facultad.nombre} fue eliminada.`);
      if (edicion?.id === facultad.id_facultad) setEdicion(null);
      await pedirDatos();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  const panel = edicion && (
    <PanelLateral titulo={esNueva ? "Nueva facultad" : "Editar facultad"}>
      <form onSubmit={guardar} noValidate>
        <Campo id="facultad-nombre" etiqueta="Nombre">
          <input
            id="facultad-nombre"
            maxLength={100}
            value={nombre}
            onChange={(evento) => {
              setNombre(evento.target.value);
              setError("");
            }}
            placeholder="Facultad de Ingeniería"
            required
          />
        </Campo>

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar={esNueva ? "Crear" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>
    </PanelLateral>
  );

  return (
    <Catalogo
      titulo="Facultades"
      textoNuevo="+ Nueva facultad"
      onNuevo={abrirNueva}
      exito={mensajeExito}
      error={error}
      panel={panel}
      filtros={
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar facultad"
          etiqueta="Buscar facultad"
        />
      }
    >
      <table className="jugadores-tabla">
        <thead>
          <tr>
            <th>Facultad</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>

        <tbody>
          <FilaVacia
            columnas={2}
            cargando={cargando}
            hayDatos={visibles.length > 0}
            texto="No hay facultades que coincidan con la búsqueda."
          />

          {visibles.map((facultad) => (
            <tr
              key={facultad.id_facultad}
              className={edicion?.id === facultad.id_facultad ? "seleccionado" : ""}
            >
              <td>
                <span className="cat-con-color">
                  <span
                    className="jugador-facultad-color"
                    style={{ backgroundColor: colorEquipo(facultad.id_facultad) }}
                  />
                  {facultad.nombre}
                </span>
              </td>
              <td>
                <Acciones
                  nombre={facultad.nombre}
                  onEditar={() => abrirEditar(facultad)}
                  onBorrar={() => eliminar(facultad)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Catalogo>
  );
}

export default Facultades;
