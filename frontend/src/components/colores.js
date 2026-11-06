const coloresEquipos = [
  "#ff801f",
  "#80d5a4",
  "#89aaff",
  "#ff9890",
  "#c5a0eb",
  "#ffd044",
  "#5db8f2",
  "#f4a6d7",
  "#b5d86b",
  "#6fd6cf",
  "#d9b38c",
  "#a7b4c9",
];

export function colorEquipo(idEquipo) {
  const id = Number(idEquipo);
  if (!Number.isInteger(id) || id < 1) return coloresEquipos[0];
  if (id <= coloresEquipos.length) return coloresEquipos[id - 1];

  // Pasada la paleta, cada id gira el tono 137,5° para no repetir colores
  return `hsl(${((id * 137.508) % 360).toFixed(1)} 75% 72%)`;
}
