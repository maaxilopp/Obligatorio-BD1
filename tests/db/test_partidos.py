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


def partido_disputado(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2, jugadores=6, anio=2025)
    p = programar(cur, t, 1, a, b, "2025-04-10")
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    return p, a, b


def cargar_planilla(cur, p, equipo, cantidad):
    cur.execute("INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) "
                "SELECT %s, ci_jugador, id_equipo FROM equipo_jugador_torneo WHERE id_equipo = %s "
                "AND ci_jugador NOT IN (SELECT ci_jugador FROM sancion_jugador) "
                "ORDER BY ci_jugador LIMIT " + str(cantidad), (p, equipo))


def test_no_se_marca_jugado_sin_planilla(cur):
    p, _, _ = partido_disputado(cur)
    falla(cur, "CALL marcar_jugado(%s)", (p,), mensaje="al menos 5 jugadores en la planilla")


def test_no_se_marca_jugado_con_menos_de_5_por_equipo(cur):
    p, a, b = partido_disputado(cur)
    cargar_planilla(cur, p, a, 5)
    cargar_planilla(cur, p, b, 4)
    falla(cur, "CALL marcar_jugado(%s)", (p,), mensaje="al menos 5 jugadores en la planilla")


def test_con_5_por_equipo_se_marca_jugado(cur):
    p, a, b = partido_disputado(cur)
    cargar_planilla(cur, p, a, 5)
    cargar_planilla(cur, p, b, 5)
    cur.execute("CALL marcar_jugado(%s)", (p,))
    assert uno(cur, "SELECT estado FROM partido WHERE id_partido = %s", (p,)) == "jugado"


def test_una_correccion_no_baja_de_5_jugadores(cur):
    cur.execute("UPDATE partido SET dia = CURDATE() - INTERVAL 1 DAY, id_turno = 5 WHERE id_partido = 11")
    cargar_planilla(cur, 11, 1, 6)
    cargar_planilla(cur, 11, 5, 5)
    cur.execute("CALL marcar_jugado(11)")
    cis =[fila[0] for fila in _planilla(cur, 11, 1)]
    cur.execute("DELETE FROM planilla_partido WHERE id_partido = 11 AND ci_jugador = %s", (cis[0],))
    falla(cur, "DELETE FROM planilla_partido WHERE id_partido = 11 AND ci_jugador = %s", (cis[1],),
          mensaje="conservar al menos 5")


def _planilla(cur, p, equipo):
    cur.execute("SELECT ci_jugador FROM planilla_partido WHERE id_partido = %s AND id_equipo = %s "
                "ORDER BY ci_jugador", (p, equipo))
    return cur.fetchall()


def _insert(t, fecha, local, visitante, dia, turno=1):
    return ("INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
            "id_turno, id_complejo, nombre_cancha) VALUES (%s, %s, %s, %s, %s, %s, 1, 'Cancha 1')",
            (t, fecha, local, visitante, dia, turno))


def partido_con_un_suspendido(cur):
    """Equipos de 5 jugadores: uno del local no puede jugar la fecha del partido."""
    t, (a, b) = nuevo_torneo(cur, equipos=2, anio=2025)
    p = programar(cur, t, 1, a, b, "2025-04-10")
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    cur.execute("SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s ORDER BY ci_jugador", (a,))
    local = [fila[0] for fila in cur.fetchall()]
    cur.execute("INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio, "
                "cantidad_fechas, descripcion) VALUES (%s, %s, 'disciplinaria', 1, 1, 'x')", (local[0], t))
    cur.execute("SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s", (b,))
    visitante = [fila[0] for fila in cur.fetchall()]
    for ci in visitante:
        cur.execute("INSERT INTO planilla_partido VALUES (%s, %s, %s)", (p, ci, b))
    return p, a, local[1:]


def test_con_un_suspendido_alcanza_con_todos_los_disponibles(cur):
    p, a, disponibles = partido_con_un_suspendido(cur)
    for ci in disponibles:
        cur.execute("INSERT INTO planilla_partido VALUES (%s, %s, %s)", (p, ci, a))
    cur.execute("CALL marcar_jugado(%s)", (p,))
    assert uno(cur, "SELECT estado FROM partido WHERE id_partido = %s", (p,)) == "jugado"


def test_con_un_suspendido_igual_tienen_que_estar_todos_los_disponibles(cur):
    p, a, disponibles = partido_con_un_suspendido(cur)
    for ci in disponibles[:-1]:
        cur.execute("INSERT INTO planilla_partido VALUES (%s, %s, %s)", (p, ci, a))
    falla(cur, "CALL marcar_jugado(%s)", (p,), mensaje="todos los disponibles")
