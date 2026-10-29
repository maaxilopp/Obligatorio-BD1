-- REPORTES DEL OBLIGATORIO

SET NAMES utf8mb4;
SET time_zone = '-03:00';
USE torneo_futbol5;

SET @torneo = 1;


-- 1. TABLA DE POSICIONES
--    Orden: puntos, diferencia de goles, goles a favor.
SELECT RANK() OVER (ORDER BY pts DESC, dg DESC, gf DESC) AS posicion,
       equipo, pj, pg, pe, pp, gf, gc, dg, pts
FROM v_tabla_posiciones
WHERE id_torneo = @torneo
ORDER BY posicion, equipo;


-- 2. TABLA DE GOLEADORES (top 10, sin autogoles)
--    Con RANK() los empatados comparten posición: si hay empate en el
--    puesto 10, entran todos los empatados (puede devolver más de 10 filas).
SELECT posicion, jugador, equipo, goles
FROM (SELECT RANK() OVER (ORDER BY goles DESC) AS posicion,
             jugador, equipo, goles
      FROM v_goleadores
      WHERE id_torneo = @torneo) g
WHERE posicion <= 10
ORDER BY posicion, jugador;


-- 3. FAIR PLAY POR EQUIPO (amarilla = 1, roja = 3; el mejor es el de menor puntaje)
SELECT DENSE_RANK() OVER (ORDER BY puntaje) AS posicion,
       equipo, amarillas, rojas, puntaje
FROM v_fair_play
WHERE id_torneo = @torneo
ORDER BY posicion, equipo;


-- 4. PROMEDIO DE GOLES POR PARTIDO, POR FECHA Y EN TODA LA EDICIÓN
--    WITH ROLLUP agrega la fila del total de la edición (numero_fecha NULL).
SELECT IF(GROUPING(numero_fecha), 'Total edición', CONCAT('Fecha ', numero_fecha)) AS fecha,
       COUNT(*)                                          AS partidos_jugados,
       SUM(goles_local + goles_visitante)                AS goles,
       ROUND(SUM(goles_local + goles_visitante) / COUNT(*), 2) AS promedio_goles
FROM v_resultado_partido
WHERE id_torneo = @torneo AND estado = 'jugado'
GROUP BY numero_fecha WITH ROLLUP;


-- 5a. CANCHAS MÁS UTILIZADAS (partidos jugados o programados; los cancelados
--     y postergados no ocupan la cancha)
SELECT co.nombre AS complejo, c.nombre_cancha AS cancha, c.superficie,
       IF(c.techada, 'sí', 'no') AS techada,
       COUNT(p.id_partido) AS partidos
FROM cancha c
JOIN complejo co ON co.id_complejo = c.id_complejo
LEFT JOIN partido p ON p.id_complejo = c.id_complejo
                   AND p.nombre_cancha = c.nombre_cancha
                   AND p.id_torneo = @torneo
                   AND p.estado IN ('jugado', 'programado')
GROUP BY co.nombre, c.id_complejo, c.nombre_cancha, c.superficie, c.techada
ORDER BY partidos DESC, complejo, cancha;

-- 5b. TURNOS MÁS UTILIZADOS
SELECT CONCAT(TIME_FORMAT(t.hora_inicio, '%H:%i'), ' a ', TIME_FORMAT(t.hora_fin, '%H:%i')) AS turno,
       COUNT(p.id_partido) AS partidos
FROM turno t
LEFT JOIN partido p ON p.id_turno = t.id_turno
                   AND p.id_torneo = @torneo
                   AND p.estado IN ('jugado', 'programado')
GROUP BY t.id_turno, t.hora_inicio, t.hora_fin
ORDER BY partidos DESC, t.hora_inicio;


-- 6. CANTIDAD DE JUGADORES POR FACULTAD Y POR TIPO (todos los jugadores registrados)
SELECT IF(GROUPING(f.nombre), 'TOTAL', f.nombre) AS facultad,
       SUM(j.tipo = 'grado')       AS grado,
       SUM(j.tipo = 'posgrado')    AS posgrado,
       SUM(j.tipo = 'docente')     AS docente,
       SUM(j.tipo = 'funcionario') AS funcionario,
       COUNT(j.ci)                 AS total
FROM facultad f
LEFT JOIN jugador j ON j.id_facultad = f.id_facultad
GROUP BY f.nombre WITH ROLLUP;


-- 7. JUGADORES INSCRIPTOS EN UN PLANTEL QUE NUNCA FIGURARON EN UNA PLANILLA
SELECT e.nombre AS equipo, ejt.numero_camiseta AS camiseta,
       j.ci, CONCAT(j.nombre, ' ', j.apellido) AS jugador, j.tipo
FROM equipo_jugador_torneo ejt
JOIN equipo e  ON e.id_equipo = ejt.id_equipo
JOIN jugador j ON j.ci = ejt.ci_jugador
WHERE ejt.id_torneo = @torneo
  AND NOT EXISTS (SELECT 1 FROM planilla_partido pp
                  WHERE pp.ci_jugador = ejt.ci_jugador
                    AND pp.id_equipo  = ejt.id_equipo)
ORDER BY equipo, camiseta;


-- 8. CANTIDAD DE SANCIONES POR EQUIPO Y POR MOTIVO
SELECT e.nombre AS equipo,
       COALESCE(SUM(s.motivo = 'roja'), 0)                     AS roja,
       COALESCE(SUM(s.motivo = 'acumulacion de amarillas'), 0) AS acumulacion_amarillas,
       COALESCE(SUM(s.motivo = 'disciplinaria'), 0)            AS disciplinaria,
       COUNT(s.id_sancion)                                     AS total
FROM equipo e
LEFT JOIN v_sanciones s ON s.id_equipo = e.id_equipo
WHERE e.id_torneo = @torneo
GROUP BY e.id_equipo, e.nombre
ORDER BY total DESC, equipo;


-- 9. PORCENTAJE DE PARTIDOS JUGADOS VS. POSTERGADOS / CANCELADOS
--    (sobre el total de partidos programados en la edición, sin contar los que
--     todavía están pendientes de jugarse)
SELECT estado,
       COUNT(*) AS partidos,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS porcentaje
FROM partido
WHERE id_torneo = @torneo AND estado IN ('jugado', 'postergado', 'cancelado')
GROUP BY estado
ORDER BY partidos DESC;

-- CONSULTAS PROPUESTAS POR NOSOTROS 

-- 10. REMONTADAS: partidos que ganó un equipo que en algún momento iba perdiendo.
--     Se reconstruye el marcador gol a gol con una suma acumulada (función de
--     ventana) ordenada por minuto.
WITH marcador AS (
    SELECT r.id_partido, r.numero_fecha, r.equipo_local, r.equipo_visitante,
           r.goles_local, r.goles_visitante, g.minuto,
           SUM(g.id_equipo_beneficiado = r.id_equipo_local)
               OVER (PARTITION BY r.id_partido ORDER BY g.minuto, g.id_gol) AS parcial_local,
           SUM(g.id_equipo_beneficiado = r.id_equipo_visitante)
               OVER (PARTITION BY r.id_partido ORDER BY g.minuto, g.id_gol) AS parcial_visitante
    FROM v_resultado_partido r
    JOIN v_gol_detalle g ON g.id_partido = r.id_partido
    WHERE r.id_torneo = @torneo AND r.estado = 'jugado'
)
SELECT numero_fecha AS fecha,
       CONCAT(equipo_local, ' ', goles_local, ' - ', goles_visitante, ' ', equipo_visitante) AS resultado,
       IF(goles_local > goles_visitante, equipo_local, equipo_visitante) AS remonto,
       MAX(IF(goles_local > goles_visitante,
              parcial_visitante - parcial_local,
              parcial_local - parcial_visitante))                    AS max_desventaja
FROM marcador
GROUP BY id_partido, numero_fecha, equipo_local, equipo_visitante, goles_local, goles_visitante
HAVING goles_local <> goles_visitante AND max_desventaja > 0
ORDER BY max_desventaja DESC, fecha;


-- 11. en qué momento del partido se hacen los goles?
SELECT CONCAT(LPAD(franja * 10, 2, '0'), '-', IF(franja = 5, '60', LPAD(franja * 10 + 9, 2, '0')), '''') AS franja,
       COUNT(*) AS goles,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS porcentaje
FROM (SELECT LEAST(FLOOR(minuto / 10), 5) AS franja   -- el 60' cae en la última franja
      FROM v_gol_detalle WHERE id_torneo = @torneo) x
GROUP BY franja
ORDER BY franja;


-- 12. RACHA: resultados de los últimos 3 partidos de cada equipo (G/E/P),
--     del más reciente al más viejo, junto con su posición actual.
WITH ultimos AS (
    SELECT pe.id_equipo,
           CASE WHEN pe.gf > pe.gc THEN 'G' WHEN pe.gf = pe.gc THEN 'E' ELSE 'P' END AS res,
           pe.dia, pe.id_turno,
           ROW_NUMBER() OVER (PARTITION BY pe.id_equipo ORDER BY pe.dia DESC, pe.id_turno DESC) AS n
    FROM v_partido_equipo pe
    WHERE pe.id_torneo = @torneo
)
SELECT tp.equipo,
       COALESCE(GROUP_CONCAT(u.res ORDER BY u.n SEPARATOR ' '), '-') AS ultimos_3,
       COALESCE(SUM(CASE u.res WHEN 'G' THEN 3 WHEN 'E' THEN 1 ELSE 0 END), 0) AS puntos_ultimos_3,
       tp.pts AS puntos_totales
FROM v_tabla_posiciones tp
LEFT JOIN ultimos u ON u.id_equipo = tp.id_equipo AND u.n <= 3
WHERE tp.id_torneo = @torneo
GROUP BY tp.id_equipo, tp.equipo, tp.pts
ORDER BY puntos_ultimos_3 DESC, tp.pts DESC;


-- CONSULTAS PARA DEFENSA

-- Jugadores suspendidos para una fecha (lo que ve el planillero)
SET @fecha = 4;
SELECT jugador, equipo, motivo, desde_fecha, hasta_fecha
FROM v_sanciones
WHERE id_torneo = @torneo AND @fecha BETWEEN desde_fecha AND hasta_fecha;

-- Historial de correcciones de resultados
SELECT a.fecha_hora, a.usuario, a.id_partido, a.tabla, a.accion, a.detalle
FROM auditoria_resultado a
ORDER BY a.fecha_hora DESC;

-- Ejemplo de corrección auditada (descomentar para probar): el partido 8 se
-- jugó ayer, así que todavía está dentro de las 48 h. Un partido de la fecha 1
-- o 2 daría error.
-- SET @usuario_app = 'admin@ucu.edu.uy';
-- UPDATE gol SET minuto = 21 WHERE id_partido = 8 AND minuto = 20;
-- SELECT * FROM auditoria_resultado;
