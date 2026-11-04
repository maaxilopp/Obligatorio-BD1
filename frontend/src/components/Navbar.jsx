import "./Navbar.css";
import { catalogos, puedeVer } from "./secciones";

const secciones = [
  { etiqueta: "Posiciones", seccion: "Posiciones" },
  { etiqueta: "Fixture", seccion: "Partidos" },
  { etiqueta: "Planillas", seccion: "Planillas" },
  { etiqueta: "Sanciones", seccion: "Sanciones" },
  { etiqueta: "Reportes", seccion: "Reportes" },
];

export function LogoPelota({ className = "navbar-pelota" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
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
            ) : null,
          ),
        )}
      </g>
      <circle
        cx="20"
        cy="20"
        r="17"
        fill="none"
        stroke="#191720"
        strokeWidth="3"
      />
    </svg>
  );
}

function Navbar({
  seccionActual,
  cambiarSeccion,
  rol = "Administrador",
  correo,
  cerrarSesion,
}) {
  const enCatalogos = catalogos.includes(seccionActual);

  // Solo se muestran las secciones que el rol puede usar
  const rolSesion = rol === "Planillero" ? "planillero" : "administrador";
  const visibles = secciones.filter((item) =>
    puedeVer(rolSesion, item.seccion),
  );
  const verCatalogos = rolSesion === "administrador";

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
        {visibles.map((item) => (
          <button
            key={item.etiqueta}
            type="button"
            className={seccionActual === item.seccion ? "nav-activo" : ""}
            onClick={() => cambiarSeccion(item.seccion)}
          >
            {item.etiqueta}
          </button>
        ))}

        {verCatalogos && (
          <button
            type="button"
            className={enCatalogos ? "nav-activo" : ""}
            onClick={() => cambiarSeccion(catalogos[0])}
          >
            Catálogos
          </button>
        )}
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
export function CatalogosNav({ seccionActual, cambiarSeccion }) {
  return (
    <nav className="catalogos-nav">
      <span className="catalogos-nav-titulo">Catálogos</span>

      {catalogos.map((seccion) => (
        <button
          key={seccion}
          type="button"
          className={seccionActual === seccion ? "catalogo-activo" : ""}
          onClick={() => cambiarSeccion(seccion)}
        >
          {seccion}
        </button>
      ))}
    </nav>
  );
}

export default Navbar;
