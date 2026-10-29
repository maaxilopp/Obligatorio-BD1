-- PROCEDIMIENTOS DEL OBLIGATORIO
--   marcar_jugado     : el planillero cierra la planilla sin tener permiso
--                       de UPDATE sobre la tabla partido, marcandolo como jugado.
--   generar_fixture   : arma automáticamente todo el fixture de una edición
--                       y asigna cancha y turno libres.
--

SET NAMES utf8mb4;
USE torneo_futbol5;

DELIMITER //

-- Marca un partido como jugado.  se ejecuta con los
-- permisos de quien lo creó, así el planillero puede cerrar la planilla
--  pero no puede cambiar otras columnas de partido ni cancelarlo.
CREATE PROCEDURE marcar_jugado(IN p_id_partido INT)
SQL SECURITY DEFINER
BEGIN
    IF NOT EXISTS (SELECT 1 FROM partido WHERE id_partido = p_id_partido) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El partido no existe';
    END IF;
    IF (SELECT estado FROM partido WHERE id_partido = p_id_partido) <> 'programado' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo un partido programado puede marcarse como jugado';
    END IF;
    UPDATE partido SET estado = 'jugado' WHERE id_partido = p_id_partido;
END //


--  Utilizamos round-robin.
--
-- Con n equipos (si n es impar se agrega un "libre"), se fija el equipo de
-- la posición 0 y el resto rota una posición por fecha. En cada fecha se
-- enfrentan la posición i con la posición n-1-i. Así se obtienen n-1 fechas
-- donde todos se cruzan una única vez y nadie juega dos veces en la misma fecha.
--
-- Cada fecha se juega una semana después de la anterior. A cada partido se
-- le asigna el primer par (cancha, turno) libre de ese día, recorriendo los
-- turnos en orden. Si no queda lugar, se aborta todo con un error.
--
-- Uso:  CALL generar_fixture(<id_torneo>, '<dia de la fecha 1>');
CREATE PROCEDURE generar_fixture(IN p_id_torneo INT, IN p_primer_dia DATE)
BEGIN
    DECLARE v_n        INT;
    DECLARE v_ronda    INT DEFAULT 0;
    DECLARE v_i        INT;
    DECLARE v_pos_a    INT;
    DECLARE v_pos_b    INT;
    DECLARE v_eq_a     INT;
    DECLARE v_eq_b     INT;
    DECLARE v_dia      DATE;
    DECLARE v_complejo INT;
    DECLARE v_cancha   VARCHAR(50);
    DECLARE v_turno    TINYINT;

    IF NOT EXISTS (SELECT 1 FROM torneo WHERE id_torneo = p_id_torneo) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El torneo no existe';
    END IF;

    IF EXISTS (SELECT 1 FROM partido
               WHERE id_torneo = p_id_torneo AND estado <> 'cancelado') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El torneo ya tiene partidos: el fixture solo se genera sobre un torneo vacío';
    END IF;

    -- NULL representa "fecha libre".
    DROP TEMPORARY TABLE IF EXISTS tmp_fixture;
    CREATE TEMPORARY TABLE tmp_fixture (pos INT PRIMARY KEY, id_equipo INT NULL);

    INSERT INTO tmp_fixture (pos, id_equipo)
    SELECT ROW_NUMBER() OVER (ORDER BY id_equipo) - 1, id_equipo
    FROM equipo WHERE id_torneo = p_id_torneo;

    SELECT COUNT(*) INTO v_n FROM tmp_fixture;
    IF v_n < 2 THEN
        DROP TEMPORARY TABLE tmp_fixture;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Se necesitan al menos 2 equipos para generar el fixture';
    END IF;
    IF MOD(v_n, 2) = 1 THEN
        INSERT INTO tmp_fixture VALUES (v_n, NULL);
        SET v_n = v_n + 1;
    END IF;

    WHILE v_ronda < v_n - 1 DO
        SET v_dia = p_primer_dia + INTERVAL (7 * v_ronda) DAY;
        SET v_i = 0;

        WHILE v_i < v_n / 2 DO

            SET v_pos_a = IF(v_i = 0, 0, MOD(v_i - 1 + v_ronda, v_n - 1) + 1);
            SET v_pos_b = MOD(v_n - 1 - v_i - 1 + v_ronda, v_n - 1) + 1;

            SET v_eq_a = (SELECT id_equipo FROM tmp_fixture WHERE pos = v_pos_a);
            SET v_eq_b = (SELECT id_equipo FROM tmp_fixture WHERE pos = v_pos_b);

            IF v_eq_a IS NOT NULL AND v_eq_b IS NOT NULL THEN
      
                SET v_complejo = NULL;
                SELECT c.id_complejo, c.nombre_cancha, t.id_turno
                  INTO v_complejo, v_cancha, v_turno
                FROM cancha c CROSS JOIN turno t
                WHERE NOT EXISTS (
                    SELECT 1 FROM partido p
                    WHERE p.id_complejo   = c.id_complejo
                      AND p.nombre_cancha = c.nombre_cancha
                      AND p.dia           = v_dia
                      AND p.id_turno      = t.id_turno
                      AND p.estado NOT IN ('cancelado', 'postergado'))
                ORDER BY t.id_turno, c.id_complejo, c.nombre_cancha
                LIMIT 1;

                IF v_complejo IS NULL THEN
                    DROP TEMPORARY TABLE tmp_fixture;
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'No hay canchas y turnos libres suficientes para generar el fixture';
                END IF;

                INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante,
                                     dia, id_turno, id_complejo, nombre_cancha)
                VALUES (p_id_torneo, v_ronda + 1,
                        IF(MOD(v_ronda, 2) = 0, v_eq_a, v_eq_b),
                        IF(MOD(v_ronda, 2) = 0, v_eq_b, v_eq_a),
                        v_dia, v_turno, v_complejo, v_cancha);
            END IF;

            SET v_i = v_i + 1;
        END WHILE;

        SET v_ronda = v_ronda + 1;
    END WHILE;

    DROP TEMPORARY TABLE tmp_fixture;
END //

DELIMITER ;
