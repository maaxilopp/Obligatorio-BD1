
import { useState } from 'react';
import './EditarPartido.css';

function EditarPartido({
  partido,
  turnos = [],
  complejos = [],
  onGuardar,
  onCancelar
}) {

  const [formulario, setFormulario] = useState({
    numero_fecha: partido.numero_fecha,
    dia: partido.dia,
    id_turno: partido.id_turno,
    id_complejo: partido.id_complejo,
    nombre_cancha: partido.nombre_cancha,
    estado: partido.estado
  });

  // Actualiza el campo que modifica el usuario
  function cambiarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario({
      ...formulario,
      [name]: value
    });
  }

  // Envía los datos para guardar
  function guardar(evento) {
    evento.preventDefault();

    onGuardar({
      ...formulario,
      numero_fecha: Number(formulario.numero_fecha),
      id_turno: Number(formulario.id_turno),
      id_complejo: Number(formulario.id_complejo)
    });
  }

  return (
    <section className="editar-partido">

      <div className="editar-partido-titulo">
        <h2>Editar partido</h2>
      </div>

      <form onSubmit={guardar}>

        <div className="editar-partido-equipos">
          <strong>{partido.equipo_local}</strong>
          <span>VS</span>
          <strong>{partido.equipo_visitante}</strong>
        </div>

        <div className="editar-partido-campos">

          <div>
            <label>Fecha</label>
            <input
              type="number"
              name="numero_fecha"
              min="1"
              value={formulario.numero_fecha}
              onChange={cambiarCampo}
              required
            />
          </div>

          <div>
            <label>Día</label>
            <input
              type="date"
              name="dia"
              value={formulario.dia}
              onChange={cambiarCampo}
              required
            />
          </div>

          <div>
            <label>Turno</label>
            <select
              name="id_turno"
              value={formulario.id_turno}
              onChange={cambiarCampo}
              required
            >
              {turnos.map((turno) => (
                <option
                  key={turno.id_turno}
                  value={turno.id_turno}
                >
                  {turno.hora_inicio} - {turno.hora_fin}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Complejo</label>
            <select
              name="id_complejo"
              value={formulario.id_complejo}
              onChange={cambiarCampo}
              required
            >
              {complejos.map((complejo) => (
                <option
                  key={complejo.id_complejo}
                  value={complejo.id_complejo}
                >
                  {complejo.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="campo-completo">
            <label>Cancha</label>
            <input
              type="text"
              name="nombre_cancha"
              value={formulario.nombre_cancha}
              onChange={cambiarCampo}
              required
            />
          </div>

        </div>

        <div className="editar-partido-estado">
          <label>Estado</label>

          <div className="editar-estado-opciones">

            <button
              type="button"
              className={
                formulario.estado === 'programado'
                  ? 'estado-seleccionado'
                  : ''
              }
              onClick={() =>
                setFormulario({
                  ...formulario,
                  estado: 'programado'
                })
              }
            >
              Programado
            </button>

            <button
              type="button"
              className={
                formulario.estado === 'postergado'
                  ? 'estado-seleccionado'
                  : ''
              }
              onClick={() =>
                setFormulario({
                  ...formulario,
                  estado: 'postergado'
                })
              }
            >
              Postergado
            </button>

            <button
              type="button"
              className={
                formulario.estado === 'cancelado'
                  ? 'estado-seleccionado'
                  : ''
              }
              onClick={() =>
                setFormulario({
                  ...formulario,
                  estado: 'cancelado'
                })
              }
            >
              Cancelado
            </button>

          </div>
        </div>

        <div className="editar-partido-botones">
          <button type="submit" className="editar-guardar">
            Guardar
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
