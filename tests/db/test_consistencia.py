"""Reglas que dependen de más de una tabla: lo que se valida al cargar un dato
tiene que seguir valiendo cuando después cambia otro dato relacionado.

Partido 8 = Ingenieros FC vs Bisturí FC (fecha 3, jugado ayer), 11 = Ingenieros FC
vs Vilardebo FC (fecha 4, a futuro), 13 = Derecho al Gol vs Dando clase (postergado).
"""
from conftest import agregar_jugador, ci_de, falla, nuevo_torneo, programar, uno

INSCRIPTO_SIN_TARJETAS = """
    SELECT pp.ci_jugador FROM planilla_partido pp
    WHERE pp.id_partido = %s
      AND NOT EXISTS (SELECT 1 FROM tarjeta t WHERE t.ci_jugador = pp.ci_jugador)
    ORDER BY pp.ci_jugador LIMIT 1
"""


def amarilla(cur, ci, minuto, partido=8):
    cur.execute("INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) "
                "VALUES (%s, %s, %s, 'amarilla')", (partido, ci, minuto))
    return cur.lastrowid


def sanciones_por_amarillas(cur, ci):
    return uno(cur, "SELECT COUNT(*) FROM sancion_jugador "
                    "WHERE ci_jugador = %s AND motivo = 'acumulacion de amarillas'", (ci,))


def amarillas_en_partidos(cur, n):
    """Crea una edición pasada y le carga una amarilla al mismo jugador en cada
    uno de n partidos distintos (fechas 1..n). Con la regla de doble amarilla no
    se pueden cargar 3 amarillas en un mismo partido.

    Devuelve (ci, [id_tarjeta, ...]) en orden de fecha.
    """
    t, equipos = nuevo_torneo(cur, equipos=n + 1, jugadores=5, anio=2025)
    cur.execute("SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s ORDER BY ci_jugador LIMIT 1",
                (equipos[0],))
    ci = cur.fetchone()[0]
    partidos = [programar(cur, t, f, equipos[0], equipos[f], f"2025-03-{f:02d}") for f in range(1, n + 1)]
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    # primero la planilla de todos los partidos: las suspensiones que generan las
    # amarillas impedirían figurar en las fechas siguientes
    for p in partidos:
        cur.execute("INSERT INTO planilla_partido (id_partido, ci_jugador, id_equipo) VALUES (%s, %s, %s)",
                    (p, ci, equipos[0]))
    tarjetas = [amarilla(cur, ci, 10, partido=p) for p in partidos]
    return ci, tarjetas


def partido_pasado_con_planilla(cur):
    """Pasa el partido 11 a ayer, con un jugador de Ingenieros FC en la planilla."""
    cur.execute("UPDATE partido SET dia = CURDATE() - INTERVAL 1 DAY, id_turno = 5 WHERE id_partido = 11")
    ci = ci_de(cur, "Santiago", "Pereira")
    cur.execute("INSERT INTO planilla_partido VALUES (11, %s, 1)", (ci,))
    return ci


# ---------- cupo de docentes y funcionarios ----------

def test_jugador_inscripto_no_supera_el_cupo_al_cambiar_de_tipo(cur):
    t, (eq,) = nuevo_torneo(cur, equipos=1, jugadores=3)
    agregar_jugador(cur, t, eq, 20, tipo="docente")
    agregar_jugador(cur, t, eq, 21, tipo="funcionario")
    ci = uno(cur, """SELECT e.ci_jugador FROM equipo_jugador_torneo e JOIN jugador j ON j.ci = e.ci_jugador
                     WHERE e.id_equipo = %s AND j.tipo = 'grado' LIMIT 1""", (eq,))
    falla(cur, "UPDATE jugador SET tipo = 'docente' WHERE ci = %s", (ci,), mensaje="2 docentes/funcionarios")
    # pasar de grado a posgrado no toca el cupo
    cur.execute("UPDATE jugador SET tipo = 'posgrado' WHERE ci = %s", (ci,))


def test_cambio_de_tipo_permitido_si_hay_cupo(cur):
    t, (eq,) = nuevo_torneo(cur, equipos=1, jugadores=3)
    ci = uno(cur, "SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s LIMIT 1", (eq,))
    cur.execute("UPDATE jugador SET tipo = 'docente' WHERE ci = %s", (ci,))
    assert uno(cur, "SELECT tipo FROM jugador WHERE ci = %s", (ci,)) == "docente"


def test_ediciones_finalizadas_no_limitan_el_cambio_de_tipo(cur):
    t, (eq, otro) = nuevo_torneo(cur, equipos=2, jugadores=5)
    agregar_jugador(cur, t, eq, 20, tipo="docente")
    agregar_jugador(cur, t, eq, 21, tipo="funcionario")
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    cur.execute("UPDATE torneo SET estado = 'finalizado' WHERE id_torneo = %s", (t,))
    ci = uno(cur, """SELECT e.ci_jugador FROM equipo_jugador_torneo e JOIN jugador j ON j.ci = e.ci_jugador
                     WHERE e.id_equipo = %s AND j.tipo = 'grado' LIMIT 1""", (eq,))
    cur.execute("UPDATE jugador SET tipo = 'docente' WHERE ci = %s", (ci,))


# ---------- sanción por acumulación ----------

def test_borrar_la_amarilla_que_sanciono_mantiene_la_sancion_si_quedan_tres(cur):
    ci, tarjetas = amarillas_en_partidos(cur, 4)
    assert sanciones_por_amarillas(cur, ci) == 1

    cur.execute("DELETE FROM tarjeta WHERE id_tarjeta = %s", (tarjetas[2],))

    assert sanciones_por_amarillas(cur, ci) == 1
    # la sanción pasa a colgar de la que ahora es la 3ra (fecha 4) y empieza en la 5
    assert uno(cur, "SELECT id_tarjeta FROM sancion_jugador "
                    "WHERE ci_jugador = %s AND motivo = 'acumulacion de amarillas'", (ci,)) == tarjetas[3]
    assert uno(cur, "SELECT numero_fecha_inicio FROM sancion_jugador "
                    "WHERE ci_jugador = %s AND motivo = 'acumulacion de amarillas'", (ci,)) == 5


def test_con_menos_de_tres_amarillas_no_queda_sancion(cur):
    ci, tarjetas = amarillas_en_partidos(cur, 3)
    assert sanciones_por_amarillas(cur, ci) == 1
    cur.execute("DELETE FROM tarjeta WHERE id_tarjeta = %s", (tarjetas[0],))
    assert sanciones_por_amarillas(cur, ci) == 0


def test_seis_amarillas_son_dos_sanciones_aunque_se_corrija_una(cur):
    ci, tarjetas = amarillas_en_partidos(cur, 7)
    assert sanciones_por_amarillas(cur, ci) == 2
    cur.execute("DELETE FROM tarjeta WHERE id_tarjeta = %s", (tarjetas[2],))
    assert sanciones_por_amarillas(cur, ci) == 2


# ---------- sanción disciplinaria y planilla ----------

def test_no_se_sanciona_una_fecha_en_la_que_ya_figura_en_planilla(cur):
    ci = uno(cur, INSCRIPTO_SIN_TARJETAS, (8,))
    falla(cur, "INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio, "
               "cantidad_fechas, descripcion) VALUES (%s, 1, 'disciplinaria', 3, 2, 'x')",
          (ci,), mensaje="ya figura en la planilla")
    # desde la fecha siguiente sí
    cur.execute("INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio, "
                "cantidad_fechas, descripcion) VALUES (%s, 1, 'disciplinaria', 4, 2, 'x')", (ci,))


def test_tampoco_se_mueve_una_sancion_hacia_una_fecha_con_planilla(cur):
    ci = uno(cur, INSCRIPTO_SIN_TARJETAS, (8,))
    cur.execute("INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio, "
                "cantidad_fechas, descripcion) VALUES (%s, 1, 'disciplinaria', 4, 1, 'x')", (ci,))
    id_sancion = cur.lastrowid
    falla(cur, "UPDATE sancion_jugador SET numero_fecha_inicio = 3 WHERE id_sancion = %s",
          (id_sancion,), mensaje="ya figura en la planilla")


# ---------- partidos con planilla ----------

def test_partido_con_planilla_no_cambia_de_rival_ni_de_dia(cur):
    partido_pasado_con_planilla(cur)
    falla(cur, "UPDATE partido SET id_equipo_visitante = 6, numero_fecha = 5 WHERE id_partido = 11",
          mensaje="planilla cargada")
    falla(cur, "UPDATE partido SET dia = CURDATE() + INTERVAL 9 DAY WHERE id_partido = 11",
          mensaje="planilla cargada")


def test_partido_con_planilla_no_se_cancela_ni_se_posterga(cur):
    partido_pasado_con_planilla(cur)
    falla(cur, "UPDATE partido SET estado = 'cancelado' WHERE id_partido = 11", mensaje="planilla cargada")
    falla(cur, "UPDATE partido SET estado = 'postergado' WHERE id_partido = 11", mensaje="planilla cargada")


def test_quitando_la_planilla_se_puede_cancelar(cur):
    ci = partido_pasado_con_planilla(cur)
    cur.execute("DELETE FROM planilla_partido WHERE id_partido = 11 AND ci_jugador = %s", (ci,))
    cur.execute("UPDATE partido SET estado = 'cancelado' WHERE id_partido = 11")


def test_partido_con_planilla_puede_cambiar_de_cancha(cur):
    partido_pasado_con_planilla(cur)
    cur.execute("UPDATE partido SET id_complejo = 2, nombre_cancha = 'Cancha A' WHERE id_partido = 11")


# ---------- los reportes solo cuentan partidos jugados ----------

def test_partido_sin_cerrar_no_cuenta_en_los_reportes(cur):
    goles = uno(cur, "SELECT SUM(goles) FROM v_goleadores WHERE id_torneo = 1")
    puntaje = uno(cur, "SELECT puntaje FROM v_fair_play WHERE id_equipo = 1")

    ci = partido_pasado_con_planilla(cur)
    cur.execute("INSERT INTO gol (id_partido, ci_jugador, minuto) VALUES (11, %s, 10)", (ci,))
    amarilla(cur, ci, 20, partido=11)

    assert uno(cur, "SELECT SUM(goles) FROM v_goleadores WHERE id_torneo = 1") == goles
    assert uno(cur, "SELECT puntaje FROM v_fair_play WHERE id_equipo = 1") == puntaje


def test_fair_play_sigue_incluyendo_equipos_sin_tarjetas(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2)
    assert uno(cur, "SELECT COUNT(*) FROM v_fair_play WHERE id_torneo = %s AND puntaje = 0", (t,)) == 2


# ---------- estado de la edición ----------

def test_no_se_carga_planilla_con_la_edicion_en_inscripcion(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2, anio=2025)
    p = programar(cur, t, 1, a, b, "2025-04-10")
    ci = uno(cur, "SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s LIMIT 1", (a,))
    falla(cur, "INSERT INTO planilla_partido VALUES (%s, %s, %s)", (p, ci, a), mensaje="en inscripción")


def test_con_la_edicion_en_curso_la_planilla_se_carga(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2, anio=2025)
    p = programar(cur, t, 1, a, b, "2025-04-10")
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    ci = uno(cur, "SELECT ci_jugador FROM equipo_jugador_torneo WHERE id_equipo = %s LIMIT 1", (a,))
    cur.execute("INSERT INTO planilla_partido VALUES (%s, %s, %s)", (p, ci, a))


def test_no_se_finaliza_con_partidos_pendientes(cur):
    falla(cur, "UPDATE torneo SET estado = 'finalizado' WHERE id_torneo = 1", mensaje="Quedan partidos sin jugar")


def test_se_finaliza_si_lo_pendiente_se_cancelo(cur):
    cur.execute("UPDATE partido SET estado = 'cancelado' WHERE id_torneo = 1 "
                "AND estado IN ('programado', 'postergado')")
    cur.execute("UPDATE torneo SET estado = 'finalizado' WHERE id_torneo = 1")


def test_las_fechas_del_torneo_incluyen_a_sus_partidos(cur):
    falla(cur, "UPDATE torneo SET fecha_inicio = CURDATE() WHERE id_torneo = 1", mensaje="fuera de esas fechas")
    # alargarlo no molesta
    cur.execute("UPDATE torneo SET fecha_fin = fecha_fin + INTERVAL 1 DAY WHERE id_torneo = 1")


def test_no_se_suma_un_equipo_con_el_fixture_generado(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2)
    p = programar(cur, t, 1, a, b, "2031-04-10")
    falla(cur, "INSERT INTO equipo (nombre, id_torneo, id_facultad) VALUES ('Tarde', %s, 1)",
          (t,), mensaje="ya tiene partidos")
    # borrando los partidos se puede, para generar el fixture de nuevo
    cur.execute("DELETE FROM partido WHERE id_partido = %s", (p,))
    cur.execute("INSERT INTO equipo (nombre, id_torneo, id_facultad) VALUES ('Tarde', %s, 1)", (t,))


# ---------- un equipo, un partido a la vez ----------

def test_equipo_no_juega_en_dos_canchas_a_la_misma_hora(cur):
    t, (a, b, c, d) = nuevo_torneo(cur, equipos=4)
    programar(cur, t, 1, a, b, "2031-04-10", turno=1)
    falla(cur, "INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
               "id_turno, id_complejo, nombre_cancha) VALUES (%s, 2, %s, %s, '2031-04-10', 1, 2, 'Cancha A')",
          (t, a, c), mensaje="ese día en ese turno")
    # otros equipos, u otro turno, sí
    programar(cur, t, 2, a, c, "2031-04-10", turno=2, cancha=(2, "Cancha A"))
    programar(cur, t, 1, c, d, "2031-04-10", turno=1, cancha=(2, "Cancha A"))


def test_un_partido_postergado_no_bloquea_el_horario(cur):
    t, (a, b, c) = nuevo_torneo(cur)
    p = programar(cur, t, 1, a, b, "2031-04-10", turno=1)
    cur.execute("UPDATE partido SET estado = 'postergado' WHERE id_partido = %s", (p,))
    programar(cur, t, 2, a, c, "2031-04-10", turno=1, cancha=(2, "Cancha A"))


def test_equipo_no_queda_sin_capitan_con_el_torneo_iniciado(cur):
    falla(cur, "UPDATE equipo SET ci_capitan = NULL WHERE id_equipo = 1", mensaje="sin capitán")
    # cambiarlo por otro jugador del plantel sí
    cur.execute("UPDATE equipo SET ci_capitan = %s WHERE id_equipo = 1", (ci_de(cur, "Mateo", "Rodríguez"),))


def test_en_inscripcion_el_capitan_puede_faltar(cur):
    t, (eq,) = nuevo_torneo(cur, equipos=1, jugadores=1)
    cur.execute("UPDATE equipo SET ci_capitan = NULL WHERE id_equipo = %s", (eq,))


def test_no_se_inscribe_un_equipo_con_el_torneo_iniciado(cur):
    t, _ = nuevo_torneo(cur, equipos=2)
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    falla(cur, "INSERT INTO equipo (nombre, id_torneo, id_facultad) VALUES ('Tarde', %s, 1)",
          (t,), mensaje="etapa de inscripción")


def test_toda_edicion_empieza_en_inscripcion(cur):
    for estado in ("en curso", "finalizado"):
        falla(cur, "INSERT INTO torneo (nombre, anio, semestre, fecha_inicio, fecha_fin, estado) "
                   "VALUES ('x', 2032, 1, '2032-03-01', '2032-07-01', %s)", (estado,),
              mensaje="etapa de inscripción")
