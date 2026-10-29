-- USUARIOS DE BASE DE DATOS CON PERMISOS DIFERENCIADOS
--
--   torneo_admin     : el backend lo usa cuando el usuario logueado es administrador.
--                       Lee y modifica todas las tablas de negocio.
--   torneo_planillero : el backend lo usa cuando el usuario logueado es planillero.
--                       Lee todo (menos login y auditoría), y solo escribe en
--                       planilla_partido, gol y tarjeta. Cierra el partido con
--                       CALL marcar_jugado(id), no con UPDATE.
--   torneo_auth       : solo lee la tabla login, para validar el inicio de sesión
--                       antes de saber el rol.
--
--   Nadie (salvo root) puede modificar auditoria_resultado: la escriben los
--   triggers, que se ejecutan con los permisos correspondientes.
--   Las sanciones automáticas también las inserta un trigger, por eso el
--   planillero no necesita permiso sobre sancion_jugador.
--
--   Las contraseñas son de desarrollo


USE torneo_futbol5;

DROP USER IF EXISTS 'torneo_admin'@'%', 'torneo_planillero'@'%', 'torneo_auth'@'%';

CREATE USER 'torneo_admin'@'%'      IDENTIFIED BY 'Admin.Torneo2026';
CREATE USER 'torneo_planillero'@'%' IDENTIFIED BY 'Planillero.Torneo2026';
CREATE USER 'torneo_auth'@'%'       IDENTIFIED BY 'Auth.Torneo2026';

-- Administrador: ABM completo sobre las tablas de negocio
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.login                 TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.facultad              TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.jugador               TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.torneo                TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.equipo                TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.equipo_jugador_torneo TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.complejo              TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.cancha                TO 'torneo_admin'@'%';
GRANT SELECT                         ON torneo_futbol5.turno                 TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.partido               TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.planilla_partido      TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.gol                   TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.tarjeta               TO 'torneo_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.sancion_jugador       TO 'torneo_admin'@'%';
GRANT SELECT                         ON torneo_futbol5.auditoria_resultado   TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_gol_detalle       TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_resultado_partido TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_partido_equipo    TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_tabla_posiciones  TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_goleadores        TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_fair_play         TO 'torneo_admin'@'%';
GRANT SELECT ON torneo_futbol5.v_sanciones         TO 'torneo_admin'@'%';
GRANT EXECUTE ON PROCEDURE torneo_futbol5.marcar_jugado   TO 'torneo_admin'@'%';
GRANT EXECUTE ON PROCEDURE torneo_futbol5.generar_fixture TO 'torneo_admin'@'%';
-- generar_fixture usa una tabla temporal
GRANT CREATE TEMPORARY TABLES ON torneo_futbol5.* TO 'torneo_admin'@'%';

-- Planillero: lee lo necesario para armar la planilla, escribe solo la planilla
GRANT SELECT ON torneo_futbol5.facultad              TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.jugador               TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.torneo                TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.equipo                TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.equipo_jugador_torneo TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.complejo              TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.cancha                TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.turno                 TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.partido               TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.sancion_jugador       TO 'torneo_planillero'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.planilla_partido TO 'torneo_planillero'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.gol              TO 'torneo_planillero'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON torneo_futbol5.tarjeta          TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.v_gol_detalle       TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.v_resultado_partido TO 'torneo_planillero'@'%';
GRANT SELECT ON torneo_futbol5.v_sanciones         TO 'torneo_planillero'@'%';
GRANT EXECUTE ON PROCEDURE torneo_futbol5.marcar_jugado TO 'torneo_planillero'@'%';

-- Autenticación: solo leer login
GRANT SELECT ON torneo_futbol5.login TO 'torneo_auth'@'%';

FLUSH PRIVILEGES;
