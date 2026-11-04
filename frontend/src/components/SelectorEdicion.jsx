import { useEffect, useRef, useState } from 'react';
import './SelectorEdicion.css';
import { apiRequest } from '../services/api';

const ESTADOS = {
  inscripcion: 'Inscripción',
  'en curso': 'En curso',
  finalizado: 'Finalizado'
};

// El backend exige que el año coincida con el de la fecha de inicio,
// así que el año y el nombre se arman solos a partir de las fechas.
function nombreEdicion(anio, semestre) {
  return `Torneo Interfacultades ${anio} - ${semestre}º semestre`;
}

// Etiqueta "EDICIÓN" con un desplegable propio para cambiar de torneo
// y, si es administrador, crear una edición nueva.
function SelectorEdicion({
  torneos = [],
  torneoSeleccionado = '',
  cambiarTorneo,
  onEdicionCreada,
  className = ''
}) {
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ semestre: '1', fecha_inicio: '', fecha_fin: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const contenedor = useRef(null);

  const esAdmin = localStorage.getItem('rol') === 'administrador';

  const torneoActual = torneos.find(
    (t) => String(t.id_torneo) === String(torneoSeleccionado)
  );

  // Cierra el desplegable al hacer clic afuera
  useEffect(() => {
    if (!abierto) return;

    function clicAfuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) {
        cerrar();
      }
    }

    document.addEventListener('mousedown', clicAfuera);
    return () => document.removeEventListener('mousedown', clicAfuera);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setCreando(false);
    setError('');
  }

  function elegir(idTorneo) {
    cerrar();
    if (String(idTorneo) !== String(torneoSeleccionado)) {
      cambiarTorneo(String(idTorneo));
    }
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target;
    setNueva({ ...nueva, [name]: value });
    setError('');
  }

  const anioNueva = nueva.fecha_inicio ? Number(nueva.fecha_inicio.slice(0, 4)) : null;

  async function crearEdicion(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');

    try {
      const torneo = await apiRequest('/torneos', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombreEdicion(anioNueva, nueva.semestre),
          anio: anioNueva,
          semestre: Number(nueva.semestre),
          fecha_inicio: nueva.fecha_inicio,
          fecha_fin: nueva.fecha_fin
        })
      });

      setNueva({ semestre: '1', fecha_inicio: '', fecha_fin: '' });
      cerrar();

      if (onEdicionCreada) onEdicionCreada(torneo);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={`selector-edicion ${className}`} ref={contenedor}>
      <span className="selector-edicion-etiqueta">EDICIÓN</span>

      <button
        type="button"
        className="selector-edicion-boton"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-expanded={abierto}
      >
        {torneoActual?.nombre || 'Seleccioná un torneo'}
        <span className="selector-edicion-flecha">▾</span>
      </button>

      {abierto && (
        <div className="selector-edicion-menu">
          {!creando && (
            <>
              {torneos.length === 0 && (
                <p className="selector-edicion-vacio">Todavía no hay ediciones.</p>
              )}

              {torneos.map((torneo) => {
                const actual = String(torneo.id_torneo) === String(torneoSeleccionado);

                return (
                  <button
                    key={torneo.id_torneo}
                    type="button"
                    className={actual ? 'selector-edicion-opcion actual' : 'selector-edicion-opcion'}
                    onClick={() => elegir(torneo.id_torneo)}
                  >
                    <span className="selector-edicion-check">{actual ? '✓' : ''}</span>
                    <span className="selector-edicion-nombre">{torneo.nombre}</span>
                    <span className={`selector-edicion-estado estado-torneo-${torneo.estado.replace(' ', '-')}`}>
                      {ESTADOS[torneo.estado] || torneo.estado}
                    </span>
                  </button>
                );
              })}

              {esAdmin && (
                <button
                  type="button"
                  className="selector-edicion-nueva"
                  onClick={() => setCreando(true)}
                >
                  + Nueva edición
                </button>
              )}
            </>
          )}

          {creando && (
            <form className="selector-edicion-form" onSubmit={crearEdicion}>
              <strong className="selector-edicion-titulo">Nueva edición</strong>

              <div className="selector-edicion-campos">
                <div>
                  <label htmlFor="edicion-semestre">Semestre</label>
                  <select
                    id="edicion-semestre"
                    name="semestre"
                    value={nueva.semestre}
                    onChange={cambiarCampo}
                  >
                    <option value="1">1º semestre</option>
                    <option value="2">2º semestre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edicion-inicio">Inicio</label>
                  <input
                    id="edicion-inicio"
                    type="date"
                    name="fecha_inicio"
                    value={nueva.fecha_inicio}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edicion-fin">Fin</label>
                  <input
                    id="edicion-fin"
                    type="date"
                    name="fecha_fin"
                    min={nueva.fecha_inicio || undefined}
                    value={nueva.fecha_fin}
                    onChange={cambiarCampo}
                    required
                  />
                </div>
              </div>

              {anioNueva && (
                <p className="selector-edicion-preview">
                  Se creará: <strong>{nombreEdicion(anioNueva, nueva.semestre)}</strong>
                </p>
              )}

              {error && <p className="selector-edicion-error">{error}</p>}

              <div className="selector-edicion-acciones">
                <button type="submit" className="selector-edicion-crear" disabled={guardando}>
                  {guardando ? 'Creando…' : 'Crear'}
                </button>
                <button type="button" onClick={() => { setCreando(false); setError(''); }}>
                  Volver
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default SelectorEdicion;
