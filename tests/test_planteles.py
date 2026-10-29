"""Reglas de equipos y planteles."""
import pymysql
import pytest

from conftest import agregar_jugador, ci_de, falla, nuevo_torneo, uno


def test_plantel_maximo_10_jugadores(cur):
    id_torneo, (eq, *_) = nuevo_torneo(cur, equipos=1, jugadores=10)
    with pytest.raises(pymysql.MySQLError, match="10 jugadores"):
        agregar_jugador(cur, id_torneo, eq, 11)


def test_plantel_maximo_2_docentes_o_funcionarios(cur):
    id_torneo, (eq, *_) = nuevo_torneo(cur, equipos=1, jugadores=3)
    agregar_jugador(cur, id_torneo, eq, 20, tipo="docente")
    agregar_jugador(cur, id_torneo, eq, 21, tipo="funcionario")
    with pytest.raises(pymysql.MySQLError, match="2 docentes/funcionarios"):
        agregar_jugador(cur, id_torneo, eq, 22, tipo="docente")


def test_jugador_debe_ser_de_la_facultad_del_equipo(cur):
    id_torneo, (eq, *_) = nuevo_torneo(cur, equipos=1, jugadores=1)
    # jugador de Derecho (facultad 3) en un equipo de Ingeniería (facultad 1)
    ci_derecho = ci_de(cur, "Valentín", "Cabrera")
    falla(cur, "INSERT INTO equipo_jugador_torneo VALUES (%s, %s, %s, 1, 50)",
          (eq, ci_derecho, id_torneo), errno=1452)
    falla(cur, "INSERT INTO equipo_jugador_torneo VALUES (%s, %s, %s, 3, 50)",
          (eq, ci_derecho, id_torneo), errno=1452)


def test_jugador_no_integra_dos_equipos_en_la_misma_edicion(cur):
    id_torneo, (eq1, eq2) = nuevo_torneo(cur, equipos=2, jugadores=1)
    ci = uno(cur, "SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s", (eq1,))
    falla(cur, "INSERT INTO equipo_jugador_torneo VALUES (%s, %s, %s, 1, 60)",
          (eq2, ci, id_torneo), errno=1062)


def test_camiseta_no_se_repite_en_el_equipo(cur):
    id_torneo, (eq, *_) = nuevo_torneo(cur, equipos=1, jugadores=1)
    falla(cur, "INSERT INTO equipo_jugador_torneo VALUES (%s, '51234567', %s, 1, 1)",
          (eq, id_torneo), errno=1062)


def test_plantel_no_se_modifica_con_el_torneo_en_curso(cur):
    # el torneo 1 de los datos de prueba está 'en curso'
    falla(cur, "INSERT INTO equipo_jugador_torneo VALUES (1, '51234567', 1, 1, 30)",
          mensaje="etapa de inscripción")
    falla(cur, "DELETE FROM equipo_jugador_torneo WHERE id_equipo = 1 AND numero_camiseta = 11",
          mensaje="etapa de inscripción")
    falla(cur, "UPDATE equipo_jugador_torneo SET numero_camiseta = 99 WHERE id_equipo = 1 AND numero_camiseta = 11",
          mensaje="etapa de inscripción")


def test_capitan_debe_ser_del_plantel(cur):
    # Lucía Fagúndez es de Ingeniería pero no está en el plantel de Ingenieros FC
    falla(cur, "UPDATE equipo SET ci_capitan = '51234567' WHERE id_equipo = 1", errno=1452)
