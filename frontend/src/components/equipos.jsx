// componente para mostrar los equipos con su insignia de color.

import { colorEquipo } from './colores';

// Función para generar la sigla del equipo a partir de su nombre
function siglaEquipo(nombre = "") {
  const palabras = nombre
    .split(" ")
    .filter((palabra) => palabra && palabra.toUpperCase() !== "FC");

  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();

  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

export function InsigniaEquipo({ id, nombre, tamano = "md" }) {
  return (
    <span
      className={`insignia insignia-${tamano}`}
      style={{ backgroundColor: colorEquipo(id) }}
    >
      {siglaEquipo(nombre)}
    </span>
  );
}
