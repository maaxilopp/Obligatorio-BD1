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

const DEPARTAMENTOS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores",
  "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro",
  "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó",
  "Treinta y Tres",
];

const SUPERFICIES = [
  { valor: "sintetico", etiqueta: "Sintético" },
  { valor: "parquet", etiqueta: "Parquet" },
];

const FORMULARIO_VACIO = { nombre: "", direccion: "", departamento: "Montevideo" };
const CANCHA_VACIA = { nombre_cancha: "", superficie: "sintetico", techada: false };

function etiquetaSuperficie(valor) {
  return SUPERFICIES.find((s) => s.valor === valor)?.etiqueta || valor;
}

function validar(f) {
  const errores = [];
  if (!f.nombre.trim()) errores.push("El nombre no puede estar vacío.");
  if (!f.direccion.trim()) errores.push("La dirección no puede estar vacía.");
  if (!DEPARTAMENTOS.includes(f.departamento)) {
    errores.push("Elegí un departamento.");
  }
  return errores;
}

function Complejos() {
  const [complejos, setComplejos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");

  // null | { modo: 'nuevo' } | { modo: 'editar', id }
  const [edicion, setEdicion] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  // Canchas del complejo que se está editando
  const [canchas, setCanchas] = useState([]);
  const [cancha, setCancha] = useState(CANCHA_VACIA);
  const [canchaEditada, setCanchaEditada] = useState(null); // nombre de la cancha
  const [errorCancha, setErrorCancha] = useState("");

  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  function pedirDatos() {
    return apiRequest("/complejos")
      .then(setComplejos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  function pedirCanchas(idComplejo) {
    return apiRequest(`/complejos/${idComplejo}/canchas`)
      .then(setCanchas)
      .catch((err) => setErrorCancha(err.message));
  }

  useEffect(() => {
    pedirDatos();
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const visibles = complejos.filter(
    (complejo) =>
      (!departamentoFiltro || complejo.departamento === departamentoFiltro) &&
      (!texto ||
        complejo.nombre.toLowerCase().includes(texto) ||
        complejo.direccion.toLowerCase().includes(texto)),
  );

  // Solo se ofrecen los departamentos que tienen complejos
  const departamentosConComplejos = DEPARTAMENTOS.filter((d) =>
    complejos.some((c) => c.departamento === d),
  );

  function reiniciarCanchas() {
    setCanchas([]);
    setCancha(CANCHA_VACIA);
    setCanchaEditada(null);
    setErrorCancha("");
  }

  function abrirNuevo() {
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
    reiniciarCanchas();
  }

  function abrirEditar(complejo) {
    setEdicion({ modo: "editar", id: complejo.id_complejo });
    setFormulario({
      nombre: complejo.nombre,
      direccion: complejo.direccion,
      departamento: complejo.departamento,
    });
    setIntentoGuardar(false);
    setError("");
    setMensajeExito("");
    reiniciarCanchas();
    pedirCanchas(complejo.id_complejo);
  }

  function cerrar() {
    setEdicion(null);
    setError("");
    reiniciarCanchas();
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario({ ...formulario, [name]: value });
    setError("");
  }

  const esNuevo = edicion?.modo === "nuevo";
  const errores = validar(formulario);
  const original = complejos.find((c) => c.id_complejo === edicion?.id);
  const sinCambios =
    Boolean(original) &&
    formulario.nombre.trim() === original.nombre &&
    formulario.direccion.trim() === original.direccion &&
    formulario.departamento === original.departamento;

  async function guardar(evento) {
    evento.preventDefault();
    if (sinCambios) return;
    setIntentoGuardar(true);
    if (errores.length > 0) return;

    const datos = {
      nombre: formulario.nombre.trim(),
      direccion: formulario.direccion.trim(),
      departamento: formulario.departamento,
    };

    try {
      if (esNuevo) {
        const creado = await apiRequest("/complejos", {
          method: "POST",
          body: JSON.stringify(datos),
        });
        setMensajeExito(
          `${datos.nombre} fue agregado. Ahora podés cargar sus canchas.`,
        );
        // Queda abierto para poder agregar las canchas enseguida
        setEdicion({ modo: "editar", id: creado.id_complejo });
        setCanchas([]);
      } else {
        await apiRequest(`/complejos/${edicion.id}`, {
          method: "PUT",
          body: JSON.stringify(datos),
        });
        setMensajeExito("¡Complejo guardado correctamente!");
        setEdicion(null);
        reiniciarCanchas();
      }

      await pedirDatos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(complejo) {
    if (
      !window.confirm(
        `¿Eliminar el complejo ${complejo.nombre}? Se borran también sus canchas.`,
      )
    ) {
      return;
    }

    setError("");
    setMensajeExito("");

    try {
      await apiRequest(`/complejos/${complejo.id_complejo}`, {
        method: "DELETE",
      });
      setMensajeExito(`${complejo.nombre} fue eliminado.`);
      if (edicion?.id === complejo.id_complejo) cerrar();
      await pedirDatos();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  }

  // ---------- canchas ----------

  function editarCancha(c) {
    setCanchaEditada(c.nombre_cancha);
    setCancha({
      nombre_cancha: c.nombre_cancha,
      superficie: c.superficie,
      techada: c.techada,
    });
    setErrorCancha("");
  }

  function cancelarCancha() {
    setCanchaEditada(null);
    setCancha(CANCHA_VACIA);
    setErrorCancha("");
  }

  async function guardarCancha() {
    if (!cancha.nombre_cancha.trim()) {
      setErrorCancha("La cancha necesita un nombre.");
      return;
    }

    try {
      if (canchaEditada === null) {
        await apiRequest(`/complejos/${edicion.id}/canchas`, {
          method: "POST",
          body: JSON.stringify({
            nombre_cancha: cancha.nombre_cancha.trim(),
            superficie: cancha.superficie,
            techada: cancha.techada,
          }),
        });
      } else {
        // El nombre es parte de la clave: al editar solo cambian superficie y techada
        await apiRequest(
          `/complejos/${edicion.id}/canchas/${encodeURIComponent(canchaEditada)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              superficie: cancha.superficie,
              techada: cancha.techada,
            }),
          },
        );
      }

      cancelarCancha();
      await Promise.all([pedirCanchas(edicion.id), pedirDatos()]);
    } catch (err) {
      setErrorCancha(err.message);
    }
  }

  async function eliminarCancha(c) {
    if (!window.confirm(`¿Eliminar la cancha ${c.nombre_cancha}?`)) return;

    try {
      await apiRequest(
        `/complejos/${edicion.id}/canchas/${encodeURIComponent(c.nombre_cancha)}`,
        { method: "DELETE" },
      );
      if (canchaEditada === c.nombre_cancha) cancelarCancha();
      setErrorCancha("");
      await Promise.all([pedirCanchas(edicion.id), pedirDatos()]);
    } catch (err) {
      setErrorCancha(`No se pudo eliminar: ${err.message}`);
    }
  }

  const panel = edicion && (
    <PanelLateral titulo={esNuevo ? "Nuevo complejo" : "Editar complejo"}>
      <form onSubmit={guardar} noValidate>
        <Campo id="complejo-nombre" etiqueta="Nombre">
          <input
            id="complejo-nombre"
            name="nombre"
            maxLength={100}
            value={formulario.nombre}
            onChange={cambiarCampo}
            required
          />
        </Campo>

        <Campo id="complejo-direccion" etiqueta="Dirección">
          <input
            id="complejo-direccion"
            name="direccion"
            maxLength={150}
            value={formulario.direccion}
            onChange={cambiarCampo}
            required
          />
        </Campo>

        <Campo id="complejo-departamento" etiqueta="Departamento">
          <select
            id="complejo-departamento"
            name="departamento"
            value={formulario.departamento}
            onChange={cambiarCampo}
          >
            {DEPARTAMENTOS.map((departamento) => (
              <option key={departamento} value={departamento}>
                {departamento}
              </option>
            ))}
          </select>
        </Campo>

        <Problemas errores={errores} mostrar={intentoGuardar} />
        {error && <p className="jugadores-error">{error}</p>}

        <BotonesPanel
          textoGuardar={esNuevo ? "Crear" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>

      {!esNuevo && (
        <div className="cat-seccion">
          <h3>Canchas ({canchas.length})</h3>

          {canchas.length === 0 && (
            <p className="cat-aviso">Este complejo todavía no tiene canchas.</p>
          )}

          <ul className="cat-lista">
            {canchas.map((c) => (
              <li key={c.nombre_cancha}>
                <div>
                  <strong>{c.nombre_cancha}</strong>
                  <small>
                    {etiquetaSuperficie(c.superficie)} ·{" "}
                    {c.techada ? "Techada" : "Descubierta"}
                  </small>
                </div>
                <Acciones
                  nombre={c.nombre_cancha}
                  onEditar={() => editarCancha(c)}
                  onBorrar={() => eliminarCancha(c)}
                />
              </li>
            ))}
          </ul>

          <div className="cat-mini-form">
            <div className="ancho">
              <input
                aria-label="Nombre de la cancha"
                placeholder="Nombre de la cancha (ej. Cancha 1)"
                maxLength={50}
                value={cancha.nombre_cancha}
                disabled={canchaEditada !== null}
                onChange={(evento) =>
                  setCancha({ ...cancha, nombre_cancha: evento.target.value })
                }
              />
            </div>

            <select
              aria-label="Superficie"
              value={cancha.superficie}
              onChange={(evento) =>
                setCancha({ ...cancha, superficie: evento.target.value })
              }
            >
              {SUPERFICIES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.etiqueta}
                </option>
              ))}
            </select>

            <label className="cat-check">
              <input
                type="checkbox"
                checked={cancha.techada}
                onChange={(evento) =>
                  setCancha({ ...cancha, techada: evento.target.checked })
                }
              />
              Techada
            </label>

            <button
              type="button"
              className="cat-boton-agregar"
              onClick={guardarCancha}
            >
              {canchaEditada === null ? "+ Agregar cancha" : "Guardar cancha"}
            </button>

            {canchaEditada !== null && (
              <button
                type="button"
                className="cat-boton-agregar"
                onClick={cancelarCancha}
              >
                Cancelar
              </button>
            )}
          </div>

          {errorCancha && <p className="jugadores-error">{errorCancha}</p>}
        </div>
      )}
    </PanelLateral>
  );

  return (
    <Catalogo
      titulo="Complejos"
      textoNuevo="+ Nuevo complejo"
      onNuevo={abrirNuevo}
      exito={mensajeExito}
      error={error}
      panel={panel}
      filtros={
        <>
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Nombre o dirección"
            etiqueta="Buscar complejo"
          />
          <div className="cat-selector-torneo">
            <label htmlFor="filtro-departamento">Departamento</label>
            <select
              id="filtro-departamento"
              value={departamentoFiltro}
              onChange={(evento) => setDepartamentoFiltro(evento.target.value)}
            >
              <option value="">Todos</option>
              {departamentosConComplejos.map((departamento) => (
                <option key={departamento} value={departamento}>
                  {departamento}
                </option>
              ))}
            </select>
          </div>
        </>
      }
    >
      <table className="jugadores-tabla">
        <thead>
          <tr>
            <th>Complejo</th>
            <th>Departamento</th>
            <th>Canchas</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>

        <tbody>
          <FilaVacia
            columnas={4}
            cargando={cargando}
            hayDatos={visibles.length > 0}
            texto="No hay complejos que coincidan con la búsqueda."
          />

          {visibles.map((complejo) => (
            <tr
              key={complejo.id_complejo}
              className={edicion?.id === complejo.id_complejo ? "seleccionado" : ""}
            >
              <td>
                <span className="cat-con-color">
                  <span
                    className="jugador-facultad-color"
                    style={{ backgroundColor: colorEquipo(complejo.id_complejo) }}
                  />
                  <span>
                    <strong className="cat-principal">{complejo.nombre}</strong>
                    <small className="cat-secundario" title={complejo.direccion}>
                      {complejo.direccion}
                    </small>
                  </span>
                </span>
              </td>
              <td>{complejo.departamento}</td>
              <td className="cat-mono">{complejo.cantidad_canchas}</td>
              <td>
                <Acciones
                  nombre={complejo.nombre}
                  onEditar={() => abrirEditar(complejo)}
                  onBorrar={() => eliminar(complejo)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Catalogo>
  );
}

export default Complejos;
