export const catalogos = [
  "Jugadores",
  "Equipos",
  "Torneos",
  "Complejos",
  "Facultades",
];

// Lo único que puede usar al planillero
export const SECCIONES_PLANILLERO = ["Partidos", "Planillas", "Sanciones"];

export function puedeVer(rol, seccion) {
  return rol === "administrador" || SECCIONES_PLANILLERO.includes(seccion);
}
