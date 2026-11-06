import { useEffect, useRef, useState } from "react";
import "./TablaPosiciones.css";
import "./Reportes.css";
import { InsigniaEquipo } from "./equipos";
import SelectorEdicion from "./SelectorEdicion";
import { apiRequest } from "../services/api";

// Palabras que no sirven para abreviar el nombre de una facultad
const PALABRAS_DE_RELLENO = ["ciencias", "de", "del", "la", "las", "los", "y"];

const VERBOS_RACHA = { G: "ganó", E: "empató", P: "perdió" };

// Altura en píxeles de la barra más alta de cada gráfico
const ALTO_BARRA = 52;

// Tablas completas que se abren al hacer clic en cada tarjeta
const DETALLES = {
  posiciones: {
    titulo: "Tabla de posiciones",
    color: "#ffc93c",
    tablas: (d) => [
      {
        filas: d.posiciones,
        columnas: [
          ["posicion", "#"],
          ["equipo", "Equipo"],
          ["pj", "PJ"],
          ["pg", "PG"],
          ["pe", "PE"],
          ["pp", "PP"],
          ["gf", "GF"],
          ["gc", "GC"],
          ["dg", "DG"],
          ["pts", "Pts"],
        ],
      },
    ],
  },
  goleadores: {
    titulo: "Goleadores",
    color: "#80d5a4",
    tablas: (d) => [
      {
        filas: d.goleadores,
        columnas: [
          ["posicion", "#"],
          ["jugador", "Jugador"],
          ["equipo", "Equipo"],
          ["goles", "Goles"],
        ],
      },
    ],
  },
  fairPlay: {
    titulo: "Fair play",
    color: "#ffffff",
    nota: "Amarilla: 1 punto. Roja: 3 puntos. Gana el de menor puntaje.",
    tablas: (d) => [
      {
        filas: d.fairPlay,
        columnas: [
          ["posicion", "#"],
          ["equipo", "Equipo"],
          ["amarillas", "Amarillas"],
          ["rojas", "Rojas"],
          ["puntaje", "Puntaje"],
        ],
      },
    ],
  },
  promedio: {
    titulo: "Promedio de goles",
    color: "#5db8f2",
    tablas: (d) => [
      {
        filas: d.promedio,
        columnas: [
          ["fecha", "Fecha"],
          ["partidos_jugados", "Partidos"],
          ["goles", "Goles"],
          ["promedio_goles", "Promedio"],
        ],
      },
    ],
  },
  canchasTurnos: {
    titulo: "Canchas y turnos",
    color: "#ffd9b5",
    tablas: (d) => [
      {
        filas: d.canchas,
        columnas: [
          ["complejo", "Complejo"],
          ["cancha", "Cancha"],
          ["superficie", "Superficie"],
          ["techada", "Techada"],
          ["jugados", "Jugados"],
          ["programados", "Programados"],
          ["partidos", "Total"],
        ],
      },
      {
        filas: d.turnos,
        columnas: [
          ["turno", "Turno"],
          ["jugados", "Jugados"],
          ["programados", "Programados"],
          ["partidos", "Total"],
        ],
      },
    ],
  },
  jugadoresFacultad: {
    titulo: "Jugadores por facultad y tipo",
    color: "#f59ac6",
    tablas: (d) => [
      {
        filas: d.jugadoresFacultad,
        columnas: [
          ["facultad", "Facultad"],
          ["grado", "Grado"],
          ["posgrado", "Posgrado"],
          ["docente", "Docente"],
          ["funcionario", "Funcionario"],
          ["total", "Total"],
        ],
      },
    ],
  },
  sinPlanilla: {
    titulo: "Nunca jugaron",
    color: "#6ed6cf",
    tablas: (d) => [
      {
        filas: d.sinPlanilla,
        columnas: [
          ["equipo", "Equipo"],
          ["camiseta", "Nº"],
          ["ci", "Cédula"],
          ["jugador", "Jugador"],
          ["tipo", "Tipo"],
        ],
      },
    ],
  },
  sanciones: {
    titulo: "Sanciones por equipo",
    color: "#ffc2b8",
    tablas: (d) => [
      {
        filas: d.sanciones,
        columnas: [
          ["equipo", "Equipo"],
          ["roja", "Roja directa"],
          ["doble_amarilla", "Doble amarilla"],
          ["acumulacion_amarillas", "Acum. amarillas"],
          ["disciplinaria", "Disciplinaria"],
          ["total", "Total"],
        ],
      },
    ],
  },
  estados: {
    titulo: "Estado de partidos",
    color: "#ffffff",
    tablas: (d) => [
      {
        filas: d.estados,
        columnas: [
          ["estado", "Estado"],
          ["partidos", "Partidos"],
          ["porcentaje", "%"],
        ],
      },
    ],
  },
  remontadas: {
    titulo: "Remontadas",
    color: "#ff801f",
    tablas: (d) => [
      {
        filas: d.remontadas,
        columnas: [
          ["fecha", "Fecha"],
          ["resultado", "Resultado"],
          ["remonto", "Remontó"],
          ["max_desventaja", "Máx. desventaja"],
        ],
      },
    ],
  },
  franjas: {
    titulo: "Goles por minuto",
    color: "#89aaff",
    tablas: (d) => [
      {
        filas: d.franjas,
        columnas: [
          ["franja", "Minutos"],
          ["goles", "Goles"],
          ["porcentaje", "%"],
        ],
      },
    ],
  },
  rachas: {
    titulo: "Rachas",
    color: "#c5a0f0",
    tablas: (d) => [
      {
        filas: d.rachas,
        columnas: [
          ["equipo", "Equipo"],
          ["ultimos_3", "Últimos 3"],
          ["puntos_ultimos_3", "Pts últimos 3"],
          ["puntos_totales", "Pts totales"],
        ],
      },
    ],
  },
};

function decimal(numero, minimoDecimales = 0) {
  return Number(numero).toLocaleString("es-UY", {
    minimumFractionDigits: minimoDecimales,
    maximumFractionDigits: 2,
  });
}

function plural(cantidad, singular, varios = `${singular}s`) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

// ["A", "B", "C"] => "A, B y 1 más"
function enumerar(items, maximo = items.length) {
  const visibles = items.slice(0, maximo);
  const resto = items.length - visibles.length;

  if (resto > 0) return `${visibles.join(", ")} y ${resto} más`;
  if (visibles.length < 2) return visibles.join("");
  return `${visibles.slice(0, -1).join(", ")} y ${visibles.at(-1)}`;
}

// "Cancha Norte" se entiende sola; "Cancha A" necesita el complejo: "Blanq. A"
function canchaCorta({ complejo, cancha }) {
  const nombre = cancha.split(" ").pop();
  if (nombre.length > 1) return nombre;

  const lugar = complejo.split(" ").pop();
  return `${lugar.length > 5 ? `${lugar.slice(0, 5)}.` : lugar} ${nombre}`;
}

function siglaFacultad(nombre) {
  const palabra =
    nombre
      .split(" ")
      .find((p) => !PALABRAS_DE_RELLENO.includes(p.toLowerCase())) || nombre;

  return palabra
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .slice(0, 3)
    .toUpperCase();
}

// Una edición sin equipos responde 404 en posiciones, pero igual tiene reportes
function posicionesSinEquipos(error) {
  if (error.status === 404) return { posiciones: [] };
  throw error;
}

async function pedirReportes(idTorneo) {
  const ruta = `/torneos/${idTorneo}`;

  const [
    { posiciones },
    goleadores,
    fairPlay,
    promedio,
    canchas,
    turnos,
    jugadoresFacultad,
    facultades,
    sinPlanilla,
    sanciones,
    estados,
    remontadas,
    franjas,
    rachas,
  ] = await Promise.all([
    apiRequest(`${ruta}/posiciones`).catch(posicionesSinEquipos),
    apiRequest(`${ruta}/goleadores`),
    apiRequest(`${ruta}/fair-play`),
    apiRequest(`${ruta}/promedio-goles`),
    apiRequest(`${ruta}/canchas`),
    apiRequest(`${ruta}/turnos`),
    apiRequest("/reportes/jugadores-facultad"),
    apiRequest("/facultades"),
    apiRequest(`${ruta}/jugadores-sin-planilla`),
    apiRequest(`${ruta}/sanciones`),
    apiRequest(`${ruta}/estado-partidos`),
    apiRequest(`${ruta}/remontadas`),
    apiRequest(`${ruta}/franjas-goles`),
    apiRequest(`${ruta}/rachas`),
  ]);

  return {
    posiciones,
    goleadores,
    fairPlay,
    promedio,
    canchas,
    turnos,
    jugadoresFacultad,
    facultades,
    sinPlanilla,
    sanciones,
    estados,
    remontadas,
    franjas,
    rachas,
  };
}

function sumar(filas, campo) {
  return filas.reduce((total, fila) => total + Number(fila[campo]), 0);
}

function Tarjeta({ detalle, numero, ancha, abrir, children }) {
  return (
    <button
      type="button"
      className={ancha ? "reporte-tarjeta reporte-ancha" : "reporte-tarjeta"}
      style={{ backgroundColor: DETALLES[detalle].color }}
      onClick={() => abrir(detalle)}
      title="Ver el reporte completo"
    >
      <span className="reporte-encabezado">
        <span className="titulo-pixel">{DETALLES[detalle].titulo}</span>
        <span className="reporte-numero">{numero}</span>
      </span>
      <span className="reporte-cuerpo">{children}</span>
    </button>
  );
}

function Barras({ barras, clase = "" }) {
  const maximo = Math.max(...barras.map((barra) => barra.valor), 1);

  return (
    <span className={`reporte-barras ${clase}`}>
      {barras.map((barra) => (
        <span
          key={barra.etiqueta}
          className="reporte-barra-columna"
          title={barra.titulo}
        >
          <span className="reporte-barra-valor">
            {barra.texto ?? barra.valor}
          </span>
          <span
            className="reporte-barra"
            style={{ height: Math.max((barra.valor / maximo) * ALTO_BARRA, 3) }}
          />
          <span className="reporte-barra-etiqueta">{barra.etiqueta}</span>
        </span>
      ))}
    </span>
  );
}

function celda(valor) {
  return typeof valor === "number" && !Number.isInteger(valor)
    ? decimal(valor)
    : valor;
}

function DetalleReporte({ detalle, datos, cerrar }) {
  const dialogo = useRef(null);
  const { titulo, color, nota, tablas } = DETALLES[detalle];

  useEffect(() => {
    dialogo.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="reporte-detalle"
      style={{ "--color-detalle": color }}
      onClose={cerrar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) cerrar();
      }}
    >
      <div className="reporte-detalle-contenido">
        <div className="reporte-detalle-encabezado">
          <h2 className="titulo-pixel">{titulo}</h2>
          <button type="button" onClick={cerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {nota && <p className="reporte-detalle-nota">{nota}</p>}

        {tablas(datos).map(({ columnas, filas }) =>
          filas.length === 0 ? (
            <p key={columnas[0][0]}>Todavía no hay datos.</p>
          ) : (
            <div key={columnas[0][0]} className="reporte-tabla-marco">
              <table className="reporte-tabla">
                <thead>
                  <tr>
                    {columnas.map(([campo, etiqueta]) => (
                      <th key={campo}>{etiqueta}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, indice) => (
                    <tr key={indice}>
                      {columnas.map(([campo]) => (
                        <td key={campo}>{celda(fila[campo])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        )}
      </div>
    </dialog>
  );
}

function Tarjetas({ datos, abrir }) {
  const {
    posiciones,
    goleadores,
    fairPlay,
    promedio,
    canchas,
    turnos,
    jugadoresFacultad,
    facultades,
    sinPlanilla,
    sanciones,
    estados,
    remontadas,
    franjas,
    rachas,
  } = datos;

  const equipoPorNombre = Object.fromEntries(
    posiciones.map((equipo) => [equipo.equipo, equipo]),
  );

  function insignia(nombre, tamano = "md") {
    return (
      <InsigniaEquipo
        key={nombre}
        id={equipoPorNombre[nombre]?.id_equipo}
        nombre={nombre}
        tamano={tamano}
      />
    );
  }

  // 1. El orden de la API ya resuelve los desempates
  const lider = posiciones[0];
  const hayPartidos = posiciones.some((equipo) => equipo.pj > 0);
  const igualados = posiciones.filter((e) => e.pts === lider?.pts).length - 1;

  // 2. Puede haber más de un máximo goleador
  const maximosGoleadores = goleadores.filter((g) => g.posicion === 1);

  // 3. Los empatados pueden tener distintas tarjetas (1 roja = 3 amarillas)
  const mejoresFairPlay = fairPlay.filter((f) => f.posicion === 1);
  const mejorFairPlay = mejoresFairPlay[0];
  const mismasTarjetas = mejoresFairPlay.every(
    (f) =>
      f.amarillas === mejorFairPlay.amarillas &&
      f.rojas === mejorFairPlay.rojas,
  );

  // 4. La última fila es el total de la edición (WITH ROLLUP)
  const promedioPorFecha = promedio.slice(0, -1);
  const promedioEdicion = promedio.at(-1);

  // 5. Los turnos vienen ordenados por uso; el gráfico va por hora
  const turnosPorHora = [...turnos].sort((a, b) =>
    a.turno.localeCompare(b.turno),
  );

  // 6. El reporte viene ordenado por nombre; el gráfico va por id de facultad
  const idFacultad = Object.fromEntries(
    facultades.map((f) => [f.nombre, f.id_facultad]),
  );
  const totalJugadores = jugadoresFacultad.find((f) => f.facultad === "TOTAL");
  const jugadoresPorFacultad = jugadoresFacultad
    .filter((f) => f !== totalJugadores)
    .sort((a, b) => idFacultad[a.facultad] - idFacultad[b.facultad]);

  // 8. Viene ordenado por total de sanciones
  const masSancionado = sanciones[0]?.total > 0 ? sanciones[0] : null;
  const detalleSanciones =
    masSancionado &&
    enumerar(
      [
        [masSancionado.roja, "roja"],
        [masSancionado.doble_amarilla, "por doble amarilla", "por doble amarilla"],
        [masSancionado.acumulacion_amarillas, "por amarillas", "por amarillas"],
        [masSancionado.disciplinaria, "disciplinaria"],
      ]
        .filter(([cantidad]) => cantidad > 0)
        .map(([cantidad, singular, varios]) =>
          plural(cantidad, singular, varios),
        ),
    );

  // 9. Si no hay partidos de un estado, la API no devuelve esa fila
  const porcentaje = (estado) =>
    Number(estados.find((e) => e.estado === estado)?.porcentaje ?? 0);
  const jugados = porcentaje("jugado");
  const postergados = porcentaje("postergado");
  const cancelados = porcentaje("cancelado");

  // 10. La peor racha entre los equipos que ya jugaron
  const peorRacha = rachas
    .filter((r) => r.ultimos_3 !== "-")
    .sort((a, b) => a.puntos_ultimos_3 - b.puntos_ultimos_3)[0];
  const resultados = peorRacha?.ultimos_3.split(" ") ?? [];
  const partidosRacha = resultados.length;
  const jugoSoloEsos =
    equipoPorNombre[peorRacha?.equipo]?.pj === partidosRacha;

  function textoRacha() {
    if (resultados.every((resultado) => resultado === resultados[0])) {
      const cuales = jugoSoloEsos ? "los" : "los últimos";
      const partidos = plural(partidosRacha, "partido");
      return `${peorRacha.equipo} ${VERBOS_RACHA[resultados[0]]} ${cuales} ${partidos}`;
    }

    return `${peorRacha.equipo} sumó ${peorRacha.puntos_ultimos_3} de ${partidosRacha * 3} puntos posibles`;
  }

  return (
    <div className="reportes-grilla">
      <Tarjeta detalle="posiciones" numero="1" abrir={abrir}>
        {hayPartidos ? (
          <span className="reporte-lider">
            {insignia(lider.equipo, "reporte")}
            <span>
              <strong className="titulo-pixel">{lider.equipo}</strong>
              <span className="reporte-texto">
                {plural(lider.pts, "pt", "pts")}
                {igualados > 0 &&
                  `, igualado con ${plural(igualados, "equipo")}`}
              </span>
            </span>
          </span>
        ) : (
          <span className="reporte-texto">Todavía no se jugaron partidos</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="goleadores" numero="2" abrir={abrir}>
        {maximosGoleadores.length > 0 ? (
          <>
            <span className="reporte-cifra">{maximosGoleadores[0].goles}</span>
            <span className="reporte-texto">
              {enumerar(
                maximosGoleadores.map((g) => `${g.jugador} (${g.equipo})`),
                2,
              )}
            </span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no hay goles</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="fairPlay" numero="3" abrir={abrir}>
        {mejorFairPlay ? (
          <>
            <span className="reporte-insignias">
              {mejoresFairPlay.map((f) => insignia(f.equipo))}
            </span>
            <span className="reporte-texto">
              {mejoresFairPlay.length > 1
                ? "1º compartido: "
                : `1º ${mejorFairPlay.equipo}: `}
              {plural(mejorFairPlay.puntaje, "punto")}
              {mismasTarjetas &&
                ` (${plural(mejorFairPlay.amarillas, "amarilla")}, ${plural(mejorFairPlay.rojas, "roja")})`}
            </span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no hay equipos</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="promedio" numero="4" abrir={abrir}>
        {promedioEdicion ? (
          <>
            <span className="reporte-promedio">
              <span className="reporte-cifra">
                {decimal(promedioEdicion.promedio_goles)}
              </span>
              <Barras
                clase="reporte-barras-promedio"
                barras={promedioPorFecha.map((fila) => ({
                  etiqueta: fila.fecha.replace("Fecha ", "F"),
                  titulo: fila.fecha,
                  valor: Number(fila.promedio_goles),
                  texto: decimal(fila.promedio_goles, 1),
                }))}
              />
            </span>
            <span className="reporte-texto">
              por partido en la edición (
              {plural(promedioEdicion.goles, "gol", "goles")} en{" "}
              {promedioEdicion.partidos_jugados})
            </span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no se jugaron partidos</span>
        )}
      </Tarjeta>

      <Tarjeta
        detalle="canchasTurnos"
        numero="5"
        ancha
        abrir={abrir}
      >
        <span className="reporte-canchas-turnos">
          <Barras
            clase="reporte-barras-canchas"
            barras={canchas.map((fila) => ({
              etiqueta: canchaCorta(fila),
              titulo: `${fila.complejo} - ${fila.cancha}`,
              valor: Number(fila.partidos),
            }))}
          />
          <Barras
            barras={turnosPorHora.map((fila) => ({
              etiqueta: fila.turno.slice(0, 2),
              titulo: fila.turno,
              valor: Number(fila.partidos),
            }))}
          />
        </span>
        <span className="reporte-texto-grande">
          {enumerar([
            plural(sumar(turnos, "jugados"), "partido jugado", "partidos jugados"),
            plural(sumar(turnos, "programados"), "programado"),
          ])}
        </span>
      </Tarjeta>

      <Tarjeta
        detalle="jugadoresFacultad"
        numero="6"
        ancha
        abrir={abrir}
      >
        <Barras
          clase="reporte-barras-blancas"
          barras={jugadoresPorFacultad.map((fila) => ({
            etiqueta: siglaFacultad(fila.facultad),
            titulo: fila.facultad,
            valor: Number(fila.total),
          }))}
        />
        {totalJugadores && (
          <span className="reporte-texto-grande">
            {plural(Number(totalJugadores.total), "jugador", "jugadores")}:{" "}
            {enumerar(
              [
                `${totalJugadores.grado} de grado`,
                `${totalJugadores.posgrado} de posgrado`,
                plural(Number(totalJugadores.docente), "docente"),
                plural(
                  Number(totalJugadores.funcionario),
                  "funcionario",
                ),
              ],
            )}
          </span>
        )}
      </Tarjeta>

      <Tarjeta detalle="sinPlanilla" numero="7" abrir={abrir}>
        <span className="reporte-cifra">{sinPlanilla.length}</span>
        <span className="reporte-texto">
          {sinPlanilla.length > 0
            ? enumerar(
                sinPlanilla.map((j) => `${j.jugador} (${j.equipo})`),
                2,
              )
            : "Todos los inscriptos ya jugaron"}
        </span>
      </Tarjeta>

      <Tarjeta detalle="sanciones" numero="8" abrir={abrir}>
        {masSancionado ? (
          <>
            <span className="reporte-sancionado">
              {insignia(masSancionado.equipo)}
              <span className="reporte-cifra">{masSancionado.total}</span>
            </span>
            <span className="reporte-texto">
              {masSancionado.equipo}: {detalleSanciones}
            </span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no hay sanciones</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="estados" numero="9" abrir={abrir}>
        {estados.length > 0 ? (
          <>
            <span className="reporte-estados">
              <span
                className="reporte-estado-jugado"
                style={{ width: `${jugados}%` }}
              />
              <span
                className="reporte-estado-postergado"
                style={{ width: `${postergados}%` }}
              />
              <span
                className="reporte-estado-cancelado"
                style={{ width: `${cancelados}%` }}
              />
            </span>
            <span className="reporte-texto">
              Jugados {decimal(jugados, 1)}&nbsp;% - postergados{" "}
              {decimal(postergados, 1)}&nbsp;% - cancelados{" "}
              {decimal(cancelados, 1)}&nbsp;%
            </span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no se jugaron partidos</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="remontadas" numero="10" abrir={abrir}>
        <span className="reporte-cifra">{remontadas.length}</span>
        <span className="reporte-texto">
          {remontadas.length > 0
            ? enumerar(
                remontadas.map((r) =>
                  r.resultado.replace(/(\d+) - (\d+)/, "$1-$2"),
                ),
                2,
              )
            : "Ningún equipo dio vuelta un partido"}
        </span>
      </Tarjeta>

      <Tarjeta
        detalle="franjas"
        numero="10"
        ancha
        abrir={abrir}
      >
        {franjas.length > 0 ? (
          <Barras
            barras={franjas.map((fila) => ({
              etiqueta: fila.franja,
              titulo: `${decimal(fila.porcentaje, 1)} % de los goles`,
              valor: Number(fila.goles),
            }))}
          />
        ) : (
          <span className="reporte-texto">Todavía no hay goles</span>
        )}
      </Tarjeta>

      <Tarjeta detalle="rachas" numero="10" ancha abrir={abrir}>
        {peorRacha ? (
          <>
            <span className="reporte-racha">
              {insignia(peorRacha.equipo)}
              <span className="racha-equipo">
                {resultados.map((resultado, indice) => (
                  <span
                    key={indice}
                    className={`racha-cuadro reporte-racha-cuadro racha-${resultado}`}
                  >
                    {resultado}
                  </span>
                ))}
              </span>
            </span>
            <span className="reporte-texto">{textoRacha()}</span>
          </>
        ) : (
          <span className="reporte-texto">Todavía no se jugaron partidos</span>
        )}
      </Tarjeta>
    </div>
  );
}

function Reportes({
  torneos = [],
  torneoSeleccionado = "",
  cambiarTorneo,
  onEdicionCreada,
}) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    let vigente = true;

    pedirReportes(torneoSeleccionado)
      .then((reportes) => {
        if (vigente) setDatos(reportes);
      })
      .catch((err) => {
        if (vigente) setError(err.message);
      });

    return () => {
      vigente = false;
    };
  }, [torneoSeleccionado]);

  const totalEdicion = datos?.promedio.at(-1);
  const fechasJugadas = Math.max((datos?.promedio.length ?? 0) - 1, 0);
  const partidosJugados = totalEdicion?.partidos_jugados ?? 0;
  const goles = Number(totalEdicion?.goles ?? 0);

  return (
    <div className="reportes-pagina">
      <SelectorEdicion
        torneos={torneos}
        torneoSeleccionado={torneoSeleccionado}
        cambiarTorneo={cambiarTorneo}
        onEdicionCreada={onEdicionCreada}
      />

      <h1 className="titulo-pixel">Reportes</h1>

      {error && <p className="error">{error}</p>}
      {!datos && !error && <p>Cargando...</p>}

      {datos && (
        <>
          <div className="reportes-resumen">
            <span>
              <strong>{fechasJugadas}</strong>{" "}
              {fechasJugadas === 1 ? "fecha jugada" : "fechas jugadas"}
            </span>
            <span>
              <strong>{partidosJugados}</strong>{" "}
              {partidosJugados === 1 ? "partido jugado" : "partidos jugados"}
            </span>
            <span>
              <strong>{goles}</strong> {goles === 1 ? "gol" : "goles"}
            </span>
          </div>

          <Tarjetas datos={datos} abrir={setDetalle} />

          {detalle && (
            <DetalleReporte
              detalle={detalle}
              datos={datos}
              cerrar={() => setDetalle(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Reportes;
