-- VISTAS DEL OBLIGATORIO
-- Centralizan los cálculos que usan varios reportes y el backend
-- (resultado de cada partido, tabla de posiciones, etc.), así la lógica
-- vive en un solo lugar. El backend hace SELECT sobre estas vistas filtrando

SET NAMES utf8mb4;
USE torneo_futbol5;

-- Gol con el equipo que lo convirtió y el equipo al que se le suma.
-- Un autogol se le suma al rival del jugador.
CREATE OR REPLACE VIEW v_gol_detalle AS
SELECT g.id_gol,
       g.id_partido,
       p.id_torneo,
       p.numero_fecha,
       g.ci_jugador,
       g.minuto,
       g.autogol,
       pp.id_equipo AS id_equipo_jugador,
       IF(g.autogol,
          IF(pp.id_equipo = p.id_equipo_local, p.id_equipo_visitante, p.id_equipo_local),
          pp.id_equipo) AS id_equipo_beneficiado
FROM gol g
JOIN partido p           ON p.id_partido = g.id_partido
JOIN planilla_partido pp ON pp.id_partido = g.id_partido AND pp.ci_jugador = g.ci_jugador;
-- resultado de partidos
CREATE OR REPLACE VIEW v_resultado_partido AS
SELECT p.id_partido,
       p.id_torneo,
       p.numero_fecha,
       p.dia,
       p.id_turno,
       p.id_complejo,
       p.nombre_cancha,
       p.estado,
       p.id_equipo_local,
       el.nombre AS equipo_local,
       p.id_equipo_visitante,
       ev.nombre AS equipo_visitante,
       COALESCE(SUM(gd.id_equipo_beneficiado = p.id_equipo_local), 0)     AS goles_local,
       COALESCE(SUM(gd.id_equipo_beneficiado = p.id_equipo_visitante), 0) AS goles_visitante
FROM partido p
JOIN equipo el ON el.id_equipo = p.id_equipo_local
JOIN equipo ev ON ev.id_equipo = p.id_equipo_visitante
LEFT JOIN v_gol_detalle gd ON gd.id_partido = p.id_partido
GROUP BY p.id_partido;

CREATE OR REPLACE VIEW v_partido_equipo AS
SELECT id_partido, id_torneo, numero_fecha, dia, id_turno,
       id_equipo_local AS id_equipo, goles_local AS gf, goles_visitante AS gc
FROM v_resultado_partido WHERE estado = 'jugado'
UNION ALL
SELECT id_partido, id_torneo, numero_fecha, dia, id_turno,
       id_equipo_visitante, goles_visitante, goles_local
FROM v_resultado_partido WHERE estado = 'jugado';

-- REPORTE 1: tabla de posiciones. Incluye equipos que todavía no jugaron.
-- Orden: puntos, diferencia de goles, goles a favor.
CREATE OR REPLACE VIEW v_tabla_posiciones AS
SELECT e.id_torneo,
       e.id_equipo,
       e.nombre                                   AS equipo,
       f.nombre                                   AS facultad,
       COUNT(pe.id_partido)                       AS pj,
       COALESCE(SUM(pe.gf > pe.gc), 0)            AS pg,
       COALESCE(SUM(pe.gf = pe.gc), 0)            AS pe,
       COALESCE(SUM(pe.gf < pe.gc), 0)            AS pp,
       COALESCE(SUM(pe.gf), 0)                    AS gf,
       COALESCE(SUM(pe.gc), 0)                    AS gc,
       COALESCE(SUM(pe.gf), 0) - COALESCE(SUM(pe.gc), 0) AS dg,
       COALESCE(SUM(CASE WHEN pe.gf > pe.gc THEN 3
                         WHEN pe.gf = pe.gc THEN 1
                         ELSE 0 END), 0)          AS pts
FROM equipo e
JOIN facultad f ON f.id_facultad = e.id_facultad
LEFT JOIN v_partido_equipo pe ON pe.id_equipo = e.id_equipo
GROUP BY e.id_torneo, e.id_equipo, e.nombre, f.nombre;

-- REPORTE 2: goleadores sin contar autogoles.
CREATE OR REPLACE VIEW v_goleadores AS
SELECT gd.id_torneo,
       j.ci,
       CONCAT(j.nombre, ' ', j.apellido) AS jugador,
       e.nombre                          AS equipo,
       COUNT(*)                          AS goles
FROM v_gol_detalle gd
JOIN jugador j ON j.ci = gd.ci_jugador
JOIN equipo e  ON e.id_equipo = gd.id_equipo_jugador
WHERE NOT gd.autogol
GROUP BY gd.id_torneo, j.ci, j.nombre, j.apellido, e.nombre;

-- REPORTE 3: fair play (1 punto por amarilla, 3 por roja; menor es mejor).
-- Incluye a los equipos sin tarjetas
CREATE OR REPLACE VIEW v_fair_play AS
SELECT e.id_torneo,
       e.id_equipo,
       e.nombre                                    AS equipo,
       COALESCE(SUM(t.color = 'amarilla'), 0)      AS amarillas,
       COALESCE(SUM(t.color = 'roja'), 0)          AS rojas,
       COALESCE(SUM(CASE t.color WHEN 'amarilla' THEN 1
                                 WHEN 'roja'     THEN 3 END), 0) AS puntaje
FROM equipo e
LEFT JOIN planilla_partido pp ON pp.id_equipo = e.id_equipo
LEFT JOIN tarjeta t           ON t.id_partido = pp.id_partido AND t.ci_jugador = pp.ci_jugador
GROUP BY e.id_torneo, e.id_equipo, e.nombre;

-- Sanciones con el rango de fechas que abarcan y el equipo del jugador.
-- La pantalla de la planilla la usa para mostrar a los suspendidos.
CREATE OR REPLACE VIEW v_sanciones AS
SELECT s.id_sancion,
       s.id_torneo,
       s.ci_jugador,
       CONCAT(j.nombre, ' ', j.apellido)              AS jugador,
       ejt.id_equipo,
       e.nombre                                       AS equipo,
       s.motivo,
       s.numero_fecha_inicio                          AS desde_fecha,
       s.numero_fecha_inicio + s.cantidad_fechas - 1  AS hasta_fecha,
       s.cantidad_fechas,
       s.descripcion
FROM sancion_jugador s
JOIN jugador j                  ON j.ci = s.ci_jugador
JOIN equipo_jugador_torneo ejt  ON ejt.ci_jugador = s.ci_jugador AND ejt.id_torneo = s.id_torneo
JOIN equipo e                   ON e.id_equipo = ejt.id_equipo;
