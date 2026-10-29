"""Reglas al programar y modificar partidos."""
from conftest import falla, nuevo_torneo, programar, uno

DIA = "2031-04-10"


def test_equipo_no_se_enfrenta_a_si_mismo(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    falla(cur, "INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
               "id_turno, id_complejo, nombre_cancha) VALUES (%s, 1, %s, %s, %s, 1, 1, 'Cancha 1')",
          (t, a, a, DIA), errno=3819)


def test_cruce_repetido_en_la_edicion(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    programar(cur, t, 1, a, b, DIA)
    # también con la localía invertida
    falla(cur, *_insert(t, 2, b, a, "2031-04-17"), errno=1062)


def test_cruce_permitido_si_el_anterior_se_cancelo(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    p = programar(cur, t, 1, a, b, DIA)
    cur.execute("UPDATE partido SET estado = 'cancelado' WHERE id_partido = %s", (p,))
    programar(cur, t, 1, a, b, "2031-04-12")
    assert uno(cur, "SELECT COUNT(*) FROM partido WHERE id_torneo = %s", (t,)) == 2


def test_equipo_no_juega_dos_partidos_en_la_misma_fecha(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    programar(cur, t, 1, a, b, DIA)
    falla(cur, *_insert(t, 1, a, c, "2031-04-11"), mensaje="ya tiene un partido en esa fecha")


def test_cancha_no_tiene_dos_partidos_en_el_mismo_dia_y_turno(cur):
    t, (a, b, c, d) = nuevo_torneo(cur, equipos=4)
    programar(cur, t, 1, a, b, DIA, turno=1)
    falla(cur, *_insert(t, 1, c, d, DIA, turno=1), errno=1062)
    # otro turno u otra cancha, sí
    programar(cur, t, 1, c, d, DIA, turno=2)


def test_cancha_queda_libre_si_el_partido_se_posterga(cur):
    t, (a, b, c, d) = nuevo_torneo(cur, equipos=4)
    p = programar(cur, t, 1, a, b, DIA)
    cur.execute("UPDATE partido SET estado = 'postergado' WHERE id_partido = %s", (p,))
    programar(cur, t, 1, c, d, DIA)


def test_ambos_equipos_con_al_menos_5_jugadores(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2, jugadores=4)
    falla(cur, *_insert(t, 1, a, b, DIA), mensaje="al menos 5 jugadores")


def test_equipos_de_la_misma_edicion(cur):
    t, (a, *_) = nuevo_torneo(cur)
    # el equipo 1 es del torneo de los datos de prueba
    falla(cur, *_insert(t, 1, a, 1, DIA), errno=1452)


def test_dia_dentro_de_las_fechas_del_torneo(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    falla(cur, *_insert(t, 1, a, b, "2031-09-01"), mensaje="dentro de las fechas del torneo")


def test_solo_se_marca_jugado_si_ya_paso_su_dia_y_turno(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    p = programar(cur, t, 1, a, b, DIA)
    falla(cur, "UPDATE partido SET estado = 'jugado' WHERE id_partido = %s", (p,),
          mensaje="después de su día y turno")
    falla(cur, "CALL marcar_jugado(%s)", (p,), mensaje="después de su día y turno")


def test_partido_jugado_no_se_elimina(cur):
    falla(cur, "DELETE FROM partido WHERE id_partido = 1", mensaje="no puede eliminarse")


def test_partido_jugado_no_cambia_de_estado(cur):
    falla(cur, "UPDATE partido SET estado = 'cancelado' WHERE id_partido = 1", mensaje="no puede cambiar de estado")


def test_partido_jugado_no_se_mueve(cur):
    falla(cur, "UPDATE partido SET dia = dia + INTERVAL 1 DAY WHERE id_partido = 1", mensaje="no puede modificarse")
    falla(cur, "UPDATE partido SET id_turno = 5 WHERE id_partido = 1", mensaje="no puede modificarse")
    falla(cur, "UPDATE partido SET id_equipo_visitante = 3 WHERE id_partido = 1", mensaje="no puede modificarse")


def test_partido_programado_si_se_puede_eliminar(cur):
    cur.execute("DELETE FROM partido WHERE id_partido = 11")
    assert uno(cur, "SELECT COUNT(*) FROM partido WHERE id_partido = 11") == 0


def test_no_se_marca_jugado_sin_planilla(cur):
    # fecha 5 (Balance FC vs Derecho al Gol) "jugada" ayer pero sin planilla
    cur.execute("""INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante,
                   dia, id_turno, id_complejo, nombre_cancha)
                   VALUES (1, 5, 2, 3, CURDATE() - INTERVAL 1 DAY, 4, 1, 'Cancha 1')""")
    p = cur.lastrowid
    falla(cur, "CALL marcar_jugado(%s)", (p,), mensaje="cargar la planilla de ambos equipos")


def _insert(t, fecha, local, visitante, dia, turno=1):
    return ("INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
            "id_turno, id_complejo, nombre_cancha) VALUES (%s, %s, %s, %s, %s, %s, 1, 'Cancha 1')",
            (t, fecha, local, visitante, dia, turno))