
import { useEffect, useState } from 'react';
import { apiRequest, login } from './services/api';
import './App.css';
import './components/Login.css';
import Navbar, { CatalogosNav, LogoPelota } from './components/Navbar';
import { catalogos, puedeVer } from './components/secciones';
import TablaPosiciones from './components/TablaPosiciones';
import Fixture from './components/Fixture';
import Jugadores from './components/Jugadores';
import CatalogoEquipos from './components/CatalogoEquipos';
import Torneos from './components/Torneos';
import Complejos from './components/Complejos';
import Facultades from './components/Facultades';
import Sanciones from './components/Sanciones';
import Reportes from './components/Reportes';

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


const CATALOGOS_PROPIOS = [
  'Jugadores',
  'Equipos',
  'Torneos',
  'Complejos',
  'Facultades',
  'Sanciones',
];

const PANTALLAS_PROPIAS = ['Posiciones', 'Partidos', 'Reportes', ...CATALOGOS_PROPIOS];


function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');

  // Al entrar se muestra la tabla de posiciones
  const [seccion, setSeccion] = useState({ nombre: 'Posiciones' });
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [torneos, setTorneos] = useState([]);
  const [torneoSeleccionado, setTorneoSeleccionado] = useState('');
  const [partidos, setPartidos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [complejos, setComplejos] = useState([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setError('');

    try {
      const sesion = await login(correo, contrasena);
      localStorage.setItem('correo', sesion.correo || correo);
      localStorage.setItem('rol', sesion.rol || '');
      setToken(localStorage.getItem('token'));
      abrirPantallaInicial();
    } catch (err) {
      setError(err.message);
    }
  }

  

  async function cargarPosiciones(idTorneoElegido) {
    setSeccion({ nombre: 'Posiciones' });
    setDatos(null);
    setError('');
    setCargando(true);

    try {
      const torneosDisponibles = await apiRequest('/torneos');
      setTorneos(Array.isArray(torneosDisponibles) ? torneosDisponibles : []);

      if (!torneosDisponibles || torneosDisponibles.length === 0) {
        setError('No hay torneos disponibles.');
        return;
      }

      // Por defecto se muestra el primer torneo
      const idTorneo = idTorneoElegido || torneosDisponibles[0].id_torneo;
      setTorneoSeleccionado(String(idTorneo));

      const [resultado, rachas, partidosTorneo, goleadores, turnos, complejos, sanciones] =
        await Promise.all([
          apiRequest(`/torneos/${idTorneo}/posiciones`),
          apiRequest(`/torneos/${idTorneo}/rachas`),
          apiRequest(`/partidos?id_torneo=${idTorneo}`),
          apiRequest(`/torneos/${idTorneo}/goleadores`),
          apiRequest('/turnos'),
          apiRequest('/complejos'),
          apiRequest(`/sanciones?id_torneo=${idTorneo}`),
        ]);

      setDatos({
        posiciones: resultado.posiciones,
        rachas,
        partidos: partidosTorneo,
        goleadores,
        turnos,
        complejos,
        sanciones,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  // Agrega la edición recién creada a la lista y la deja seleccionada
  function edicionCreada(torneo) {
    setTorneos((anteriores) => [...anteriores, torneo]);

    if (seccion.nombre === 'Posiciones') {
      cargarPosiciones(torneo.id_torneo);
    } else if (seccion.nombre === 'Reportes') {
      setTorneoSeleccionado(String(torneo.id_torneo));
    } else {
      cargarPartidos(String(torneo.id_torneo));
    }
  }

  // Si ya había una sesión abierta, la pantalla inicial también es posiciones
  // El administrador arranca en posiciones; el planillero no puede verlas,
  // así que arranca en el fixture
  function abrirPantallaInicial() {
    if (localStorage.getItem('rol') === 'administrador') {
      cargarPosiciones();
    } else {
      cambiarSeccionNavbar('Partidos');
    }
  }

  useEffect(() => {
    if (localStorage.getItem('token')) {
      abrirPantallaInicial();
    }
    // Solo al abrir la página, si ya había una sesión iniciada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarSeccionNavbar(nombre) {
    if (!puedeVer(localStorage.getItem('rol'), nombre)) return;

    if (nombre === 'Posiciones') {
      cargarPosiciones();
      return;
    }

    const item = SECCIONES.find((seccion) => seccion.nombre === nombre);

    if (item) {
      cargarSeccion(item);
    }
  }

  async function cargarSeccion(item) {
    setSeccion(item);
    setDatos(null);
    setError('');
    setTorneoSeleccionado('');
    setPartidoSeleccionado('');
    setPartidos([]);

    // Los catálogos cargan sus propios datos
    if (CATALOGOS_PROPIOS.includes(item.nombre)) return;

    if (
      item.nombre === 'Partidos' ||
      item.nombre === 'Planillas' ||
      item.nombre === 'Reportes'
    ) {
      setCargando(true);

      try {
        const resultado = await apiRequest('/torneos');
        const lista = Array.isArray(resultado) ? resultado : [];
        setTorneos(lista);

        // El fixture abre directamente con el primer torneo
        if (item.nombre === 'Partidos' && lista.length > 0) {
          await cargarPartidos(String(lista[0].id_torneo));
        }

        // Los reportes también abren con el primer torneo
        if (item.nombre === 'Reportes') {
          if (lista.length > 0) {
            setTorneoSeleccionado(String(lista[0].id_torneo));
          } else {
            setError('No hay torneos disponibles.');
          }
        }
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
      
const [resultado, datosTurnos, datosComplejos] =
  await Promise.all([
    apiRequest(`/partidos?id_torneo=${idTorneo}`),
    apiRequest('/turnos'),
    apiRequest('/complejos')
  ]);

setPartidos(Array.isArray(resultado) ? resultado : []);
setTurnos(Array.isArray(datosTurnos) ? datosTurnos : []);
setComplejos(
  Array.isArray(datosComplejos) ? datosComplejos : []
);

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

  function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('correo');
    localStorage.removeItem('rol');
    setToken(null);
    setDatos(null);
  }


if (!token) {
  return (
    <main className="login-container">
      <section className="login-cancha">
        <div className="login-lineas" aria-hidden="true">
          <span className="login-circulo" />
        </div>

        <div className="login-brand">
          <LogoPelota className="login-brand-logo" />

          <div className="login-brand-text">
            <span>Torneo Interfacultades</span>
            <span>Universidad Católica del Uruguay</span>
          </div>
        </div>

        <h2 className="login-frase">
          ¡El fútbol es
          <br />
          mucho más que
          <br />
          un deporte!
        </h2>
      </section>

      <section className="login-derecha">
        <div className="login-credencial">
          <span className="login-cinta" aria-hidden="true" />
          <span className="login-clip" aria-hidden="true" />

          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-card-encabezado">
              <span className="login-ranura" aria-hidden="true" />
              <h1>Ingrese sus datos:</h1>
            </div>

            <div className="login-form-body">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                maxLength={100}
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                required
              />

              <label htmlFor="contrasena">Contraseña</label>
              <input
                id="contrasena"
                type="password"
                autoComplete="current-password"
                maxLength={100}
                value={contrasena}
                onChange={(event) => setContrasena(event.target.value)}
                required
              />

              {error && <p className="error">{error}</p>}

              <button type="submit">Ingresar</button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}


  return (
    <div className="app">
      
      <Navbar
        seccionActual={seccion.nombre}
        cambiarSeccion={cambiarSeccionNavbar}
        rol={localStorage.getItem('rol') === 'planillero' ? 'Planillero' : 'Administrador'}
        correo={localStorage.getItem('correo')}
        cerrarSesion={cerrarSesion}
      />

      {catalogos.includes(seccion.nombre) && (
        <CatalogosNav
          seccionActual={seccion.nombre}
          cambiarSeccion={cambiarSeccionNavbar}
        />
      )}

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

      <main
        className={
          seccion.nombre === 'Posiciones' ? 'content content-posiciones' : 'content'
        }
      >
        <header>
{!PANTALLAS_PROPIAS.includes(seccion.nombre) && (
    <h1>{seccion.nombre}</h1>
  )}

{!PANTALLAS_PROPIAS.includes(seccion.nombre) && (
    <span>Panel de administración</span>
  )}
        </header>

        {seccion.nombre === 'Planillas' && (
          <section>

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

        {seccion.nombre === 'Posiciones' &&
          datos !== null &&
          !Array.isArray(datos) && (
            <TablaPosiciones
              {...datos}
              torneos={torneos}
              torneoSeleccionado={torneoSeleccionado}
              cambiarTorneo={(idTorneo) => cargarPosiciones(idTorneo)}
              onEdicionCreada={edicionCreada}
              irA={cambiarSeccionNavbar}
            />
          )}


        {seccion.nombre === 'Partidos' &&
          torneoSeleccionado && (
            <Fixture
              key={torneoSeleccionado}
              partidos={partidos}
              turnos={turnos}
              complejos={complejos}
              torneos={torneos}
              torneoSeleccionado={torneoSeleccionado}
              cambiarTorneo={cargarPartidos}
              onEdicionCreada={edicionCreada}
              onPartidosActualizados={() => cargarPartidos(torneoSeleccionado)}
            />
          )}


        {seccion.nombre === 'Jugadores' && <Jugadores />}
        {seccion.nombre === 'Equipos' && <CatalogoEquipos />}
        {seccion.nombre === 'Torneos' && <Torneos />}
        {seccion.nombre === 'Complejos' && <Complejos />}
        {seccion.nombre === 'Facultades' && <Facultades />}
        {seccion.nombre === 'Sanciones' && <Sanciones />}

        {seccion.nombre === 'Reportes' &&
          torneoSeleccionado && (
            <Reportes
              key={torneoSeleccionado}
              torneos={torneos}
              torneoSeleccionado={torneoSeleccionado}
              cambiarTorneo={setTorneoSeleccionado}
              onEdicionCreada={edicionCreada}
            />
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

        {!PANTALLAS_PROPIAS.includes(seccion.nombre) &&
          seccion.nombre !== 'Planillas' &&
          datos !== null && (
            <pre className="resultado">
              {JSON.stringify(datos, null, 2)}
            </pre>
          )}

        {datos === null && !cargando && !error && !PANTALLAS_PROPIAS.includes(seccion.nombre) && (
          <p>
            {seccion.nombre === 'Planillas'
              ? 'Seleccioná un torneo para comenzar.'
              : 'Seleccioná una sección para consultar sus datos.'}
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
