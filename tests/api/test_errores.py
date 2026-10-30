
import pytest
from mysql.connector import Error

from backend.errores import traducir_error


def error_mysql(errno, mensaje):
    return Error(msg=mensaje, errno=errno)


def test_signal_de_trigger_pasa_el_mensaje_tal_cual():
    r = traducir_error(error_mysql(1644, "El jugador está suspendido para esta fecha del torneo"))
    assert (r.status_code, r.detail) == (400, "El jugador está suspendido para esta fecha del torneo")


@pytest.mark.parametrize("clave, mensaje", [
    ("jugador.PRIMARY", "Ya existe un jugador con esa cédula"),
    ("partido.uq_partido_cancha_turno", "La cancha ya tiene un partido en ese día y turno"),
    ("equipo_jugador_torneo.uq_jugador_un_equipo_por_torneo", "El jugador ya integra otro equipo en esta edición"),
])
def test_duplicados_segun_el_indice(clave, mensaje):
    r = traducir_error(error_mysql(1062, f"Duplicate entry 'x' for key '{clave}'"))
    assert (r.status_code, r.detail) == (409, mensaje)


def test_duplicado_de_un_indice_desconocido_tiene_mensaje_generico():
    r = traducir_error(error_mysql(1062, "Duplicate entry 'x' for key 'otra.cosa'"))
    assert (r.status_code, r.detail) == (409, "Ya existe un registro con esos datos")


def test_clave_foranea_segun_la_constraint():
    msg = ("Cannot add or update a child row: a foreign key constraint fails "
           "(`torneo_futbol5`.`gol`, CONSTRAINT `fk_gol_planilla` FOREIGN KEY ...)")
    r = traducir_error(error_mysql(1452, msg))
    assert r.status_code == 400 and "figure en la planilla" in r.detail


def test_borrar_algo_con_datos_asociados():
    assert traducir_error(error_mysql(1451, "Cannot delete or update a parent row")).status_code == 409


def test_check_segun_la_constraint():
    r = traducir_error(error_mysql(3819, "Check constraint 'chk_jugador_ci' is violated."))
    assert (r.status_code, r.detail) == (400, "La cédula debe tener 7 u 8 dígitos, sin puntos ni guión")


@pytest.mark.parametrize("errno", [1142, 1143, 1370])
def test_falta_de_permisos_de_mysql_es_403(errno):
    assert traducir_error(error_mysql(errno, "command denied")).status_code == 403


def test_error_desconocido_no_expone_detalles():
    r = traducir_error(error_mysql(2013, "Lost connection to MySQL server during query"))
    assert (r.status_code, r.detail) == (500, "Error inesperado en la base de datos")