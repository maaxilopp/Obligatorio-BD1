// Paleta de colores de equipos y facultades (se elige por id)

const coloresEquipos = [
  "#ff801f",
  "#80d5a4",
  "#89aaff",
  "#ff9890",
  "#c5a0eb",
  "#ffd044",
];

export function colorEquipo(idEquipo) {
  const indice = (Number(idEquipo) - 1) % coloresEquipos.length;
  return coloresEquipos[indice >= 0 ? indice : 0];
}
