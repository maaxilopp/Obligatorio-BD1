-- SCHEMA DEL OBLIGATORIO 
-- contiene la base de datos, las 14 tablas usadas con sus columnas con sus respectivos tipos de datos,
-- las llaves primarias y foráneas, y las restricciones.
-- Lo único que carga con datos son los 5 turnos (de 18 a 23), porque son fijos.
SET NAMES utf8mb4;    -- tildess

DROP DATABASE IF EXISTS torneo_futbol5;
CREATE DATABASE torneo_futbol5 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE torneo_futbol5;

-- Usuarios de la aplicación

CREATE TABLE login (
    correo      VARCHAR(100) PRIMARY KEY,
    contrasena  VARCHAR(255) NOT NULL,          -- hash, nunca texto plano
    rol         ENUM('administrador','planillero') NOT NULL,
    CONSTRAINT chk_login_correo CHECK (correo REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$')
);

-- Facultades y jugadores

CREATE TABLE facultad (
    id_facultad INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE jugador (
    ci               VARCHAR(8)   PRIMARY KEY,
    nombre           VARCHAR(50)  NOT NULL,
    apellido         VARCHAR(50)  NOT NULL,
    email            VARCHAR(100) NOT NULL UNIQUE,
    fecha_nacimiento DATE         NOT NULL,
    id_facultad      INT          NOT NULL,
    tipo             ENUM('grado','posgrado','docente','funcionario') NOT NULL,
    UNIQUE KEY uq_jugador_facultad (ci, id_facultad), -- clave candidata para usar en otras tablas
    CONSTRAINT fk_jugador_facultad FOREIGN KEY (id_facultad) REFERENCES facultad(id_facultad),
    CONSTRAINT chk_jugador_ci     CHECK (ci REGEXP '^[0-9]{7,8}$'),
    CONSTRAINT chk_jugador_email  CHECK (email REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$'),
    CONSTRAINT chk_jugador_nombre CHECK (TRIM(nombre) <> '' AND TRIM(apellido) <> '')
);

-- Torneo, equipos y planteles
CREATE TABLE torneo (
    id_torneo    INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    anio         SMALLINT     NOT NULL,
    semestre     TINYINT      NOT NULL, -- 1 o 2, por eficiencia se guarda como TINYINT. 
    fecha_inicio DATE         NOT NULL,
    fecha_fin    DATE         NOT NULL,
    estado       ENUM('inscripcion','en curso','finalizado') NOT NULL DEFAULT 'inscripcion',
    UNIQUE KEY uq_torneo_edicion (anio, semestre),          -- una edición por semestre
    CONSTRAINT chk_torneo_semestre CHECK (semestre IN (1, 2)),
    CONSTRAINT chk_torneo_fechas   CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_torneo_anio     CHECK (YEAR(fecha_inicio) = anio)
);

CREATE TABLE equipo (
    id_equipo   INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    id_torneo   INT         NOT NULL,
    id_facultad INT         NOT NULL,
    ci_capitan  VARCHAR(8)  NULL,   -- NULL hasta cargar el plantel, luego se asigna
    UNIQUE KEY uq_equipo_nombre (id_torneo, nombre),
    -- claves candidatas para usar en otras tablas
    UNIQUE KEY uq_equipo_torneo          (id_equipo, id_torneo),
    UNIQUE KEY uq_equipo_torneo_facultad (id_equipo, id_torneo, id_facultad),
    CONSTRAINT fk_equipo_torneo   FOREIGN KEY (id_torneo)   REFERENCES torneo(id_torneo),
    CONSTRAINT fk_equipo_facultad FOREIGN KEY (id_facultad) REFERENCES facultad(id_facultad)
);

CREATE TABLE equipo_jugador_torneo (
    id_equipo       INT        NOT NULL,
    ci_jugador      VARCHAR(8) NOT NULL,
    id_torneo       INT        NOT NULL,
    id_facultad     INT        NOT NULL,   -- para garantizar que el jugador sea de la misma facultad que el equipo.
    numero_camiseta TINYINT    NOT NULL, -- entre 1 y 99
    PRIMARY KEY (id_equipo, ci_jugador),
    UNIQUE KEY uq_jugador_un_equipo_por_torneo (ci_jugador, id_torneo),
    UNIQUE KEY uq_camiseta (id_equipo, numero_camiseta), 
    -- el equipo pertenece a ese torneo y a esa facultad
    CONSTRAINT fk_ejt_equipo FOREIGN KEY (id_equipo, id_torneo, id_facultad)
        REFERENCES equipo(id_equipo, id_torneo, id_facultad),
    -- el jugador pertenece a esa facultad
    CONSTRAINT fk_ejt_jugador FOREIGN KEY (ci_jugador, id_facultad)
        REFERENCES jugador(ci, id_facultad),
    CONSTRAINT chk_camiseta CHECK (numero_camiseta BETWEEN 1 AND 99)
);

-- El capitán debe ser jugador del plantel, pero no se puede poner la restricción de foreign key directamente porque el capitán se asigna después de cargar el plantel.
ALTER TABLE equipo
    ADD CONSTRAINT fk_equipo_capitan FOREIGN KEY (id_equipo, ci_capitan)
        REFERENCES equipo_jugador_torneo(id_equipo, ci_jugador);


-- Infraestructura
CREATE TABLE complejo (
    id_complejo  INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    direccion    VARCHAR(150) NOT NULL,
    departamento ENUM('Artigas','Canelones','Cerro Largo','Colonia','Durazno','Flores',
                      'Florida','Lavalleja','Maldonado','Montevideo','Paysandú',
                      'Río Negro','Rivera','Rocha','Salto','San José','Soriano',
                      'Tacuarembó','Treinta y Tres') NOT NULL
);

CREATE TABLE cancha (
    id_complejo   INT         NOT NULL,
    nombre_cancha VARCHAR(50) NOT NULL,
    superficie    ENUM('sintetico','parquet') NOT NULL,
    techada       BOOLEAN     NOT NULL,
    PRIMARY KEY (id_complejo, nombre_cancha),
    CONSTRAINT fk_cancha_complejo FOREIGN KEY (id_complejo) REFERENCES complejo(id_complejo)
);

CREATE TABLE turno (
    id_turno    TINYINT AUTO_INCREMENT PRIMARY KEY,
    hora_inicio TIME NOT NULL UNIQUE,
    hora_fin    TIME NOT NULL,
    CONSTRAINT chk_turno_rango    CHECK (hora_inicio >= '18:00:00' AND hora_fin <= '23:00:00'),
    CONSTRAINT chk_turno_una_hora CHECK (TIMEDIFF(hora_fin, hora_inicio) = '01:00:00'
                                         AND MINUTE(hora_inicio) = 0)
);

-- Partidos

CREATE TABLE partido (
    id_partido          INT AUTO_INCREMENT PRIMARY KEY,
    id_torneo           INT         NOT NULL,
    numero_fecha        TINYINT     NOT NULL,
    id_equipo_local     INT         NOT NULL,
    id_equipo_visitante INT         NOT NULL,
    dia                 DATE        NOT NULL,
    id_turno            TINYINT     NOT NULL,
    id_complejo         INT         NOT NULL,
    nombre_cancha       VARCHAR(50) NOT NULL,
    estado              ENUM('programado','jugado','postergado','cancelado')
                        NOT NULL DEFAULT 'programado',

    -- Columnas generadas para expresar reglas de negocio como UNIQUE
    -- Elegimos VIRTUAL porque estas columnas son cálculos muy simples 
    -- (el menor de dos números, un IF), así que no vale la pena ocupar espacio guardándolas.
    equipo_a     INT     AS (LEAST(id_equipo_local, id_equipo_visitante))    VIRTUAL,
    equipo_b     INT     AS (GREATEST(id_equipo_local, id_equipo_visitante)) VIRTUAL,
    vigente      TINYINT AS (IF(estado = 'cancelado', NULL, 1))                VIRTUAL,
    ocupa_cancha TINYINT AS (IF(estado IN ('cancelado','postergado'), NULL, 1)) VIRTUAL,

    -- Un cruce por edición, salvo partidos cancelados
    UNIQUE KEY uq_partido_cruce (id_torneo, equipo_a, equipo_b, vigente),
    -- Una cancha no tiene dos partidos activos en el mismo día y turno
    UNIQUE KEY uq_partido_cancha_turno (id_complejo, nombre_cancha, dia, id_turno, ocupa_cancha),

    -- Ambos equipos pertenecen a la misma edición, y la cancha y el turno existen
    CONSTRAINT fk_partido_local     FOREIGN KEY (id_equipo_local, id_torneo)
        REFERENCES equipo(id_equipo, id_torneo),
    CONSTRAINT fk_partido_visitante FOREIGN KEY (id_equipo_visitante, id_torneo)
        REFERENCES equipo(id_equipo, id_torneo),
    CONSTRAINT fk_partido_turno  FOREIGN KEY (id_turno) REFERENCES turno(id_turno),
    CONSTRAINT fk_partido_cancha FOREIGN KEY (id_complejo, nombre_cancha)
        REFERENCES cancha(id_complejo, nombre_cancha),
    CONSTRAINT chk_partido_rivales CHECK (id_equipo_local <> id_equipo_visitante),
    CONSTRAINT chk_partido_fecha   CHECK (numero_fecha >= 1)
);


-- Planilla, goles y tarjetas

CREATE TABLE planilla_partido (
    id_partido INT        NOT NULL,
    ci_jugador VARCHAR(8) NOT NULL,
    id_equipo  INT        NOT NULL,
    PRIMARY KEY (id_partido, ci_jugador),
    CONSTRAINT fk_planilla_partido FOREIGN KEY (id_partido) REFERENCES partido(id_partido),
    -- el jugador está en el plantel del equipo indicado
    CONSTRAINT fk_planilla_plantel FOREIGN KEY (id_equipo, ci_jugador)
        REFERENCES equipo_jugador_torneo(id_equipo, ci_jugador)
);

CREATE TABLE gol (
    id_gol     INT AUTO_INCREMENT PRIMARY KEY,
    id_partido INT        NOT NULL,
    ci_jugador VARCHAR(8) NOT NULL,
    minuto     TINYINT    NOT NULL,
    autogol    BOOLEAN    NOT NULL DEFAULT FALSE,
    -- solo convierte quien figura en la planilla
    CONSTRAINT fk_gol_planilla FOREIGN KEY (id_partido, ci_jugador)
        REFERENCES planilla_partido(id_partido, ci_jugador),
    CONSTRAINT chk_gol_minuto CHECK (minuto BETWEEN 0 AND 60)   -- ajustar a la duración real
);

CREATE TABLE tarjeta (
    id_tarjeta INT AUTO_INCREMENT PRIMARY KEY,
    id_partido INT        NOT NULL,
    ci_jugador VARCHAR(8) NOT NULL,
    minuto     TINYINT    NOT NULL,
    color      ENUM('amarilla','roja') NOT NULL,
    es_roja    TINYINT AS (IF(color = 'roja', 1, NULL)) VIRTUAL,
    UNIQUE KEY uq_una_roja_por_partido (id_partido, ci_jugador, es_roja),
    -- solo recibe tarjeta quien figura en la planilla
    CONSTRAINT fk_tarjeta_planilla FOREIGN KEY (id_partido, ci_jugador)
        REFERENCES planilla_partido(id_partido, ci_jugador),
    CONSTRAINT chk_tarjeta_minuto CHECK (minuto BETWEEN 0 AND 60)
);

-- Sanciones

CREATE TABLE sancion_jugador (
    id_sancion          INT AUTO_INCREMENT PRIMARY KEY,
    ci_jugador          VARCHAR(8) NOT NULL,
    id_torneo           INT        NOT NULL,
    motivo              ENUM('roja','acumulacion de amarillas','disciplinaria') NOT NULL,
    numero_fecha_inicio TINYINT    NOT NULL,
    cantidad_fechas     TINYINT    NOT NULL DEFAULT 1,
    -- La sanción se aplica a partir de una tarjeta o por motivos disciplinarios.
    -- Si se corrige el resultado y se borra la tarjeta, la sanción se borra automáticamente.
    id_tarjeta          INT          NULL UNIQUE,
    descripcion         VARCHAR(255) NULL,
    -- No se le puede poner una tarjeta a alguien que no jugó ese partido.
    CONSTRAINT fk_sancion_inscripto FOREIGN KEY (ci_jugador, id_torneo)
        REFERENCES equipo_jugador_torneo(ci_jugador, id_torneo),
    CONSTRAINT fk_sancion_tarjeta FOREIGN KEY (id_tarjeta)
        REFERENCES tarjeta(id_tarjeta) ON DELETE CASCADE,
    CONSTRAINT chk_sancion_fechas CHECK (numero_fecha_inicio >= 1 AND cantidad_fechas >= 1)
);

-- Datos maestros: los 5 turnos fijos del torneo, de 18:00 a 23:00.

INSERT INTO turno (hora_inicio, hora_fin) VALUES
    ('18:00','19:00'), ('19:00','20:00'), ('20:00','21:00'),
    ('21:00','22:00'), ('22:00','23:00');
