
import { useState } from 'react';
import { apiRequest, login } from './services/api';
import './App.css';

const SECCIONES = [
  { nombre: 'Facultades', ruta: '/facultades' },
  { nombre: 'Jugadores', ruta: '/jugadores' },
  { nombre: 'Equipos', ruta: '/equipos' },
  { nombre: 'Torneos', ruta: '/torneos' },
  { nombre: 'Complejos', ruta: '/complejos' },
  { nombre: 'Partidos' },
  { nombre: 'Planillas' },
  { nombre: 'Sanciones', ruta: '/sanciones' },
  { nombre: 'Reportes' },
];

const REPORTES = [
  { nombre: 'Posiciones', ruta: 'posiciones' },
  { nombre: 'Goleadores', ruta: 'goleadores' },
  { nombre: 'Fair play', ruta: 'fair-play' },
  { nombre: 'Promedio de goles', ruta: 'promedio-goles' },
  { nombre: 'Canchas', ruta: 'canchas' },
  { nombre: 'Turnos', ruta: 'turnos' },
  { nombre: 'Jugadores sin planilla', ruta: 'jugadores-sin-planilla' },
  { nombre: 'Sanciones', ruta: 'sanciones' },
  { nombre: 'Estado de partidos', ruta: 'estado-partidos' },
  { nombre: 'Remontadas', ruta: 'remontadas' },
  { nombre: 'Franjas de goles', ruta: 'franjas-goles' },
  { nombre: 'Rachas', ruta: 'rachas' },
  {
    nombre: 'Jugadores por facultad',
    ruta: 'jugadores-facultad',
    global: true,
  },
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');

  const [seccion, setSeccion] = useState(SECCIONES[0]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [torneos, setTorneos] = useState([]);
  const [torneoSeleccionado, setTorneoSeleccionado] = useState('');
  const [partidos, setPartidos] = useState([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');

  const [reporteSeleccionado, setReporteSeleccionado] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setError('');

    try {
      await login(correo, contrasena);
      setToken(localStorage.getItem('token'));
    } catch (err) {
      setError(err.message);
    }
  }

  async function cargarSeccion(item) {
    setSeccion(item);
    setDatos(null);
    setError('');
    setTorneoSeleccionado('');
    setPartidoSeleccionado('');
    setPartidos([]);
    setReporteSeleccionado('');

    if (
      item.nombre === 'Partidos' ||
      item.nombre === 'Planillas' ||
      item.nombre === 'Reportes'
    ) {
      setCargando(true);

      try {
        const resultado = await apiRequest('/torneos');
        setTorneos(Array.isArray(resultado) ? resultado : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }

      return;
    }

    setCargando(true);

    try {
      const resultado = await apiRequest(item.ruta);
      setDatos(resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPartidos(idTorneo) {
    setTorneoSeleccionado(idTorneo);
    setPartidoSeleccionado('');
    setDatos(null);
    setPartidos([]);
    setError('');

    if (!idTorneo) return;

    setCargando(true);

    try {
      const resultado = await apiRequest(
        `/partidos?id_torneo=${idTorneo}`
      );
      setPartidos(Array.isArray(resultado) ? resultado : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function seleccionarPartido(idPartido) {
    setPartidoSeleccionado(idPartido);
    setDatos(null);
    setError('');

    if (!idPartido) return;

    setCargando(true);

    try {
      if (seccion.nombre === 'Partidos') {
        const resultado = await apiRequest(
          `/partidos/${idPartido}/administracion`
        );

        setDatos(resultado);
      }

      if (seccion.nombre === 'Planillas') {
        const [plantel, planilla, goles, tarjetas] = await Promise.all([
          apiRequest(`/partidos/${idPartido}/plantel`),
          apiRequest(`/partidos/${idPartido}/planilla`),
          apiRequest(`/partidos/${idPartido}/goles`),
          apiRequest(`/partidos/${idPartido}/tarjetas`),
        ]);

        setDatos({
          plantel,
          planilla,
          goles,
          tarjetas,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarReporte(nombreReporte) {
    setReporteSeleccionado(nombreReporte);
    setDatos(null);
    setError('');

    const reporte = REPORTES.find(
      (item) => item.ruta === nombreReporte
    );

    if (!reporte) return;

    let ruta;

    if (reporte.global) {
      ruta = '/reportes/jugadores-facultad';
    } else {
      if (!torneoSeleccionado) {
        setError('Seleccioná un torneo primero.');
        return;
      }

      ruta = `/torneos/${torneoSeleccionado}/${reporte.ruta}`;
    }

    setCargando(true);

    try {
      const resultado = await apiRequest(ruta);
      setDatos(resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('token');
    setToken(null);
    setDatos(null);
  }

  if (!token) {
    return (
      <main className="login-container">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>Torneo Interfacultades</h1>
          <p>Fútbol 5 · UCU</p>

          <label htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            type="email"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            required
          />

          <label htmlFor="contrasena">Contraseña</label>
          <input
            id="contrasena"
            type="password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit">Iniciar sesión</button>
        </form>
      </main>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Torneo UCU</h2>

        <nav>
          {SECCIONES.map((item) => (
            <button
              key={item.nombre}
              className={seccion.nombre === item.nombre ? 'active' : ''}
              onClick={() => cargarSeccion(item)}
            >
              {item.nombre}
            </button>
          ))}
        </nav>

        <button className="logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </aside>

      <main className="content">
        <header>
          <h1>{seccion.nombre}</h1>
          <span>Panel de administración</span>
        </header>

        {(seccion.nombre === 'Partidos' ||
          seccion.nombre === 'Planillas' ||
          seccion.nombre === 'Reportes') && (
          <section>
            <label htmlFor="torneo">Seleccionar torneo</label>

            <select
              id="torneo"
              value={torneoSeleccionado}
              onChange={(event) => cargarPartidos(event.target.value)}
            >
              <option value="">Seleccioná un torneo</option>

              {torneos.map((torneo) => (
                <option
                  key={torneo.id_torneo}
                  value={torneo.id_torneo}
                >
                  {torneo.nombre} - {torneo.anio}
                </option>
              ))}
            </select>
          </section>
        )}

        {seccion.nombre === 'Partidos' &&
          torneoSeleccionado && (
            <section>
              <h2>Partidos del torneo</h2>

              <label htmlFor="partido">Seleccionar partido</label>

              <select
                id="partido"
                value={partidoSeleccionado}
                onChange={(event) =>
                  seleccionarPartido(event.target.value)
                }
              >
                <option value="">Seleccioná un partido</option>

                {partidos.map((partido) => (
                  <option
                    key={partido.id_partido}
                    value={partido.id_partido}
                  >
                    Fecha {partido.numero_fecha}: {partido.equipo_local}
                    {' vs '}
                    {partido.equipo_visitante}
                  </option>
                ))}
              </select>
            </section>
          )}

        {seccion.nombre === 'Planillas' &&
          torneoSeleccionado && (
            <section>
              <h2>Planillas de partidos</h2>

              <label htmlFor="partido">Seleccionar partido</label>

              <select
                id="partido"
                value={partidoSeleccionado}
                onChange={(event) =>
                  seleccionarPartido(event.target.value)
                }
              >
                <option value="">Seleccioná un partido</option>

                {partidos.map((partido) => (
                  <option
                    key={partido.id_partido}
                    value={partido.id_partido}
                  >
                    Fecha {partido.numero_fecha}: {partido.equipo_local}
                    {' vs '}
                    {partido.equipo_visitante}
                  </option>
                ))}
              </select>
            </section>
          )}

        {seccion.nombre === 'Reportes' && (
          <section>
            <label htmlFor="reporte">Tipo de reporte</label>

            <select
              id="reporte"
              value={reporteSeleccionado}
              onChange={(event) => cargarReporte(event.target.value)}
            >
              <option value="">Seleccioná un reporte</option>

              {REPORTES.map((reporte) => (
                <option key={reporte.ruta} value={reporte.ruta}>
                  {reporte.nombre}
                </option>
              ))}
            </select>
          </section>
        )}

        {cargando && <p>Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {seccion.nombre === 'Partidos' &&
          datos !== null && (
            <section>
              <h2>Administración del partido</h2>
              <pre className="resultado">
                {JSON.stringify(datos, null, 2)}
              </pre>
            </section>
          )}

        {seccion.nombre === 'Planillas' &&
          datos !== null && (
            <section>
              <h2>Plantel disponible</h2>
              <pre className="resultado">
                {JSON.stringify(datos.plantel, null, 2)}
              </pre>

              <h2>Jugadores en planilla</h2>
              <pre className="resultado">
                {JSON.stringify(datos.planilla, null, 2)}
              </pre>

              <h2>Goles</h2>
              <pre className="resultado">
                {JSON.stringify(datos.goles, null, 2)}
              </pre>

              <h2>Tarjetas</h2>
              <pre className="resultado">
                {JSON.stringify(datos.tarjetas, null, 2)}
              </pre>
            </section>
          )}

        {seccion.nombre !== 'Partidos' &&
          seccion.nombre !== 'Planillas' &&
          datos !== null && (
            <pre className="resultado">
              {JSON.stringify(datos, null, 2)}
            </pre>
          )}

        {datos === null && !cargando && !error && (
          <p>
            {seccion.nombre === 'Partidos' ||
            seccion.nombre === 'Planillas' ||
            seccion.nombre === 'Reportes'
              ? 'Seleccioná un torneo para comenzar.'
              : 'Seleccioná una sección para consultar sus datos.'}
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
