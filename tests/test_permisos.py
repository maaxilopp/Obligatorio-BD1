"""Usuarios de MySQL con permisos diferenciados (db/05_usuarios.sql).

Código 1142 = comando denegado sobre una tabla; 1370 = sobre una rutina.
"""
from conftest import falla, uno


def test_planillero_no_hace_abm_de_jugadores_ni_equipos(conexion_rol):
    cur = conexion_rol("planillero")
    falla(cur, "DELETE FROM jugador WHERE ci = '51234567'", errno=1142)
    falla(cur, "UPDATE equipo SET nombre = 'X' WHERE id_equipo = 1", errno=1142)
    falla(cur, "INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio) "
               "VALUES ('41100048', 1, 'disciplinaria', 4)", errno=1142)


def test_planillero_no_modifica_partidos_directamente(conexion_rol):
    cur = conexion_rol("planillero")
    falla(cur, "UPDATE partido SET estado = 'cancelado' WHERE id_partido = 11", errno=1142)


def test_planillero_no_ve_contrasenas_ni_auditoria(conexion_rol):
    cur = conexion_rol("planillero")
    falla(cur, "SELECT * FROM login", errno=1142)
    falla(cur, "SELECT * FROM auditoria_resultado", errno=1142)


def test_planillero_carga_goles_y_cierra_partidos(conexion_rol):
    cur = conexion_rol("planillero")
    # puede escribir goles (partido 8, dentro de las 48 h)
    cur.execute("INSERT INTO gol (id_partido, ci_jugador, minuto) VALUES (8, '41100048', 58)")
    # puede ejecutar marcar_jugado: el error que recibe es de negocio, no de permisos
    falla(cur, "CALL marcar_jugado(1)", mensaje="Solo un partido programado")


def test_planillero_no_genera_fixture(conexion_rol):
    cur = conexion_rol("planillero")
    falla(cur, "CALL generar_fixture(1, CURDATE())", errno=1370)


def test_admin_hace_abm_pero_no_toca_la_auditoria(conexion_rol):
    cur = conexion_rol("admin")
    cur.execute("UPDATE equipo SET nombre = 'Ingenieros FC 2' WHERE id_equipo = 1")
    assert uno(cur, "SELECT COUNT(*) FROM auditoria_resultado") >= 0
    falla(cur, "DELETE FROM auditoria_resultado", errno=1142)
    falla(cur, "UPDATE auditoria_resultado SET usuario = 'otro'", errno=1142)


def test_usuario_auth_solo_lee_login(conexion_rol):
    cur = conexion_rol("auth")
    assert uno(cur, "SELECT rol FROM login WHERE correo = 'admin@ucu.edu.uy'") == "administrador"
    falla(cur, "SELECT * FROM jugador", errno=1142)
    falla(cur, "UPDATE login SET rol = 'administrador'", errno=1142)
