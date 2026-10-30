"""Validación de campos a nivel de base de datos (CHECK, ENUM, NOT NULL)."""
import pytest

from conftest import falla

JUGADOR = ("INSERT INTO jugador (ci, nombre, apellido, email, fecha_nacimiento, id_facultad, tipo) "
           "VALUES (%s, %s, %s, %s, '2000-01-01', 1, %s)")


# 3819 = falla un CHECK; 1406 = dato demasiado largo para la columna
@pytest.mark.parametrize("ci, errno", [("123", 3819), ("1234567a", 3819), ("123456789", 1406)])
def test_cedula_con_formato_invalido(cur, ci, errno):
    falla(cur, JUGADOR, (ci, "Ana", "Pérez", "ana@correo.ucu.edu.uy", "grado"), errno=errno)


def test_email_invalido(cur):
    falla(cur, JUGADOR, ("12345678", "Ana", "Pérez", "ana-sin-arroba", "grado"), errno=3819)


def test_nombre_vacio(cur):
    falla(cur, JUGADOR, ("12345678", "  ", "Pérez", "ana@correo.ucu.edu.uy", "grado"), errno=3819)


def test_tipo_de_jugador_fuera_del_enum(cur):
    falla(cur, JUGADOR, ("12345678", "Ana", "Pérez", "ana@correo.ucu.edu.uy", "hincha"), errno=1265)


def test_email_repetido(cur):
    falla(cur, JUGADOR, ("12345678", "Ana", "Pérez", "lucia.fagundez@correo.ucu.edu.uy", "grado"), errno=1062)


def test_turno_fuera_del_horario(cur):
    falla(cur, "INSERT INTO turno (hora_inicio, hora_fin) VALUES ('23:00', '00:00')", errno=3819)
    falla(cur, "INSERT INTO turno (hora_inicio, hora_fin) VALUES ('17:00', '18:00')", errno=3819)


def test_torneo_con_fechas_invertidas(cur):
    falla(cur, "INSERT INTO torneo (nombre, anio, semestre, fecha_inicio, fecha_fin) "
               "VALUES ('X', 2032, 1, '2032-06-01', '2032-03-01')", errno=3819)


def test_una_edicion_por_semestre(cur):
    falla(cur, "INSERT INTO torneo (nombre, anio, semestre, fecha_inicio, fecha_fin) "
               "SELECT 'Duplicado', anio, semestre, fecha_inicio, fecha_fin FROM torneo WHERE id_torneo = 1",
          errno=1062)


