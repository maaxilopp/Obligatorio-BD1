
from fastapi import FastAPI, HTTPException
from mysql.connector import Error

from backend.database import obtener_conexion

app = FastAPI(
    title="Torneo Interfacultades de Fútbol 5",
    description="API para la gestión del torneo de la UCU",
    version="1.0.0",
)


def consultar(sql, parametros=()):
    conexion = None
    cursor = None

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute(sql, parametros)
        return cursor.fetchall()

    except Error:
        raise HTTPException(
            status_code=500,
            detail="Error al consultar la base de datos",
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conexion is not None and conexion.is_connected():
            conexion.close()


@app.get("/")
def inicio():
    return {
        "mensaje": "API del Torneo Interfacultades de Fútbol 5",
        "estado": "funcionando",
    }


@app.get("/health")
def health():
    return {"estado": "ok"}


@app.get("/torneos")
def obtener_torneos():
    return consultar("""
        SELECT *
        FROM torneo
    """)


@app.get("/torneos/{id_torneo}/posiciones")
def obtener_posiciones(id_torneo: int):
    filas = consultar("""
        SELECT RANK() OVER (
                   ORDER BY pts DESC, dg DESC, gf DESC
               ) AS posicion,
               id_torneo, id_equipo, equipo, facultad,
               pj, pg, pe, pp, gf, gc, dg, pts
        FROM v_tabla_posiciones
        WHERE id_torneo = %s
        ORDER BY pts DESC, dg DESC, gf DESC, equipo
    """, (id_torneo,))

    if not filas:
        raise HTTPException(
            status_code=404,
            detail="No hay equipos para ese torneo",
        )

    return {"id_torneo": id_torneo, "posiciones": filas}


@app.get("/torneos/{id_torneo}/goleadores")
def obtener_goleadores(id_torneo: int):
    return consultar("""
        SELECT jugador, equipo, goles
        FROM v_goleadores
        WHERE id_torneo = %s
        ORDER BY goles DESC, jugador
        LIMIT 10
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/fair-play")
def obtener_fair_play(id_torneo: int):
    return consultar("""
        SELECT RANK() OVER (ORDER BY puntaje) AS posicion,
               equipo, amarillas, rojas, puntaje
        FROM v_fair_play
        WHERE id_torneo = %s
        ORDER BY puntaje, equipo
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/promedio-goles")
def obtener_promedio_goles(id_torneo: int):
    return consultar("""
        SELECT
            IF(
                GROUPING(numero_fecha),
                'Total edición',
                CONCAT('Fecha ', numero_fecha)
            ) AS fecha,
            COUNT(*) AS partidos_jugados,
            SUM(goles_local + goles_visitante) AS goles,
            ROUND(
                SUM(goles_local + goles_visitante) / COUNT(*),
                2
            ) AS promedio_goles
        FROM v_resultado_partido
        WHERE id_torneo = %s AND estado = 'jugado'
        GROUP BY numero_fecha WITH ROLLUP
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/canchas")
def obtener_uso_canchas(id_torneo: int):
    return consultar("""
        SELECT co.nombre AS complejo,
               c.nombre_cancha AS cancha,
               c.superficie,
               IF(c.techada, 'sí', 'no') AS techada,
               COUNT(p.id_partido) AS partidos
        FROM cancha c
        JOIN complejo co ON co.id_complejo = c.id_complejo
        LEFT JOIN partido p
            ON p.id_complejo = c.id_complejo
            AND p.nombre_cancha = c.nombre_cancha
            AND p.id_torneo = %s
            AND p.estado IN ('jugado', 'programado')
        GROUP BY co.nombre, c.id_complejo,
                 c.nombre_cancha, c.superficie, c.techada
        ORDER BY partidos DESC, complejo, cancha
    """, (id_torneo,))


@app.get("/reportes/turnos")
def obtener_uso_turnos(id_torneo: int):
    return consultar("""
        SELECT CONCAT(
                   TIME_FORMAT(t.hora_inicio, '%H:%i'),
                   ' a ',
                   TIME_FORMAT(t.hora_fin, '%H:%i')
               ) AS turno,
               COUNT(p.id_partido) AS partidos
        FROM turno t
        LEFT JOIN partido p
            ON p.id_turno = t.id_turno
            AND p.id_torneo = %s
            AND p.estado IN ('jugado', 'programado')
        GROUP BY t.id_turno, t.hora_inicio, t.hora_fin
        ORDER BY partidos DESC, t.hora_inicio
    """, (id_torneo,))


@app.get("/reportes/jugadores-facultad")
def obtener_jugadores_facultad():
    return consultar("""
        SELECT
            IF(GROUPING(f.nombre), 'TOTAL', f.nombre) AS facultad,
            SUM(j.tipo = 'grado') AS grado,
            SUM(j.tipo = 'posgrado') AS posgrado,
            SUM(j.tipo = 'docente') AS docente,
            SUM(j.tipo = 'funcionario') AS funcionario,
            COUNT(j.ci) AS total
        FROM facultad f
        LEFT JOIN jugador j ON j.id_facultad = f.id_facultad
        GROUP BY f.nombre WITH ROLLUP
    """)


@app.get("/torneos/{id_torneo}/jugadores-sin-planilla")
def obtener_jugadores_sin_planilla(id_torneo: int):
    return consultar("""
        SELECT e.nombre AS equipo,
               ejt.numero_camiseta AS camiseta,
               j.ci,
               CONCAT(j.nombre, ' ', j.apellido) AS jugador,
               j.tipo
        FROM equipo_jugador_torneo ejt
        JOIN equipo e ON e.id_equipo = ejt.id_equipo
        JOIN jugador j ON j.ci = ejt.ci_jugador
        WHERE ejt.id_torneo = %s
          AND NOT EXISTS (
              SELECT 1
              FROM planilla_partido pp
              WHERE pp.ci_jugador = ejt.ci_jugador
                AND pp.id_equipo = ejt.id_equipo
          )
        ORDER BY equipo, camiseta
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/sanciones")
def obtener_sanciones(id_torneo: int):
    return consultar("""
        SELECT e.nombre AS equipo,
               COALESCE(SUM(s.motivo = 'roja'), 0) AS roja,
               COALESCE(
                   SUM(s.motivo = 'acumulacion de amarillas'), 0
               ) AS acumulacion_amarillas,
               COALESCE(
                   SUM(s.motivo = 'disciplinaria'), 0
               ) AS disciplinaria,
               COUNT(s.id_sancion) AS total
        FROM equipo e
        LEFT JOIN v_sanciones s ON s.id_equipo = e.id_equipo
        WHERE e.id_torneo = %s
        GROUP BY e.id_equipo, e.nombre
        ORDER BY total DESC, equipo
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/estado-partidos")
def obtener_estado_partidos(id_torneo: int):
    return consultar("""
        SELECT estado,
               COUNT(*) AS partidos,
               ROUND(
                   100 * COUNT(*) / SUM(COUNT(*)) OVER (),
                   1
               ) AS porcentaje
        FROM partido
        WHERE id_torneo = %s
          AND estado IN ('jugado', 'postergado', 'cancelado')
        GROUP BY estado
        ORDER BY partidos DESC
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/remontadas")
def obtener_remontadas(id_torneo: int):
    return consultar("""
        WITH marcador AS (
            SELECT r.id_partido, r.numero_fecha,
                   r.equipo_local, r.equipo_visitante,
                   r.goles_local, r.goles_visitante,
                   SUM(g.id_equipo_beneficiado = r.id_equipo_local)
                       OVER (
                           PARTITION BY r.id_partido
                           ORDER BY g.minuto, g.id_gol
                       ) AS parcial_local,
                   SUM(g.id_equipo_beneficiado = r.id_equipo_visitante)
                       OVER (
                           PARTITION BY r.id_partido
                           ORDER BY g.minuto, g.id_gol
                       ) AS parcial_visitante
            FROM v_resultado_partido r
            JOIN v_gol_detalle g ON g.id_partido = r.id_partido
            WHERE r.id_torneo = %s AND r.estado = 'jugado'
        )
        SELECT numero_fecha AS fecha,
               CONCAT(
                   equipo_local, ' ', goles_local, ' - ',
                   goles_visitante, ' ', equipo_visitante
               ) AS resultado,
               IF(
                   goles_local > goles_visitante,
                   equipo_local,
                   equipo_visitante
               ) AS remonto,
               MAX(
                   IF(
                       goles_local > goles_visitante,
                       parcial_visitante - parcial_local,
                       parcial_local - parcial_visitante
                   )
               ) AS max_desventaja
        FROM marcador
        GROUP BY id_partido, numero_fecha, equipo_local,
                 equipo_visitante, goles_local, goles_visitante
        HAVING goles_local <> goles_visitante
           AND max_desventaja > 0
        ORDER BY max_desventaja DESC, fecha
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/franjas-goles")
def obtener_franjas_goles(id_torneo: int):
    return consultar("""
        SELECT CONCAT(
                   LPAD(franja * 10, 2, '0'),
                   '-',
                   IF(
                       franja = 5,
                       '60',
                       LPAD(franja * 10 + 9, 2, '0')
                   ),
                   ''''
               ) AS franja,
               COUNT(*) AS goles,
               ROUND(
                   100 * COUNT(*) / SUM(COUNT(*)) OVER (),
                   1
               ) AS porcentaje
        FROM (
            SELECT LEAST(FLOOR(minuto / 10), 5) AS franja
            FROM v_gol_detalle
            WHERE id_torneo = %s
        ) x
        GROUP BY franja
        ORDER BY franja
    """, (id_torneo,))


@app.get("/torneos/{id_torneo}/rachas")
def obtener_rachas(id_torneo: int):
    return consultar("""
        WITH ultimos AS (
            SELECT pe.id_equipo,
                   CASE
                       WHEN pe.gf > pe.gc THEN 'G'
                       WHEN pe.gf = pe.gc THEN 'E'
                       ELSE 'P'
                   END AS res,
                   ROW_NUMBER() OVER (
                       PARTITION BY pe.id_equipo
                       ORDER BY pe.dia DESC, pe.id_turno DESC
                   ) AS n
            FROM v_partido_equipo pe
            WHERE pe.id_torneo = %s
        )
        SELECT tp.equipo,
               COALESCE(
                   GROUP_CONCAT(u.res ORDER BY u.n SEPARATOR ' '),
                   '-'
               ) AS ultimos_3,
               COALESCE(
                   SUM(
                       CASE u.res
                           WHEN 'G' THEN 3
                           WHEN 'E' THEN 1
                           ELSE 0
                       END
                   ), 0
               ) AS puntos_ultimos_3,
               tp.pts AS puntos_totales
        FROM v_tabla_posiciones tp
        LEFT JOIN ultimos u
            ON u.id_equipo = tp.id_equipo AND u.n <= 3
        WHERE tp.id_torneo = %s
        GROUP BY tp.id_equipo, tp.equipo, tp.pts
        ORDER BY puntos_ultimos_3 DESC, tp.pts DESC
    """, (id_torneo, id_torneo))
