"""Planilla de juego, goles, tarjetas y ventana de 48 horas.

En los datos de prueba: fechas 1 y 2 se jugaron hace 2-3 semanas (fuera de
la ventana de 48 h), la fecha 3 se jugó ayer (dentro), la fecha 4 es a futuro.
Partido 8 = Ingenieros FC vs Bisturí FC (fecha 3), 9 = Balance FC vs Psico Team
(fecha 3), 10 = Derecho al Gol vs Humanistas (fecha 3), 11 = fecha 4.
"""
from conftest import ci_de, falla, uno


def test_suspendido_por_roja_no_figura_en_la_planilla(cur):
    # Diego Sosa (Balance FC) vio la roja en la fecha 2 -> suspendido en la fecha 3
    ci = ci_de(cur, "Diego", "Sosa")
    falla(cur, "INSERT INTO planilla_partido VALUES (9, %s, 2)", (ci,), mensaje="suspendido")


def test_suspendido_por_sancion_disciplinaria(cur):
    # Thiago Morales (Humanistas): disciplinaria fechas 3 y 4
    ci = ci_de(cur, "Thiago", "Morales")
    falla(cur, "INSERT INTO planilla_partido VALUES (10, %s, 5)", (ci,), mensaje="suspendido")


def test_equipo_de_la_planilla_debe_jugar_el_partido(cur):
    # Ricardo Olivera es de Ingenieros FC, que no juega el partido 9
    ci = ci_de(cur, "Ricardo", "Olivera")
    falla(cur, "INSERT INTO planilla_partido VALUES (9, %s, 1)", (ci,), mensaje="no juega ese partido")


def test_jugador_debe_ser_del_plantel_del_equipo_indicado(cur):
    # Felipe Viera es de Bisturí FC, no de Psico Team
    ci = ci_de(cur, "Felipe", "Viera")
    falla(cur, "INSERT INTO planilla_partido VALUES (9, %s, 6)", (ci,), errno=1452)


def test_gol_solo_de_jugadores_en_la_planilla(cur):
    # Ricardo Olivera está en el plantel de Ingenieros FC pero no en la planilla del partido 8
    ci = ci_de(cur, "Ricardo", "Olivera")
    falla(cur, "INSERT INTO gol (id_partido, ci_jugador, minuto) VALUES (8, %s, 10)", (ci,), errno=1452)


def test_tarjeta_solo_a_jugadores_en_la_planilla(cur):
    ci = ci_de(cur, "Ricardo", "Olivera")
    falla(cur, "INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES (8, %s, 10, 'amarilla')",
          (ci,), errno=1452)


def test_minuto_valido(cur):
    ci = ci_de(cur, "Santiago", "Pereira")
    falla(cur, "INSERT INTO gol (id_partido, ci_jugador, minuto) VALUES (8, %s, 75)", (ci,), errno=3819)


def test_no_se_carga_planilla_de_un_partido_futuro(cur):
    ci = ci_de(cur, "Santiago", "Pereira")
    falla(cur, "INSERT INTO planilla_partido VALUES (11, %s, 1)", (ci,), mensaje="todavía no se disputó")


def test_no_se_carga_planilla_de_un_partido_cancelado(cur):
    ci = ci_de(cur, "Felipe", "Viera")
    falla(cur, "INSERT INTO planilla_partido VALUES (6, %s, 4)", (ci,), mensaje="cancelado o postergado")


def test_correccion_despues_de_48_horas_rechazada(cur):
    falla(cur, "DELETE FROM gol WHERE id_partido = 1", mensaje="48 horas")
    falla(cur, "UPDATE gol SET minuto = 1 WHERE id_partido = 2", mensaje="48 horas")


def test_correccion_dentro_de_48_horas_permitida_y_auditada(cur):
    antes = uno(cur, "SELECT COUNT(*) FROM auditoria_resultado")
    cur.execute("SET @usuario_app = 'admin@ucu.edu.uy'")
    cur.execute("UPDATE gol SET minuto = 21 WHERE id_partido = 8 AND minuto = 20")
    assert cur.rowcount == 1
    assert uno(cur, "SELECT COUNT(*) FROM auditoria_resultado") == antes + 1
    cur.execute("SELECT tabla, accion, usuario, detalle FROM auditoria_resultado ORDER BY id_auditoria DESC LIMIT 1")
    tabla, accion, usuario, detalle = cur.fetchone()
    assert (tabla, accion, usuario) == ("gol", "modificacion", "admin@ucu.edu.uy")
    assert "min 20" in detalle and "min 21" in detalle


def test_el_resultado_se_calcula_desde_los_goles(cur):
    # partido 8 terminó 1-1; un gol más de Bisturí FC cambia el resultado
    ci = ci_de(cur, "Felipe", "Viera")
    cur.execute("INSERT INTO gol (id_partido, ci_jugador, minuto) VALUES (8, %s, 55)", (ci,))
    cur.execute("SELECT goles_local, goles_visitante FROM v_resultado_partido WHERE id_partido = 8")
    assert cur.fetchone() == (1, 2)


def test_autogol_suma_al_rival(cur):
    # partido 1: Ingenieros FC 3-0 Balance FC, con un autogol de Federico López (Balance FC)
    cur.execute("SELECT goles_local, goles_visitante FROM v_resultado_partido WHERE id_partido = 1")
    assert cur.fetchone() == (3, 0)
