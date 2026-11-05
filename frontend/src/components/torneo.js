// Utilidades compartidas por las pantallas del torneo

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "2026-11-08" -> "dom 08/11"
export function diaCorto(dia) {
  if (!dia) return "";
  const [anio, mes, numero] = dia.slice(0, 10).split("-").map(Number);
  const fecha = new Date(anio, mes - 1, numero);
  return `${DIAS_SEMANA[fecha.getDay()]} ${String(numero).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// "2026-11-08" -> "08/11/2026"
export function fechaCompleta(iso = "") {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

// "45200189" -> "4.520.018-9"
export function formatearCi(ci = "") {
  const cuerpo = ci.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${ci.slice(-1)}`;
}

export function ordenarTorneos(lista) {
  return [...lista].sort((a, b) => b.anio - a.anio || b.semestre - a.semestre);
}

export function fechasDe(partidos) {
  return [...new Set(partidos.map((p) => p.numero_fecha))].sort(
    (a, b) => a - b,
  );
}

// Una fecha está terminada cuando todo lo que no se canceló ya se jugó
export function fechaTerminada(partidos, fecha) {
  const vigentes = partidos.filter(
    (p) => p.numero_fecha === fecha && p.estado !== "cancelado",
  );
  return vigentes.length > 0 && vigentes.every((p) => p.estado === "jugado");
}

// Primera fecha que todavía tiene partidos por jugar (null si no queda ninguna)
export function fechaPendiente(partidos) {
  return (
    fechasDe(partidos).find((fecha) => !fechaTerminada(partidos, fecha)) ?? null
  );
}
