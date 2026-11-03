import './Navbar.css';

// etiqueta que se muestra -> sección de App
const secciones = [
  { etiqueta: 'Posiciones', seccion: 'Posiciones' },
  { etiqueta: 'Fixture', seccion: 'Partidos' },
  { etiqueta: 'Planillas', seccion: 'Planillas' },
  { etiqueta: 'Sanciones', seccion: 'Sanciones' },
  { etiqueta: 'Reportes', seccion: 'Reportes' },
];

const catalogos = ['Facultades', 'Jugadores', 'Equipos', 'Torneos', 'Complejos'];

function LogoPelota() {
  return (
    <svg className="navbar-pelota" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <clipPath id="pelota-borde">
          <circle cx="20" cy="20" r="17" />
        </clipPath>
      </defs>
      <g clipPath="url(#pelota-borde)">
        <rect width="40" height="40" fill="#ffffff" />
        {[0, 1, 2, 3, 4].map((fila) =>
          [0, 1, 2, 3, 4].map((columna) =>
            (fila + columna) % 2 === 0 ? (
              <rect
                key={`${fila}-${columna}`}
                x={3 + columna * 6.8}
                y={3 + fila * 6.8}
                width="6.8"
                height="6.8"
                fill="#191720"
              />
            ) : null
          )
        )}
      </g>
      <circle cx="20" cy="20" r="17" fill="none" stroke="#191720" strokeWidth="3" />
    </svg>
  );
}

function Navbar({ seccionActual, cambiarSeccion, rol = 'Administrador', correo, cerrarSesion }) {
  const enCatalogos = catalogos.includes(seccionActual);

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <LogoPelota />
        <span>
          Torneo
          <br />
          Interfacultades
        </span>
      </div>

      <nav className="navbar-menu">
        {secciones.map((item) => (
          <button
            key={item.etiqueta}
            type="button"
            className={seccionActual === item.seccion ? 'nav-activo' : ''}
            onClick={() => cambiarSeccion(item.seccion)}
          >
            {item.etiqueta}
          </button>
        ))}

        <details className="navbar-catalogos">
          <summary className={enCatalogos ? 'nav-activo' : ''}>Catálogos</summary>

          <div className="navbar-catalogos-menu">
            {catalogos.map((seccion) => (
              <button
                key={seccion}
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details').open = false;
                  cambiarSeccion(seccion);
                }}
              >
                {seccion}
              </button>
            ))}
          </div>
        </details>
      </nav>

      <div className="navbar-usuario">
        <div className="navbar-usuario-datos">
          <strong>{rol}</strong>
          {correo && <span>{correo}</span>}
        </div>

        <button
          type="button"
          className="navbar-salir"
          onClick={cerrarSesion}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M13 4h3v12h-3M10 6l-4 4 4 4M6 10h8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Navbar;
