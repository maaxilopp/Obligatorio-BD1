-- DATOS DE PRUEBA DEL OBLIGATORIO
--
--   * 6 facultades, 6 equipos de 7 jugadores, 3 jugadores sin equipo
--   * docentes, funcionarios y posgrado (máx. 2 docentes/funcionarios por equipo)
--   * 3 fechas disputadas (9 partidos jugados), fecha 4 programada a futuro
--   * 1 partido cancelado (y reprogramado) y 1 postergado
--   * desempates en la tabla: Derecho al Gol e Ingenieros FC empatan en puntos
--     y diferencia (gana Derecho por goles a favor); Psico Team y Balance FC
--     empatan en puntos (gana Psico Team por diferencia de goles)
--   * 1 autogol, 1 hat-trick, 2 rojas, 1 jugador con 3 amarillas,
--     1 sanción disciplinaria de 2 fechas, 2 remontadas
--   * 2 jugadores inscriptos que nunca figuraron en una planilla
--
-- Las fechas son RELATIVAS al día en que se corre,
-- así la fecha 4 siempre queda a futuro y la fecha 3 todavía está
-- dentro de la ventana de 48 h para corregir resultados.
--
-- Orden de carga
--   torneo en 'inscripcion',  planteles ,torneo 'en curso', partidos
--   'programado', planilla, goles y tarjetas, partidos 'jugado'.
--
-- Usuarios de la aplicación:
--   admin@ucu.edu.uy       / admin123       
--   planillero@ucu.edu.uy  / planillero123 

SET NAMES utf8mb4;
SET time_zone = '-03:00';
USE torneo_futbol5;

SET @f1 = CURDATE() - INTERVAL 21 DAY;   -- fecha 1
SET @f2 = CURDATE() - INTERVAL 14 DAY;   -- fecha 2
SET @f3 = CURDATE() - INTERVAL 1 DAY;    -- fecha 3 (ayer)
SET @f4 = CURDATE() + INTERVAL 6 DAY;    -- fecha 4 (a futuro)
SET @inicio = CURDATE() - INTERVAL 30 DAY;

-- Usuarios de la aplicación
INSERT INTO login (correo, contrasena, rol) VALUES
    ('admin@ucu.edu.uy',      '$2b$12$VScMQ3ZfUG0SmTpNDsqGAeMF6Ng/4QLtf2iwA0QMs4R98bMQYsxce', 'administrador'),
    ('planillero@ucu.edu.uy', '$2b$12$ztv42l/V.JMrD/Vc2jeUgub1cJaj4I65HYFscs2ON/.ikSf2PENUa', 'planillero');

-- Facultades
INSERT INTO facultad (id_facultad, nombre) VALUES
    (1, 'Ingeniería y Tecnologías'),
    (2, 'Ciencias Empresariales'),
    (3, 'Derecho y Artes Liberales'),
    (4, 'Salud'),
    (5, 'Psicología y Bienestar Humano'),
    (6, 'Ciencias de la Educación');

-- Jugadores
INSERT INTO jugador (ci, nombre, apellido, email, fecha_nacimiento, id_facultad, tipo) VALUES
    ('41100048', 'Santiago', 'Pereira', 'santiago.pereira@correo.ucu.edu.uy', '2003-03-02', 1, 'grado'),
    ('41200065', 'Mateo', 'Rodríguez', 'mateo.rodriguez@correo.ucu.edu.uy', '2004-04-03', 1, 'grado'),
    ('41300082', 'Joaquín', 'Fernández', 'joaquin.fernandez@correo.ucu.edu.uy', '2005-05-04', 1, 'grado'),
    ('41400099', 'Nicolás', 'González', 'nicolas.gonzalez@correo.ucu.edu.uy', '2001-06-05', 1, 'grado'),
    ('41500116', 'Facundo', 'Silva', 'facundo.silva@correo.ucu.edu.uy', '2002-07-06', 1, 'grado'),
    ('41600133', 'Martín', 'Suárez', 'martin.suarez@ucu.edu.uy', '1981-08-07', 1, 'docente'),
    ('41700150', 'Ricardo', 'Olivera', 'ricardo.olivera@ucu.edu.uy', '1982-09-08', 1, 'funcionario'),
    ('42100079', 'Agustín', 'Martínez', 'agustin.martinez@correo.ucu.edu.uy', '2004-04-03', 2, 'grado'),
    ('42200096', 'Federico', 'López', 'federico.lopez@correo.ucu.edu.uy', '2005-05-05', 2, 'grado'),
    ('42300113', 'Diego', 'Sosa', 'diego.sosa@correo.ucu.edu.uy', '2001-06-07', 2, 'grado'),
    ('42400130', 'Bruno', 'Ramírez', 'bruno.ramirez@correo.ucu.edu.uy', '2002-07-09', 2, 'grado'),
    ('42500147', 'Lucas', 'Castro', 'lucas.castro@correo.ucu.edu.uy', '1996-08-11', 2, 'posgrado'),
    ('42600164', 'Tomás', 'Núñez', 'tomas.nunez@correo.ucu.edu.uy', '2004-09-13', 2, 'grado'),
    ('42700181', 'Gonzalo', 'Acosta', 'gonzalo.acosta@correo.ucu.edu.uy', '2005-10-15', 2, 'grado'),
    ('43100110', 'Valentín', 'Cabrera', 'valentin.cabrera@correo.ucu.edu.uy', '2005-05-04', 3, 'grado'),
    ('43200127', 'Ignacio', 'Méndez', 'ignacio.mendez@correo.ucu.edu.uy', '2001-06-07', 3, 'grado'),
    ('43300144', 'Rodrigo', 'Díaz', 'rodrigo.diaz@correo.ucu.edu.uy', '2002-07-10', 3, 'grado'),
    ('43400161', 'Pablo', 'Benítez', 'pablo.benitez@correo.ucu.edu.uy', '1996-08-13', 3, 'posgrado'),
    ('43500178', 'Emiliano', 'Romero', 'emiliano.romero@correo.ucu.edu.uy', '2004-09-16', 3, 'grado'),
    ('43600195', 'Gustavo', 'Ferreira', 'gustavo.ferreira@ucu.edu.uy', '1978-10-19', 3, 'docente'),
    ('43700212', 'Andrés', 'Píriz', 'andres.piriz@correo.ucu.edu.uy', '2001-11-22', 3, 'grado'),
    ('44100141', 'Felipe', 'Viera', 'felipe.viera@correo.ucu.edu.uy', '2001-06-05', 4, 'grado'),
    ('44200158', 'Sebastián', 'Correa', 'sebastian.correa@correo.ucu.edu.uy', '2002-07-09', 4, 'grado'),
    ('44300175', 'Juan', 'De León', 'juan.deleon@correo.ucu.edu.uy', '2003-08-13', 4, 'grado'),
    ('44400192', 'Maximiliano', 'Techera', 'maximiliano.techera@correo.ucu.edu.uy', '2004-09-17', 4, 'grado'),
    ('44500209', 'Franco', 'Rocha', 'franco.rocha@correo.ucu.edu.uy', '2005-10-21', 4, 'grado'),
    ('44600226', 'Lautaro', 'Medina', 'lautaro.medina@correo.ucu.edu.uy', '2001-11-25', 4, 'grado'),
    ('44700243', 'Esteban', 'Machado', 'esteban.machado@correo.ucu.edu.uy', '1996-12-02', 4, 'posgrado'),
    ('45100172', 'Bautista', 'Cardozo', 'bautista.cardozo@correo.ucu.edu.uy', '2002-07-06', 5, 'grado'),
    ('45200189', 'Thiago', 'Morales', 'thiago.morales@correo.ucu.edu.uy', '2003-08-11', 5, 'grado'),
    ('45300206', 'Alejandro', 'Rivero', 'alejandro.rivero@correo.ucu.edu.uy', '2004-09-16', 5, 'grado'),
    ('45400223', 'Germán', 'Duarte', 'german.duarte@correo.ucu.edu.uy', '2005-10-21', 5, 'grado'),
    ('45500240', 'Leandro', 'Bentancor', 'leandro.bentancor@correo.ucu.edu.uy', '2001-11-26', 5, 'grado'),
    ('45600257', 'Marcos', 'Vázquez', 'marcos.vazquez@correo.ucu.edu.uy', '2002-12-04', 5, 'grado'),
    ('45700274', 'Hernán', 'Da Silva', 'hernan.dasilva@correo.ucu.edu.uy', '2003-01-09', 5, 'grado'),
    ('46100203', 'Camilo', 'Martirena', 'camilo.martirena@correo.ucu.edu.uy', '2003-08-07', 6, 'grado'),
    ('46200220', 'Emanuel', 'Pintos', 'emanuel.pintos@correo.ucu.edu.uy', '2004-09-13', 6, 'grado'),
    ('46300237', 'Kevin', 'Ocampo', 'kevin.ocampo@correo.ucu.edu.uy', '2005-10-19', 6, 'grado'),
    ('46400254', 'Matías', 'Arrieta', 'matias.arrieta@correo.ucu.edu.uy', '2001-11-25', 6, 'grado'),
    ('46500271', 'Damián', 'Godoy', 'damian.godoy@correo.ucu.edu.uy', '2002-12-04', 6, 'grado'),
    ('46600288', 'Walter', 'Larrosa', 'walter.larrosa@ucu.edu.uy', '1981-01-10', 6, 'funcionario'),
    ('46700305', 'Iván', 'Barreto', 'ivan.barreto@correo.ucu.edu.uy', '2004-02-16', 6, 'grado'),
    ('51234567', 'Lucía', 'Fagúndez', 'lucia.fagundez@correo.ucu.edu.uy', '2003-04-12', 1, 'grado'),
    ('52345678', 'Carolina', 'Bermúdez', 'carolina.bermudez@correo.ucu.edu.uy', '1995-09-30', 1, 'posgrado'),
    ('3456789', 'Jorge', 'Iturralde', 'jorge.iturralde@ucu.edu.uy', '1970-02-08', 6, 'docente');

-- Edición del torneo 
INSERT INTO torneo (id_torneo, nombre, anio, semestre, fecha_inicio, fecha_fin, estado) VALUES
    (1, CONCAT('Torneo Interfacultades ', YEAR(@inicio), ' - ', IF(MONTH(@inicio) <= 6, 1, 2), 'º semestre'),
     YEAR(@inicio), IF(MONTH(@inicio) <= 6, 1, 2), @inicio, CURDATE() + INTERVAL 60 DAY, 'inscripcion');

INSERT INTO equipo (id_equipo, nombre, id_torneo, id_facultad) VALUES
    (1, 'Ingenieros FC', 1, 1),
    (2, 'Analisis FODA FC', 1, 2),
    (3, 'Derecho al Gol', 1, 3),
    (4, 'Bisturí FC', 1, 4),
    (5, 'Vilardebo FC', 1, 5),
    (6, 'Dando clase', 1, 6);

-- Planteles: 7 jugadores por equipo
INSERT INTO equipo_jugador_torneo (id_equipo, ci_jugador, id_torneo, id_facultad, numero_camiseta) VALUES
    (1, '41100048', 1, 1, 1),
    (1, '41200065', 1, 1, 4),
    (1, '41300082', 1, 1, 5),
    (1, '41400099', 1, 1, 7),
    (1, '41500116', 1, 1, 9),
    (1, '41600133', 1, 1, 10),
    (1, '41700150', 1, 1, 11),
    (2, '42100079', 1, 2, 1),
    (2, '42200096', 1, 2, 4),
    (2, '42300113', 1, 2, 5),
    (2, '42400130', 1, 2, 7),
    (2, '42500147', 1, 2, 9),
    (2, '42600164', 1, 2, 10),
    (2, '42700181', 1, 2, 11),
    (3, '43100110', 1, 3, 1),
    (3, '43200127', 1, 3, 4),
    (3, '43300144', 1, 3, 5),
    (3, '43400161', 1, 3, 7),
    (3, '43500178', 1, 3, 9),
    (3, '43600195', 1, 3, 10),
    (3, '43700212', 1, 3, 11),
    (4, '44100141', 1, 4, 1),
    (4, '44200158', 1, 4, 4),
    (4, '44300175', 1, 4, 5),
    (4, '44400192', 1, 4, 7),
    (4, '44500209', 1, 4, 9),
    (4, '44600226', 1, 4, 10),
    (4, '44700243', 1, 4, 11),
    (5, '45100172', 1, 5, 1),
    (5, '45200189', 1, 5, 4),
    (5, '45300206', 1, 5, 5),
    (5, '45400223', 1, 5, 7),
    (5, '45500240', 1, 5, 9),
    (5, '45600257', 1, 5, 10),
    (5, '45700274', 1, 5, 11),
    (6, '46100203', 1, 6, 1),
    (6, '46200220', 1, 6, 4),
    (6, '46300237', 1, 6, 5),
    (6, '46400254', 1, 6, 7),
    (6, '46500271', 1, 6, 9),
    (6, '46600288', 1, 6, 10),
    (6, '46700305', 1, 6, 11);

-- Capitanes
UPDATE equipo SET ci_capitan = '41100048' WHERE id_equipo = 1;
UPDATE equipo SET ci_capitan = '42100079' WHERE id_equipo = 2;
UPDATE equipo SET ci_capitan = '43100110' WHERE id_equipo = 3;
UPDATE equipo SET ci_capitan = '44100141' WHERE id_equipo = 4;
UPDATE equipo SET ci_capitan = '45100172' WHERE id_equipo = 5;
UPDATE equipo SET ci_capitan = '46100203' WHERE id_equipo = 6;

-- Complejos y canchas
INSERT INTO complejo (id_complejo, nombre, direccion, departamento) VALUES
    (1, 'Complejo Deportivo UCU',  'Av. 8 de Octubre 2738', 'Montevideo'),
    (2, 'Fútbol 5 La Blanqueada',  'Av. Larrañaga 3410',    'Montevideo'),
    (3, 'Canchas del Parque Roosevelt', 'Av. Giannattasio km 19', 'Canelones');

INSERT INTO cancha (id_complejo, nombre_cancha, superficie, techada) VALUES
    (1, 'Cancha 1', 'sintetico', FALSE),
    (1, 'Cancha 2', 'parquet',   TRUE),
    (2, 'Cancha A', 'sintetico', TRUE),
    (3, 'Cancha Norte', 'sintetico', FALSE);

-- Cierra la inscripción,  planteles quedan fijos
UPDATE torneo SET estado = 'en curso' WHERE id_torneo = 1;

-- Partidos. Se cargan como 'programado' y se marcan 'jugado' al final,
-- después de cargar la planilla
-- El 6 se canceló (lluvia) y se reprogramó como el 7. El 13 está postergado.
-- La fecha 5 todavía no se programó.
INSERT INTO partido (id_partido, id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, id_turno, id_complejo, nombre_cancha, estado) VALUES
    (1, 1, 1, 1, 2, @f1, 1, 1, 'Cancha 1', 'programado'),
    (2, 1, 1, 3, 4, @f1, 1, 1, 'Cancha 2', 'programado'),
    (3, 1, 1, 5, 6, @f1, 2, 1, 'Cancha 1', 'programado'),
    (4, 1, 2, 1, 3, @f2, 1, 1, 'Cancha 1', 'programado'),
    (5, 1, 2, 2, 5, @f2, 1, 1, 'Cancha 2', 'programado'),
    (6, 1, 2, 4, 6, @f2, 2, 1, 'Cancha 1', 'cancelado'),
    (7, 1, 2, 4, 6, @f2 + INTERVAL 2 DAY, 3, 2, 'Cancha A', 'programado'),
    (8, 1, 3, 1, 4, @f3, 1, 1, 'Cancha 1', 'programado'),
    (9, 1, 3, 2, 6, @f3, 1, 1, 'Cancha 2', 'programado'),
    (10, 1, 3, 3, 5, @f3, 2, 1, 'Cancha 1', 'programado'),
    (11, 1, 4, 1, 5, @f4, 1, 1, 'Cancha 1', 'programado'),
    (12, 1, 4, 2, 4, @f4, 1, 1, 'Cancha 2', 'programado'),
    (13, 1, 4, 3, 6, @f4, 2, 1, 'Cancha 1', 'postergado');

-- Sanción disciplinaria (cargada por la organización antes de la fecha 3):
-- el jugador no puede jugar las fechas 3 y 4.
INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio, cantidad_fechas, descripcion) VALUES
    ('45200189', 1, 'disciplinaria', 3, 2, 'Agresión verbal al árbitro en la fecha 2');

-- Partido 1
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (1, '41100048', 1),
    (1, '41200065', 1),
    (1, '41300082', 1),
    (1, '41400099', 1),
    (1, '41500116', 1),
    (1, '41600133', 1),
    (1, '42100079', 2),
    (1, '42200096', 2),
    (1, '42300113', 2),
    (1, '42400130', 2),
    (1, '42500147', 2),
    (1, '42600164', 2);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (1, '41100048', 5, FALSE),
    (1, '42200096', 18, TRUE),
    (1, '41300082', 40, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (1, '42400130', 30, 'amarilla');

-- Partido 2
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (2, '43100110', 3),
    (2, '43200127', 3),
    (2, '43300144', 3),
    (2, '43400161', 3),
    (2, '43500178', 3),
    (2, '43600195', 3),
    (2, '44100141', 4),
    (2, '44200158', 4),
    (2, '44300175', 4),
    (2, '44400192', 4),
    (2, '44500209', 4),
    (2, '44600226', 4);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (2, '43100110', 10, FALSE),
    (2, '44100141', 22, FALSE),
    (2, '43200127', 35, FALSE),
    (2, '44300175', 48, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (2, '43500178', 27, 'amarilla');

-- Partido 3
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (3, '45100172', 5),
    (3, '45200189', 5),
    (3, '45300206', 5),
    (3, '45400223', 5),
    (3, '45500240', 5),
    (3, '45600257', 5),
    (3, '46100203', 6),
    (3, '46200220', 6),
    (3, '46300237', 6),
    (3, '46400254', 6),
    (3, '46500271', 6),
    (3, '46600288', 6);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (3, '46100203', 33, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (3, '46400254', 12, 'amarilla'),
    (3, '45300206', 41, 'amarilla');

-- Partido 4
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (4, '41100048', 1),
    (4, '41200065', 1),
    (4, '41300082', 1),
    (4, '41400099', 1),
    (4, '41500116', 1),
    (4, '41600133', 1),
    (4, '43100110', 3),
    (4, '43200127', 3),
    (4, '43300144', 3),
    (4, '43400161', 3),
    (4, '43500178', 3),
    (4, '43600195', 3),
    (4, '43700212', 3);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (4, '43300144', 15, FALSE),
    (4, '41100048', 44, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (4, '41200065', 33, 'amarilla');

-- Partido 5
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (5, '42100079', 2),
    (5, '42200096', 2),
    (5, '42300113', 2),
    (5, '42400130', 2),
    (5, '42500147', 2),
    (5, '42600164', 2),
    (5, '45100172', 5),
    (5, '45200189', 5),
    (5, '45300206', 5),
    (5, '45400223', 5),
    (5, '45500240', 5),
    (5, '45600257', 5);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (5, '42100079', 8, FALSE),
    (5, '42100079', 30, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (5, '45200189', 21, 'amarilla'),
    (5, '42300113', 50, 'roja');

-- Partido 7
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (7, '44100141', 4),
    (7, '44200158', 4),
    (7, '44300175', 4),
    (7, '44400192', 4),
    (7, '44500209', 4),
    (7, '44600226', 4),
    (7, '44700243', 4),
    (7, '46100203', 6),
    (7, '46200220', 6),
    (7, '46300237', 6),
    (7, '46400254', 6),
    (7, '46500271', 6),
    (7, '46600288', 6),
    (7, '46700305', 6);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (7, '46200220', 5, FALSE),
    (7, '46100203', 12, FALSE),
    (7, '44100141', 25, FALSE),
    (7, '44200158', 38, FALSE),
    (7, '44100141', 50, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (7, '46400254', 17, 'amarilla'),
    (7, '44600226', 44, 'amarilla');

-- Partido 8
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (8, '41100048', 1),
    (8, '41200065', 1),
    (8, '41300082', 1),
    (8, '41400099', 1),
    (8, '41500116', 1),
    (8, '41600133', 1),
    (8, '44100141', 4),
    (8, '44200158', 4),
    (8, '44300175', 4),
    (8, '44400192', 4),
    (8, '44500209', 4),
    (8, '44600226', 4);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (8, '44300175', 20, FALSE),
    (8, '41300082', 47, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (8, '41200065', 9, 'amarilla'),
    (8, '44200158', 39, 'amarilla');

-- Partido 9
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (9, '42100079', 2),
    (9, '42200096', 2),
    (9, '42400130', 2),
    (9, '42500147', 2),
    (9, '42600164', 2),
    (9, '42700181', 2),
    (9, '46100203', 6),
    (9, '46200220', 6),
    (9, '46300237', 6),
    (9, '46400254', 6),
    (9, '46500271', 6),
    (9, '46600288', 6);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (9, '42600164', 7, FALSE),
    (9, '46300237', 19, FALSE),
    (9, '46100203', 30, FALSE),
    (9, '42100079', 45, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (9, '46400254', 26, 'amarilla');

-- Partido 10
INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES
    (10, '43100110', 3),
    (10, '43200127', 3),
    (10, '43300144', 3),
    (10, '43400161', 3),
    (10, '43500178', 3),
    (10, '43600195', 3),
    (10, '45100172', 5),
    (10, '45300206', 5),
    (10, '45400223', 5),
    (10, '45500240', 5),
    (10, '45600257', 5);
INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES
    (10, '45100172', 3, FALSE),
    (10, '43100110', 14, FALSE),
    (10, '43100110', 28, FALSE),
    (10, '43400161', 36, FALSE),
    (10, '43100110', 52, FALSE);
INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES
    (10, '43600195', 31, 'amarilla'),
    (10, '45400223', 55, 'roja');

-- Con las planillas cargadas, se cierran los partidos disputados
UPDATE partido SET estado = 'jugado' WHERE id_partido IN (1, 2, 3, 4, 5, 7, 8, 9, 10);
