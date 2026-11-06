import { useState } from "react";
import "./EditarPartido.css";
import { InsigniaEquipo } from "./equipos";

const ESTADOS = [
  { valor: "programado", etiqueta: "Programado" },
  { valor: "postergado", etiqueta: "Postergado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

function claveCancha(idComplejo, nombreCancha) {
  return idComplejo ? `${idComplejo}|${nombreCancha}` : "";
}

function EditarPartido({
  partido,
  numeroFecha,
  diaSugerido = "",
  diaMinimo,
  diaMaximo,
  maxFecha = 0,
  turnos = [],
  canchas = [],
  equipos = [],
  partidos = [],
  onGuardar,
  onCambio,
  onCancelar,
}) {
  const esNuevo = !partido;

  const [formulario, setFormulario] = useState({
    numero_fecha: partido?.numero_fecha ?? numeroFecha ?? 1,
    dia: partido?.dia ?? diaSugerido,
    id_turno: partido?.id_turno ?? "",
    cancha: claveCancha(partido?.id_complejo, partido?.nombre_cancha),
    id_equipo_local: partido?.id_equipo_local ?? "",
    id_equipo_visitante: partido?.id_equipo_visitante ?? "",
    estado: partido?.estado ?? "programado",
  });

  function actualizar(cambios) {
    setFormulario({ ...formulario, ...cambios });
    if (onCambio) onCambio();
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    if (
      name === "id_equipo_local" &&
      !rivalesPosibles(value).some(
        (equipo) =>
          String(equipo.id_equipo) === String(formulario.id_equipo_visitante),
      )
    ) {
      actualizar({ id_equipo_local: value, id_equipo_visitante: "" });
      return;
    }

    actualizar({ [name]: value });
  }
  function rivalesPosibles(idLocal) {
    const local = equipos.find(
      (equipo) => String(equipo.id_equipo) === String(idLocal),
    );
    if (!local) return [];

    const yaEnfrentados = new Set(
      partidos
        .filter((p) => p.estado !== "cancelado")
        .flatMap((p) => {
          if (p.equipo_local === local.nombre) return [p.equipo_visitante];
          if (p.equipo_visitante === local.nombre) return [p.equipo_local];
          return [];
        }),
    );

    return equipos.filter(
      (equipo) =>
        equipo.id_equipo !== local.id_equipo &&
        !yaEnfrentados.has(equipo.nombre),
    );
  }

  const rivales = rivalesPosibles(formulario.id_equipo_local);
  const sinRivales =
    esNuevo && formulario.id_equipo_local && rivales.length === 0;
  const nombreDe = (idEquipo) =>
    equipos.find((equipo) => String(equipo.id_equipo) === String(idEquipo))
      ?.nombre;

  const nombreLocal = esNuevo
    ? nombreDe(formulario.id_equipo_local)
    : partido.equipo_local;
  const nombreVisitante = esNuevo
    ? nombreDe(formulario.id_equipo_visitante)
    : partido.equipo_visitante;
  const otrosPartidos = partidos.filter(
    (p) => p.estado !== "cancelado" && p.id_partido !== partido?.id_partido,
  );

  const ocupadosEnFecha = new Set(
    otrosPartidos
      .filter((p) => p.numero_fecha === Number(formulario.numero_fecha))
      .flatMap((p) => [p.equipo_local, p.equipo_visitante]),
  );
  const canchasOcupadas = new Set(
    otrosPartidos
      .filter((p) => p.estado !== "postergado")
      .filter(
        (p) =>
          p.dia === formulario.dia &&
          String(p.id_turno) === String(formulario.id_turno),
      )
      .map((p) => claveCancha(p.id_complejo, p.nombre_cancha)),
  );
  const ocupadosEnHorario = new Set(
    otrosPartidos
      .filter((p) => p.estado !== "postergado")
      .filter(
        (p) =>
          p.dia === formulario.dia &&
          String(p.id_turno) === String(formulario.id_turno),
      )
      .flatMap((p) => [p.equipo_local, p.equipo_visitante]),
  );
  const problemas = [];
  const cancelando = formulario.estado === "cancelado";

  [nombreLocal, nombreVisitante].forEach((nombre) => {
    if (!cancelando && nombre && ocupadosEnFecha.has(nombre)) {
      problemas.push(
        `${nombre} ya juega un partido en la fecha ${formulario.numero_fecha}.`,
      );
    }
  });

  const ocupaCancha =
    formulario.estado !== "cancelado" && formulario.estado !== "postergado";

  [nombreLocal, nombreVisitante].forEach((nombre) => {
    if (ocupaCancha && nombre && ocupadosEnHorario.has(nombre)) {
      problemas.push(`${nombre} ya tiene un partido ese día en ese turno.`);
    }
  });

  if (
    ocupaCancha &&
    formulario.cancha &&
    canchasOcupadas.has(formulario.cancha)
  ) {
    problemas.push("Esa cancha ya tiene un partido ese día en ese turno.");
  }

  const numeroFormulario = Number(formulario.numero_fecha);

  if (!cancelando && maxFecha > 0 && numeroFormulario > maxFecha) {
    problemas.push(
      `La edición tiene ${maxFecha} ${maxFecha === 1 ? "fecha" : "fechas"}: no existe la fecha ${numeroFormulario}.`,
    );
  }

  const seAtrasa = partido?.reprogramado || partido?.estado === "postergado";
  const fueraDeOrden = otrosPartidos
    .filter((p) => p.estado !== "postergado" && !p.reprogramado)
    .find(
      (p) =>
        (p.numero_fecha < numeroFormulario && p.dia > formulario.dia) ||
        (!seAtrasa &&
          p.numero_fecha > numeroFormulario &&
          p.dia < formulario.dia),
    );

  if (ocupaCancha && formulario.dia && fueraDeOrden) {
    problemas.push(
      `Las fechas van en orden: ese día choca con la fecha ${fueraDeOrden.numero_fecha}. Si el partido se atrasa, primero hay que postergarlo.`,
    );
  }

  // al editar, guardar solo se habilita si cambió algo respecto al partido original
  const sinCambios =
    !esNuevo &&
    Number(formulario.numero_fecha) === partido.numero_fecha &&
    formulario.dia === partido.dia &&
    Number(formulario.id_turno) === partido.id_turno &&
    formulario.cancha ===
      claveCancha(partido.id_complejo, partido.nombre_cancha) &&
    formulario.estado === partido.estado;

  // envía los datos para guardar
  function guardar(evento) {
    evento.preventDefault();
    if (problemas.length > 0 || sinCambios) return;

    const [idComplejo, ...resto] = formulario.cancha.split("|");

    onGuardar({
      numero_fecha: Number(formulario.numero_fecha),
      dia: formulario.dia,
      id_turno: Number(formulario.id_turno),
      id_complejo: Number(idComplejo),
      nombre_cancha: resto.join("|"),
      id_equipo_local: Number(formulario.id_equipo_local),
      id_equipo_visitante: Number(formulario.id_equipo_visitante),
      estado: formulario.estado,
    });
  }

  return (
    <section className="editar-partido">
      <div className="editar-partido-titulo">
        <h2>{esNuevo ? "Nuevo partido" : "Editar partido"}</h2>
      </div>

      <form onSubmit={guardar}>
        {esNuevo ? (
          <div className="editar-partido-campos">
            <div>
              <label htmlFor="equipo-local">Local</label>
              <select
                id="equipo-local"
                name="id_equipo_local"
                value={formulario.id_equipo_local}
                onChange={cambiarCampo}
                required
              >
                <option value="">Elegir</option>
                {equipos.map((equipo) => (
                  <option
                    key={equipo.id_equipo}
                    value={equipo.id_equipo}
                    disabled={ocupadosEnFecha.has(equipo.nombre)}
                  >
                    {equipo.nombre}
                    {ocupadosEnFecha.has(equipo.nombre) &&
                      " (ya juega esta fecha)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="equipo-visitante">Visitante</label>
              <select
                id="equipo-visitante"
                name="id_equipo_visitante"
                value={formulario.id_equipo_visitante}
                onChange={cambiarCampo}
                disabled={!formulario.id_equipo_local || sinRivales}
                required
              >
                <option value="">Elegir</option>
                {rivales.map((equipo) => (
                  <option
                    key={equipo.id_equipo}
                    value={equipo.id_equipo}
                    disabled={ocupadosEnFecha.has(equipo.nombre)}
                  >
                    {equipo.nombre}
                    {ocupadosEnFecha.has(equipo.nombre) &&
                      " (ya juega esta fecha)"}
                  </option>
                ))}
              </select>
            </div>
            {sinRivales && (
              <p className="editar-partido-aviso">
                {nombreLocal} ya enfrentó a todos los equipos de esta edición.
              </p>
            )}
          </div>
        ) : (
          <div className="editar-partido-equipos">
            <div className="editar-partido-equipo">
              <InsigniaEquipo
                id={partido.id_equipo_local}
                nombre={partido.equipo_local}
                tamano="sm"
              />
              <strong>{partido.equipo_local}</strong>
            </div>
            <span>vs</span>
            <div className="editar-partido-equipo visitante">
              <strong>{partido.equipo_visitante}</strong>
              <InsigniaEquipo
                id={partido.id_equipo_visitante}
                nombre={partido.equipo_visitante}
                tamano="sm"
              />
            </div>
          </div>
        )}

        <div className="editar-partido-campos">
          <div>
            <label htmlFor="numero-fecha">Fecha</label>
            <input
              id="numero-fecha"
              type="number"
              name="numero_fecha"
              min="1"
              max={maxFecha || 127}
              value={formulario.numero_fecha}
              onChange={cambiarCampo}
              required
            />
          </div>

          <div>
            <label htmlFor="dia">Día</label>
            <input
              id="dia"
              type="date"
              name="dia"
              min={diaMinimo}
              max={diaMaximo}
              value={formulario.dia}
              onChange={cambiarCampo}
              required
            />
          </div>

          <div>
            <label htmlFor="turno">Turno</label>
            <select
              id="turno"
              name="id_turno"
              value={formulario.id_turno}
              onChange={cambiarCampo}
              required
            >
              <option value="">Elegir</option>
              {turnos.map((turno) => (
                <option key={turno.id_turno} value={turno.id_turno}>
                  {turno.hora_inicio} a {turno.hora_fin}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cancha">Cancha</label>
            <select
              id="cancha"
              name="cancha"
              value={formulario.cancha}
              onChange={cambiarCampo}
              required
            >
              <option value="">Elegir</option>
              {canchas.map((cancha) => {
                const clave = claveCancha(
                  cancha.id_complejo,
                  cancha.nombre_cancha,
                );
                const ocupada = canchasOcupadas.has(clave);

                return (
                  <option key={clave} value={clave} disabled={ocupada}>
                    {cancha.complejo} - {cancha.nombre_cancha}
                    {ocupada && " (ocupada)"}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* El estado "jugado" lo pone la planilla, no se elige acá */}
        {!esNuevo && (
          <div className="editar-partido-estado">
            <label>Estado</label>

            <div className="editar-estado-opciones">
              {ESTADOS.map((estado) => (
                <button
                  key={estado.valor}
                  type="button"
                  className={
                    formulario.estado === estado.valor
                      ? `estado-seleccionado opcion-${estado.valor}`
                      : `opcion-${estado.valor}`
                  }
                  onClick={() => actualizar({ estado: estado.valor })}
                >
                  {estado.etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}

        {problemas.length > 0 && (
          <ul className="editar-partido-problemas">
            {problemas.map((problema) => (
              <li key={problema}>{problema}</li>
            ))}
          </ul>
        )}

        <div className="editar-partido-botones">
          <button
            type="submit"
            className="editar-guardar"
            disabled={problemas.length > 0 || sinCambios}
            title={sinCambios ? "No hay cambios para guardar" : undefined}
          >
            {esNuevo ? "Crear" : "Guardar"}
          </button>

          <button
            type="button"
            className="editar-cancelar"
            onClick={onCancelar}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

export default EditarPartido;
