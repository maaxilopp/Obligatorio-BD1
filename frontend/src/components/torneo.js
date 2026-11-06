// Utilidades compartidas por las pantallas del torneo

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function diaCorto(dia) {
  if (!dia) return "";
  const [anio, mes, numero] = dia.slice(0, 10).split("-").map(Number);
  const fecha = new Date(anio, mes - 1, numero);
  return `${DIAS_SEMANA[fecha.getDay()]} ${String(numero).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

export function fechaCompleta(iso = "") {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

export function formatearCi(ci = "") {
  const cuerpo = ci.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${ci.slice(-1)}`;
}

export function ordenarTorneos(lista) {
  return [...lista].sort((a, b) => b.anio - a.anio || b.semestre - a.semestre);
}

export function totalFechas(cantidadEquipos) {
  if (cantidadEquipos < 1) return 0;
  return cantidadEquipos % 2 === 0 ? cantidadEquipos - 1 : cantidadEquipos;
}

export function problemaSemestre(semestre, fechaInicio, fechaFin) {
  const mesInicio = Number(fechaInicio.slice(5, 7));
  const terminaATiempo =
    fechaFin.slice(0, 4) === fechaInicio.slice(0, 4) &&
    (Number(semestre) === 2 || Number(fechaFin.slice(5, 7)) <= 7);

  if (Number(semestre) === (mesInicio <= 6 ? 1 : 2) && terminaATiempo) {
    return "";
  }
  return "Las fechas no corresponden al semestre: el 1º empieza de enero a junio y termina hasta julio; el 2º empieza de julio a diciembre y termina ese año.";
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
