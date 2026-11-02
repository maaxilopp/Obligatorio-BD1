
import './Navbar.css';

const secciones = [
  'Posiciones',
  'Partidos',
  'Planillas',
  'Equipos',
  'Sanciones',
  'Reportes'
];

const seccionesAdmin = [
  'Facultades',
  'Jugadores',
  'Torneos',
  'Complejos'
];

function Navbar({ seccionActual, cambiarSeccion, rol = 'Admin' }) {
  return (
    <header className="navbar">
      <div className="navbar-logo">
        <span className="pelota">⚽</span>
        <span>
          Torneo
          <br />
          Interfacultades
        </span>
      </div>

      <nav className="navbar-menu">
        {secciones.map((seccion) => (
          <button
            key={seccion}
            type="button"
            className={
              seccionActual === seccion ? 'nav-activo' : ''
            }
            onClick={() => cambiarSeccion(seccion)}
          >
            {seccion}
          </button>
        ))}
      </nav>

      
<div className="navbar-admin">
  <details>
    <summary className="navbar-usuario">
      <span className="indicador-rol" />
      {rol}
    </summary>

    <div className="navbar-admin-menu">
      {seccionesAdmin.map((seccion) => (
        <button
          key={seccion}
          type="button"
          onClick={() => cambiarSeccion(seccion)}
        >
          {seccion}
        </button>
      ))}
    </div>
  </details>
</div>

    </header>
  );
}

export default Navbar;
