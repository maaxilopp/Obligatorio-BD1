--  TRIGGERS DEL OBLIGATORIO : reglas de negocio que no se pueden expresar con
--  constraints (PK, FK, UNIQUE, CHECK) y se validan con triggers.
--
--  Todos los errores se lanzan con SIGNAL SQLSTATE '45000' y un mensaje
--  en español, para que el backend lo muestre tal cual al usuario.
--
--  IMPORTANTE: las reglas de horario usan NOW(), que depende de la zona
--  horaria de la SESIÓN. Toda conexión (backend, DataGrip, tests) debe hacer
--      SET time_zone = '-03:00';
--  Uruguay no tiene horario de verano, así que el offset fijo alcanza y no
--  hace falta cargar las tablas de zonas horarias en MySQL.

SET NAMES utf8mb4;   -- los mensajes de error tienen tildes
USE torneo_futbol5;

DELIMITER //

-- Funciones y procedimientos auxiliares, los creamos para no repetir código en los triggers
-- Momento en que termina un partido: su día y hora de fin del turno
CREATE FUNCTION fin_partido(p_dia DATE, p_id_turno TINYINT)
RETURNS DATETIME
READS SQL DATA
BEGIN
    RETURN (SELECT TIMESTAMP(p_dia, hora_fin) FROM turno WHERE id_turno = p_id_turno);
END //

-- Registra una corrección en auditoria_resultado, solo si el partido ya
-- está marcado como jugado (ver sección AUDITORÍA al final).
CREATE PROCEDURE registrar_auditoria(
    IN p_id_partido INT, IN p_tabla VARCHAR(20), IN p_accion VARCHAR(20), IN p_detalle VARCHAR(255))
BEGIN
    IF (SELECT estado FROM partido WHERE id_partido = p_id_partido) = 'jugado' THEN
        INSERT INTO auditoria_resultado (id_partido, tabla, accion, detalle, usuario)
        VALUES (p_id_partido, p_tabla, p_accion, p_detalle, COALESCE(@usuario_app, USER()));
    END IF;
END //

-- Al borrar una amarilla (corrección), el jugador puede quedar con menos
-- amarillas de las que justifican sus sanciones por acumulación. Ejemplo:
-- tenía 2, se le cargan 2 más por error (la 3ra genera sanción) y se borra la
-- equivocada: queda con 3... o con 2 si se borra otra. Debe tener exactamente
-- FLOOR(amarillas / 3) sanciones por acumulación; si sobran, se borran las
-- más recientes. (Si se borra justo la tarjeta que originó la sanción, el
-- ON DELETE CASCADE ya la borró y acá no sobra nada.)
CREATE PROCEDURE recalcular_sanciones_amarillas(IN p_ci VARCHAR(8), IN p_id_partido INT)
BEGIN
    DECLARE v_torneo    INT;
    DECLARE v_amarillas INT;
    DECLARE v_sobrantes INT;

    SELECT id_torneo INTO v_torneo FROM partido WHERE id_partido = p_id_partido;

    SELECT COUNT(*) INTO v_amarillas
    FROM tarjeta t JOIN partido p ON p.id_partido = t.id_partido
    WHERE t.ci_jugador = p_ci AND t.color = 'amarilla' AND p.id_torneo = v_torneo;

    SELECT COUNT(*) - FLOOR(v_amarillas / 3) INTO v_sobrantes
    FROM sancion_jugador
    WHERE ci_jugador = p_ci AND id_torneo = v_torneo AND motivo = 'acumulacion de amarillas';

    IF v_sobrantes > 0 THEN
        DELETE FROM sancion_jugador
        WHERE ci_jugador = p_ci AND id_torneo = v_torneo AND motivo = 'acumulacion de amarillas'
        ORDER BY id_sancion DESC
        LIMIT v_sobrantes;
    END IF;
END //

-- Los planteles solo se modifican mientras el torneo está en inscripción
CREATE PROCEDURE validar_plantel_editable(IN p_id_torneo INT)
BEGIN
    IF (SELECT estado FROM torneo WHERE id_torneo = p_id_torneo) <> 'inscripcion' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los planteles solo pueden modificarse mientras el torneo está en etapa de inscripción';
    END IF;
END //

-- Cupos del plantel: máximo 10 jugadores y máximo 2 docentes/funcionarios
CREATE PROCEDURE validar_cupos_plantel(IN p_id_equipo INT, IN p_ci VARCHAR(8))
BEGIN
    IF (SELECT COUNT(*) FROM equipo_jugador_torneo WHERE id_equipo = p_id_equipo) >= 10 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El plantel ya tiene 10 jugadores (máximo permitido)';
    END IF;

    IF (SELECT tipo FROM jugador WHERE ci = p_ci) IN ('docente', 'funcionario')
       AND (SELECT COUNT(*)
            FROM equipo_jugador_torneo ejt
            JOIN jugador j ON j.ci = ejt.ci_jugador
            WHERE ejt.id_equipo = p_id_equipo
              AND j.tipo IN ('docente', 'funcionario')) >= 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El plantel ya tiene 2 docentes/funcionarios (máximo permitido)';
    END IF;
END //

-- Planilla, goles y tarjetas: el partido tiene que haberse disputado, y una
-- vez marcado como jugado solo se corrige dentro de las 48 horas siguientes.
CREATE PROCEDURE validar_carga_planilla(IN p_id_partido INT)
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_fin    DATETIME;

    SELECT estado, fin_partido(dia, id_turno) INTO v_estado, v_fin
    FROM partido WHERE id_partido = p_id_partido;

    IF v_estado IN ('cancelado', 'postergado') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede registrar la planilla de un partido cancelado o postergado';
    END IF;

    IF v_fin > NOW() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El partido todavía no se disputó: la planilla se registra después de su día y turno';
    END IF;

    IF v_estado = 'jugado' AND NOW() > v_fin + INTERVAL 48 HOUR THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pasaron más de 48 horas desde el partido: su resultado ya no puede corregirse';
    END IF;
END //

-- PLANTELES
--   - Solo se modifican los planteles en etapa de inscripción
--   - Máximo 10 jugadores y máximo 2 docentes/funcionarios
--   (el mínimo de 5 se controla al programar partidos, porque mientras
--    se arma el plantel es normal tener menos)
CREATE TRIGGER trg_plantel_bi BEFORE INSERT ON equipo_jugador_torneo
FOR EACH ROW
BEGIN
    CALL validar_plantel_editable(NEW.id_torneo);
    CALL validar_cupos_plantel(NEW.id_equipo, NEW.ci_jugador);
END //

CREATE TRIGGER trg_plantel_bu BEFORE UPDATE ON equipo_jugador_torneo
FOR EACH ROW
BEGIN
    CALL validar_plantel_editable(OLD.id_torneo);
    IF NEW.id_torneo <> OLD.id_torneo THEN
        CALL validar_plantel_editable(NEW.id_torneo);
    END IF;
    -- si el jugador cambia de equipo, el equipo nuevo tiene que tener cupo
    IF NEW.id_equipo <> OLD.id_equipo THEN
        CALL validar_cupos_plantel(NEW.id_equipo, NEW.ci_jugador);
    END IF;
END //

CREATE TRIGGER trg_plantel_bd BEFORE DELETE ON equipo_jugador_torneo
FOR EACH ROW
BEGIN
    CALL validar_plantel_editable(OLD.id_torneo);
END //

-- PARTIDOS
--   - Ambos equipos con al menos 5 jugadores en su plantel
--   - Un equipo no juega más de un partido en la misma fecha del torneo
--     (sin contar partidos cancelados)
--   - Solo se marca como jugado si su día y turno ya pasaron
--   - Un partido jugado no vuelve a otro estado y no se elimina
CREATE PROCEDURE validar_partido(
    IN p_id_partido INT, IN p_id_torneo INT, IN p_numero_fecha TINYINT,
    IN p_local INT, IN p_visitante INT,
    IN p_dia DATE, IN p_id_turno TINYINT, IN p_estado VARCHAR(20))
BEGIN
    DECLARE v_estado_torneo VARCHAR(20);
    DECLARE v_inicio DATE;
    DECLARE v_fin    DATE;

    SELECT estado, fecha_inicio, fecha_fin INTO v_estado_torneo, v_inicio, v_fin
    FROM torneo WHERE id_torneo = p_id_torneo;

    IF v_estado_torneo = 'finalizado' AND p_estado IN ('programado', 'postergado') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El torneo está finalizado: no se pueden programar partidos';
    END IF;

    IF p_dia NOT BETWEEN v_inicio AND v_fin THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El día del partido debe estar dentro de las fechas del torneo';
    END IF;

    IF p_estado <> 'cancelado' THEN
        IF (SELECT COUNT(*) FROM equipo_jugador_torneo WHERE id_equipo = p_local) < 5
           OR (SELECT COUNT(*) FROM equipo_jugador_torneo WHERE id_equipo = p_visitante) < 5 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Ambos equipos deben tener al menos 5 jugadores en su plantel';
        END IF;

        IF EXISTS (SELECT 1 FROM partido p
                   WHERE p.id_torneo = p_id_torneo
                     AND p.numero_fecha = p_numero_fecha
                     AND p.estado <> 'cancelado'
                     AND p.id_partido <> IFNULL(p_id_partido, 0)
                     AND (p.id_equipo_local     IN (p_local, p_visitante)
                       OR p.id_equipo_visitante IN (p_local, p_visitante))) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Uno de los equipos ya tiene un partido en esa fecha del torneo';
        END IF;
    END IF;

    IF p_estado = 'jugado' AND fin_partido(p_dia, p_id_turno) > NOW() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un partido solo puede marcarse como jugado después de su día y turno';
    END IF;

    -- Sin planilla, el partido quedaría 0 a 0 en la tabla de posiciones sin
    -- que nadie lo haya cargado.
    IF p_estado = 'jugado'
       AND (NOT EXISTS (SELECT 1 FROM planilla_partido
                        WHERE id_partido = p_id_partido AND id_equipo = p_local)
            OR NOT EXISTS (SELECT 1 FROM planilla_partido
                           WHERE id_partido = p_id_partido AND id_equipo = p_visitante)) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Antes de marcar el partido como jugado hay que cargar la planilla de ambos equipos';
    END IF;
END //

CREATE TRIGGER trg_partido_bi BEFORE INSERT ON partido
FOR EACH ROW
BEGIN
    CALL validar_partido(NULL, NEW.id_torneo, NEW.numero_fecha,
                         NEW.id_equipo_local, NEW.id_equipo_visitante,
                         NEW.dia, NEW.id_turno, NEW.estado);
END //

CREATE TRIGGER trg_partido_bu BEFORE UPDATE ON partido
FOR EACH ROW
BEGIN
    IF OLD.estado = 'jugado' AND NEW.estado <> 'jugado' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un partido jugado no puede cambiar de estado';
    END IF;

    -- Un partido jugado tampoco se "mueve": sin esto se podía cambiar
    -- el día, el turno, la cancha o hasta los equipos de un partido ya disputado.
    IF OLD.estado = 'jugado' AND NOT (
           NEW.id_torneo           <=> OLD.id_torneo
       AND NEW.numero_fecha        <=> OLD.numero_fecha
       AND NEW.id_equipo_local     <=> OLD.id_equipo_local
       AND NEW.id_equipo_visitante <=> OLD.id_equipo_visitante
       AND NEW.dia                 <=> OLD.dia
       AND NEW.id_turno            <=> OLD.id_turno
       AND NEW.id_complejo         <=> OLD.id_complejo
       AND NEW.nombre_cancha       <=> OLD.nombre_cancha) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un partido jugado no puede modificarse (equipos, fecha, día, turno ni cancha)';
    END IF;

    CALL validar_partido(OLD.id_partido, NEW.id_torneo, NEW.numero_fecha,
                         NEW.id_equipo_local, NEW.id_equipo_visitante,
                         NEW.dia, NEW.id_turno, NEW.estado);
END //

CREATE TRIGGER trg_partido_bd BEFORE DELETE ON partido
FOR EACH ROW
BEGIN
    IF OLD.estado = 'jugado' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un partido jugado no puede eliminarse';
    END IF;
END //

-- 4. PLANILLA DE JUEGO
--   - El partido ya se disputó y no está cancelado ni postergado
--   - El equipo indicado es uno de los dos que juegan ese partido
--   - El jugador no está suspendido en la fecha del partido
--   - Que el jugador sea del plantel de ese equipo ya viene garantizado por nuestro sofisticado manejo de sql
CREATE PROCEDURE validar_jugador_planilla(
    IN p_id_partido INT, IN p_ci VARCHAR(8), IN p_id_equipo INT)
BEGIN
    DECLARE v_torneo INT;
    DECLARE v_fecha  TINYINT;
    DECLARE v_local  INT;
    DECLARE v_visit  INT;

    SELECT id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante
      INTO v_torneo, v_fecha, v_local, v_visit
    FROM partido WHERE id_partido = p_id_partido;

    IF p_id_equipo NOT IN (v_local, v_visit) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El equipo indicado no juega ese partido';
    END IF;

    IF EXISTS (SELECT 1 FROM sancion_jugador s
               WHERE s.ci_jugador = p_ci
                 AND s.id_torneo  = v_torneo
                 AND v_fecha BETWEEN s.numero_fecha_inicio
                                 AND s.numero_fecha_inicio + s.cantidad_fechas - 1) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El jugador está suspendido para esta fecha del torneo';
    END IF;
END //

CREATE TRIGGER trg_planilla_bi BEFORE INSERT ON planilla_partido
FOR EACH ROW
BEGIN
    CALL validar_carga_planilla(NEW.id_partido);
    CALL validar_jugador_planilla(NEW.id_partido, NEW.ci_jugador, NEW.id_equipo);
END //

CREATE TRIGGER trg_planilla_bu BEFORE UPDATE ON planilla_partido
FOR EACH ROW
BEGIN
    CALL validar_carga_planilla(OLD.id_partido);
    CALL validar_carga_planilla(NEW.id_partido);
    CALL validar_jugador_planilla(NEW.id_partido, NEW.ci_jugador, NEW.id_equipo);
END //

CREATE TRIGGER trg_planilla_bd BEFORE DELETE ON planilla_partido
FOR EACH ROW
BEGIN
    CALL validar_carga_planilla(OLD.id_partido);
END //


-- GOLES Y TARJETAS: misma ventana que la planilla (partido disputado,
--    y corrección solo dentro de las 48 horas una vez marcado jugado)

CREATE TRIGGER trg_gol_bi BEFORE INSERT ON gol
FOR EACH ROW CALL validar_carga_planilla(NEW.id_partido) //

CREATE TRIGGER trg_gol_bu BEFORE UPDATE ON gol
FOR EACH ROW
BEGIN
    CALL validar_carga_planilla(OLD.id_partido);
    CALL validar_carga_planilla(NEW.id_partido);
END //

CREATE TRIGGER trg_gol_bd BEFORE DELETE ON gol
FOR EACH ROW CALL validar_carga_planilla(OLD.id_partido) //

CREATE TRIGGER trg_tarjeta_bi BEFORE INSERT ON tarjeta
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM planilla_partido
        WHERE id_partido = NEW.id_partido
          AND ci_jugador = NEW.ci_jugador
    ) THEN
        SIGNAL SQLSTATE '23000'
            SET MYSQL_ERRNO = 1452,
                MESSAGE_TEXT = 'El jugador no figura en la planilla del partido';
    END IF;

    CALL validar_carga_planilla(NEW.id_partido);
END//

CREATE TRIGGER trg_tarjeta_bu BEFORE UPDATE ON tarjeta
FOR EACH ROW
BEGIN
    -- Las sanciones automáticas se calculan al insertar la tarjeta. Si se
    -- cambiara el color o el jugador con un UPDATE, la sanción quedaría mal
    -- (ej: una amarilla corregida a roja no generaba suspensión). Por eso solo
    -- se puede corregir el minuto; lo demás se corrige borrando y recargando.
    IF NOT (NEW.color <=> OLD.color AND NEW.ci_jugador <=> OLD.ci_jugador
            AND NEW.id_partido <=> OLD.id_partido) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Para cambiar el jugador o el color de una tarjeta, eliminala y cargala de nuevo';
    END IF;
    CALL validar_carga_planilla(OLD.id_partido);
    CALL validar_carga_planilla(NEW.id_partido);
END //

CREATE TRIGGER trg_tarjeta_bd BEFORE DELETE ON tarjeta
FOR EACH ROW CALL validar_carga_planilla(OLD.id_partido) //


-- SANCIONES AUTOMÁTICAS
--   - Tarjeta roja: 1 fecha de suspensión, en la fecha siguiente
--   - Cada 3 amarillas acumuladas en la edición: 1 fecha, en la siguiente
--   La sanción guarda la tarjeta que la originó (id_tarjeta); si esa
--   tarjeta se borra, la sanción se borra con ella, delete en cascada.
CREATE TRIGGER trg_tarjeta_ai AFTER INSERT ON tarjeta
FOR EACH ROW
BEGIN
    DECLARE v_torneo     INT;
    DECLARE v_fecha      TINYINT;
    DECLARE v_amarillas  INT;

    SELECT id_torneo, numero_fecha INTO v_torneo, v_fecha
    FROM partido WHERE id_partido = NEW.id_partido;

    IF NEW.color = 'roja' THEN
        INSERT INTO sancion_jugador
            (ci_jugador, id_torneo, motivo, numero_fecha_inicio, cantidad_fechas, id_tarjeta, descripcion)
        VALUES
            (NEW.ci_jugador, v_torneo, 'roja', v_fecha + 1, 1, NEW.id_tarjeta,
             'Sanción automática por tarjeta roja');
    ELSE
        SELECT COUNT(*) INTO v_amarillas
        FROM tarjeta t
        JOIN partido p ON p.id_partido = t.id_partido
        WHERE t.ci_jugador = NEW.ci_jugador
          AND t.color = 'amarilla'
          AND p.id_torneo = v_torneo;

        IF MOD(v_amarillas, 3) = 0 THEN
            INSERT INTO sancion_jugador
                (ci_jugador, id_torneo, motivo, numero_fecha_inicio, cantidad_fechas, id_tarjeta, descripcion)
            VALUES
                (NEW.ci_jugador, v_torneo, 'acumulacion de amarillas', v_fecha + 1, 1, NEW.id_tarjeta,
                 CONCAT('Sanción automática por acumular ', v_amarillas, ' amarillas'));
        END IF;
    END IF;

    CALL registrar_auditoria(NEW.id_partido, 'tarjeta', 'alta',
        CONCAT('Tarjeta ', NEW.color, ' a CI ', NEW.ci_jugador, ' (min ', NEW.minuto, ')'));
END //


-- ESTADO DEL TORNEO
--   Solo avanza: inscripcion -> en curso -> finalizado.
--   Sin esto, se podía volver a 'inscripcion' con partidos jugados y
--   modificar los planteles (lo probamos: un equipo quedaba con 4 jugadores).
CREATE TRIGGER trg_torneo_bu BEFORE UPDATE ON torneo
FOR EACH ROW
BEGIN
    DECLARE v_incompleto VARCHAR(50);
    DECLARE v_msg        VARCHAR(200);

    IF NEW.estado <> OLD.estado
       AND NOT ((OLD.estado = 'inscripcion' AND NEW.estado = 'en curso')
             OR (OLD.estado = 'en curso'    AND NEW.estado = 'finalizado')) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El estado del torneo solo avanza: inscripción, en curso, finalizado';
    END IF;

    -- Al cerrar la inscripción los planteles quedan fijos, así que tienen que
    -- estar completos: al menos 2 equipos, cada uno con capitán y con 5 a 10
    -- jugadores (el máximo ya lo controla el trigger del plantel).
    IF OLD.estado = 'inscripcion' AND NEW.estado = 'en curso' THEN
        IF (SELECT COUNT(*) FROM equipo WHERE id_torneo = NEW.id_torneo) < 2 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Para iniciar el torneo se necesitan al menos 2 equipos';
        END IF;

        SET v_incompleto = (
            SELECT e.nombre FROM equipo e
            WHERE e.id_torneo = NEW.id_torneo
              AND (e.ci_capitan IS NULL
                   OR (SELECT COUNT(*) FROM equipo_jugador_torneo ejt
                       WHERE ejt.id_equipo = e.id_equipo) < 5)
            ORDER BY e.nombre LIMIT 1);
        IF v_incompleto IS NOT NULL THEN
            SET v_msg = CONCAT('El equipo "', v_incompleto,
                              '" necesita capitán y al menos 5 jugadores para iniciar el torneo');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
        END IF;
    END IF;
END //


-- AUDITORÍA DE CORRECCIONES
--   Si el partido ya está marcado como jugado, cualquier cambio en su
--   planilla, goles o tarjetas es una corrección de resultado: se registra
--   quién la hizo y qué cambió. (La carga inicial, con el partido todavía
--   'programado', no se audita.)
CREATE TRIGGER trg_gol_ai AFTER INSERT ON gol
FOR EACH ROW
    CALL registrar_auditoria(NEW.id_partido, 'gol', 'alta',
        CONCAT(IF(NEW.autogol, 'Autogol', 'Gol'), ' de CI ', NEW.ci_jugador, ' (min ', NEW.minuto, ')')) //

CREATE TRIGGER trg_gol_au AFTER UPDATE ON gol
FOR EACH ROW
    CALL registrar_auditoria(NEW.id_partido, 'gol', 'modificacion',
        CONCAT('Gol ', OLD.id_gol, ': CI ', OLD.ci_jugador, ' min ', OLD.minuto,
               ' -> CI ', NEW.ci_jugador, ' min ', NEW.minuto)) //

CREATE TRIGGER trg_gol_ad AFTER DELETE ON gol
FOR EACH ROW
    CALL registrar_auditoria(OLD.id_partido, 'gol', 'baja',
        CONCAT('Se eliminó gol de CI ', OLD.ci_jugador, ' (min ', OLD.minuto, ')')) //

CREATE TRIGGER trg_tarjeta_au AFTER UPDATE ON tarjeta
FOR EACH ROW
    CALL registrar_auditoria(NEW.id_partido, 'tarjeta', 'modificacion',
        CONCAT('Tarjeta ', OLD.id_tarjeta, ': ', OLD.color, ' min ', OLD.minuto,
               ' -> ', NEW.color, ' min ', NEW.minuto)) //

CREATE TRIGGER trg_tarjeta_ad AFTER DELETE ON tarjeta
FOR EACH ROW
BEGIN
    IF OLD.color = 'amarilla' THEN
        CALL recalcular_sanciones_amarillas(OLD.ci_jugador, OLD.id_partido);
    END IF;
    CALL registrar_auditoria(OLD.id_partido, 'tarjeta', 'baja',
        CONCAT('Se eliminó tarjeta ', OLD.color, ' de CI ', OLD.ci_jugador));
END //

CREATE TRIGGER trg_planilla_ai AFTER INSERT ON planilla_partido
FOR EACH ROW
    CALL registrar_auditoria(NEW.id_partido, 'planilla_partido', 'alta',
        CONCAT('Se agregó CI ', NEW.ci_jugador, ' (equipo ', NEW.id_equipo, ')')) //

CREATE TRIGGER trg_planilla_ad AFTER DELETE ON planilla_partido
FOR EACH ROW
    CALL registrar_auditoria(OLD.id_partido, 'planilla_partido', 'baja',
        CONCAT('Se quitó CI ', OLD.ci_jugador, ' (equipo ', OLD.id_equipo, ')')) //

DELIMITER ;