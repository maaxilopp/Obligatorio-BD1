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
  IconoCandado,
  PanelLateral,
  Problemas,
} from "./CatalogoBase";

const MOTIVOS = [
  { valor: "roja", etiqueta: "Roja" },
  { valor: "acumulacion de amarillas", etiqueta: "Acumulación de amarillas" },
  { valor: "disciplinaria", etiqueta: "Disciplinaria" },
];

const FORMULARIO_VACIO = {
  ci_jugador: "",
  numero_fecha_inicio: "1",
  cantidad_fechas: "1",
  descripcion: "",
};

function etiquetaMotivo(motivo) {
  return MOTIVOS.find((m) => m.valor === motivo)?.etiqueta || motivo;
}

function claseMotivo(motivo) {
  return `motivo-${motivo.replaceAll(" ", "-")}`;
}

function enteroEntre(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo;
}

function validar(f) {
  const errores = [];
  if (!f.ci_jugador) errores.push("Elegí un jugador.");
  if (!enteroEntre(f.numero_fecha_inicio, 1, 255)) {
    errores.push("La fecha de inicio tiene que ser un número entre 1 y 255.");
  }
  if (!enteroEntre(f.cantidad_fechas, 1, 255)) {
    errores.push("La cantidad de fechas tiene que ser un número entre 1 y 255.");
  }
  if (!f.descripcion.trim()) errores.push("Escribí el motivo de la sanción.");
  if (f.descripcion.trim().length > 255) {
    errores.push("La descripción no puede tener más de 255 caracteres.");
  }
  return errores;
}

function Sanciones() {
  // El planillero solo consulta; el resto es del administrador
  const esAdmin = localStorage.getItem("rol") === "administrador";

  const [torneos, setTorneos] = useState([]);
  const [torneoId, setTorneoId] = useState("");
  const [sanciones, setSanciones] = useState([]);
  // Jugadores inscriptos en la edición, con el nombre de su equipo
  const [inscriptos, setInscriptos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");

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
    ])
      .then(async ([listaSanciones, equipos]) => {
        const planteles = await Promise.all(
          equipos.map((equipo) =>
            apiRequest(`/equipos/${equipo.id_equipo}/jugadores`).then((js) =>
              js.map((j) => ({ ...j, equipo: equipo.nombre })),
            ),
          ),
        );
        setSanciones(listaSanciones);
        setInscriptos(planteles.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    apiRequest("/torneos")
      .then((lista) => {
        const ordenados = [...lista].sort(
          (a, b) => b.anio - a.anio || b.semestre - a.semestre,
        );
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

  const jugadorPorCi = new Map(inscriptos.map((j) => [j.ci, j]));
  const nombreJugador = (ci) => {
    const jugador = jugadorPorCi.get(ci);
    return jugador ? `${jugador.nombre} ${jugador.apellido}` : ci;
  };

  const texto = busqueda.trim().toLowerCase();
  const encontradas = sanciones.filter((sancion) => {
    if (!texto) return true;
    const jugador = jugadorPorCi.get(sancion.ci_jugador);
    return (
      nombreJugador(sancion.ci_jugador).toLowerCase().includes(texto) ||
      sancion.ci_jugador.includes(texto) ||
      (jugador?.equipo || "").toLowerCase().includes(texto)
    );
  });
  const visibles = motivoFiltro
    ? encontradas.filter((s) => s.motivo === motivoFiltro)
    : encontradas;
  const cantidad = (motivo) =>
    encontradas.filter((s) => s.motivo === motivo).length;

  // ---------- alta, edición y baja ----------

  function abrirNueva() {
    setEdicion({ modo: "nuevo" });
    setFormulario(FORMULARIO_VACIO);
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
        setMensajeExito(
          `Se sancionó a ${nombreJugador(datos.ci_jugador)}.`,
        );
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
      !window.confirm(
        `¿Eliminar la sanción de ${nombreJugador(sancion.ci_jugador)}?`,
      )
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

  const panel = esAdmin && edicion && (
    <PanelLateral titulo={esNueva ? "Nueva sanción" : "Editar sanción"}>
      <form onSubmit={guardar} noValidate>
        <p className="cat-aviso">
          Acá se cargan las sanciones disciplinarias. Las de tarjeta roja y las
          de acumulación de amarillas se generan solas.
        </p>

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
                      {jugador.nombre} {jugador.apellido}
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
              max={255}
              value={formulario.numero_fecha_inicio}
              onChange={cambiarCampo}
            />
          </Campo>

          <Campo id="sancion-cantidad" etiqueta="Cantidad de fechas">
            <input
              id="sancion-cantidad"
              name="cantidad_fechas"
              type="number"
              min={1}
              max={255}
              value={formulario.cantidad_fechas}
              onChange={cambiarCampo}
            />
          </Campo>
        </div>

        <Campo id="sancion-descripcion" etiqueta="Descripción">
          <input
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
          textoGuardar={esNueva ? "Crear" : "Guardar"}
          sinCambios={sinCambios}
          onCancelar={cerrar}
        />
      </form>
    </PanelLateral>
  );

  return (
    <Catalogo
      titulo="Sanciones"
      textoNuevo="+ Nueva sanción"
      onNuevo={esAdmin ? abrirNueva : undefined}
      exito={mensajeExito}
      error={error}
      panel={panel}
      filtros={
        <>
          <div className="cat-selector-torneo">
            <label htmlFor="sanciones-torneo">Edición</label>
            <select
              id="sanciones-torneo"
              value={torneoId}
              onChange={(evento) => cambiarTorneo(evento.target.value)}
            >
              {torneos.map((t) => (
                <option key={t.id_torneo} value={t.id_torneo}>
                  {t.nombre} - {t.anio}
                </option>
              ))}
            </select>
          </div>

          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Jugador, cédula o equipo"
            etiqueta="Buscar sanción"
          />

          <Chips
            valor={motivoFiltro}
            onChange={setMotivoFiltro}
            opciones={[
              { valor: "", etiqueta: "Todas", cantidad: encontradas.length },
              ...MOTIVOS.map((m) => ({
                valor: m.valor,
                etiqueta: m.etiqueta,
                cantidad: cantidad(m.valor),
              })),
            ]}
          />
        </>
      }
    >
      <table className="jugadores-tabla">
        <thead>
          <tr>
            <th>Jugador</th>
            <th>Motivo</th>
            <th>Desde</th>
            <th>Fechas</th>
            <th>Origen</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>

        <tbody>
          <FilaVacia
            columnas={6}
            cargando={cargando}
            hayDatos={visibles.length > 0}
            texto="No hay sanciones que coincidan en esta edición."
          />

          {visibles.map((sancion) => {
            const automatica = sancion.id_tarjeta !== null;
            return (
              <tr
                key={sancion.id_sancion}
                className={edicion?.id === sancion.id_sancion ? "seleccionado" : ""}
              >
                <td>
                  <strong className="cat-principal">
                    {nombreJugador(sancion.ci_jugador)}
                  </strong>
                  <small className="cat-secundario">
                    {jugadorPorCi.get(sancion.ci_jugador)?.equipo ||
                      sancion.ci_jugador}
                  </small>
                </td>
                <td>
                  <span className={`cat-estado ${claseMotivo(sancion.motivo)}`}>
                    {etiquetaMotivo(sancion.motivo)}
                  </span>
                </td>
                <td className="cat-mono">Fecha {sancion.numero_fecha_inicio}</td>
                <td className="cat-mono">{sancion.cantidad_fechas}</td>
                <td>
                  {automatica ? (
                    <span className="cat-candado" title="Se corrige desde la tarjeta">
                      <IconoCandado /> Automática
                    </span>
                  ) : (
                    <span title={sancion.descripcion || undefined}>
                      <small className="cat-secundario">
                        {sancion.descripcion || "Manual"}
                      </small>
                    </span>
                  )}
                </td>
                <td>
                  {esAdmin && !automatica && (
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
    </Catalogo>
  );
}

export default Sanciones;
