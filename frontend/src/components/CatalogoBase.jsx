// Piezas compartidas por los catálogos (Facultades, Torneos, Complejos,
// Equipos y Sanciones). 

import "./Jugadores.css";
import "./Catalogo.css";

export function IconoLapiz() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 13l1-4 7-7 3 3-7 7-4 1zM9.5 3.5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function IconoTacho() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5M7 6.5v5M9 6.5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IconoCandado() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Estructura de la página: encabezado, mensajes, tabla y panel lateral
export function Catalogo({
  titulo,
  textoNuevo,
  onNuevo,
  exito,
  error,
  filtros,
  panel,
  children,
}) {
  return (
    <section className="jugadores-pagina">
      <div className="jugadores-encabezado">
        <div>
          <p className="jugadores-etiqueta">CATÁLOGO DE: </p>
          <h1>{titulo}</h1>
        </div>

        {onNuevo && (
          <button
            type="button"
            className="jugadores-boton-nuevo"
            onClick={onNuevo}
          >
            {textoNuevo}
          </button>
        )}
      </div>

      {error && !panel && <p className="jugadores-error">{error}</p>}
      {exito && <p className="jugadores-exito">✓ {exito}</p>}

      <div
        className={panel ? "jugadores-cuerpo con-panel" : "jugadores-cuerpo"}
      >
        <div className="jugadores-tarjeta">
          {filtros && <div className="jugadores-filtros">{filtros}</div>}
          <div className="jugadores-tabla-contenedor">{children}</div>
        </div>

        {panel}
      </div>
    </section>
  );
}

export function Buscador({ valor, onChange, placeholder, etiqueta }) {
  return (
    <label className="jugadores-buscador">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle
          cx="7"
          cy="7"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        aria-label={etiqueta}
      />
    </label>
  );
}

// opciones: [{ valor, etiqueta, cantidad }]
export function Chips({ opciones, valor, onChange }) {
  return (
    <div className="jugadores-chips">
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className={valor === opcion.valor ? "activo" : ""}
          onClick={() => onChange(opcion.valor)}
        >
          {opcion.etiqueta} <span>{opcion.cantidad}</span>
        </button>
      ))}
    </div>
  );
}

// Fila de la tabla para "Cargando…" y "No hay datos"
export function FilaVacia({ columnas, cargando, hayDatos, texto }) {
  if (cargando) {
    return (
      <tr>
        <td colSpan={columnas} className="jugadores-vacio">
          Cargando…
        </td>
      </tr>
    );
  }
  if (!hayDatos) {
    return (
      <tr>
        <td colSpan={columnas} className="jugadores-vacio">
          {texto}
        </td>
      </tr>
    );
  }
  return null;
}

export function Acciones({ onEditar, onBorrar, nombre, extra }) {
  return (
    <div className="jugador-acciones">
      {extra}
      {onEditar && (
        <button
          type="button"
          title={`Editar ${nombre}`}
          aria-label={`Editar ${nombre}`}
          onClick={onEditar}
        >
          <IconoLapiz />
        </button>
      )}
      {onBorrar && (
        <button
          type="button"
          className="borrar"
          title={`Eliminar ${nombre}`}
          aria-label={`Eliminar ${nombre}`}
          onClick={onBorrar}
        >
          <IconoTacho />
        </button>
      )}
    </div>
  );
}

export function PanelLateral({ titulo, children, className = "" }) {
  return (
    <aside className={`jugador-panel ${className}`}>
      <div className="jugador-panel-titulo">
        <h2>{titulo}</h2>
      </div>
      {children}
    </aside>
  );
}

export function Campo({ id, etiqueta, children }) {
  return (
    <div className="jugador-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}

export function Problemas({ errores, mostrar }) {
  if (!mostrar || errores.length === 0) return null;
  return (
    <ul className="jugador-problemas">
      {errores.map((problema) => (
        <li key={problema}>{problema}</li>
      ))}
    </ul>
  );
}

export function BotonesPanel({ textoGuardar, sinCambios, onCancelar }) {
  return (
    <div className="jugador-botones">
      <button
        type="submit"
        className="guardar"
        disabled={sinCambios}
        title={sinCambios ? "No hay cambios para guardar" : undefined}
      >
        {textoGuardar}
      </button>
      <button type="button" className="cancelar" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  );
}
