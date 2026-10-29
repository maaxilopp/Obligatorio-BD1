"""Sanciones automáticas y estado del torneo."""
from conftest import ci_de, falla, nuevo_torneo, uno


def test_roja_suspende_la_fecha_siguiente(cur):
    cur.execute("SELECT motivo, desde_fecha, hasta_fecha FROM v_sanciones WHERE jugador = 'Diego Sosa'")
    assert cur.fetchall() == (("roja", 3, 3),)


def test_tercera_amarilla_suspende_la_fecha_siguiente(cur):
    cur.execute("SELECT motivo, desde_fecha, hasta_fecha FROM v_sanciones WHERE jugador = 'Matías Arrieta'")
    assert cur.fetchall() == (("acumulacion de amarillas", 4, 4),)


def test_dos_amarillas_no_suspenden(cur):
    # Mateo Rodríguez (Ingenieros FC) tiene 2 amarillas en la edición
    assert uno(cur, "SELECT COUNT(*) FROM v_sanciones WHERE jugador = 'Mateo Rodríguez'") == 0


def test_tarjeta_nueva_genera_sancion_y_al_borrarla_se_borra(cur):
    ci = ci_de(cur, "Lautaro", "Medina")   # Bisturí FC, jugó el partido 8 (fecha 3, ayer)
    cur.execute("INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES (8, %s, 40, 'roja')", (ci,))
    id_tarjeta = cur.lastrowid
    cur.execute("SELECT motivo, numero_fecha_inicio FROM sancion_jugador WHERE id_tarjeta = %s", (id_tarjeta,))
    assert cur.fetchone() == ("roja", 4)
    cur.execute("DELETE FROM tarjeta WHERE id_tarjeta = %s", (id_tarjeta,))
    assert uno(cur, "SELECT COUNT(*) FROM sancion_jugador WHERE ci_jugador = %s", (ci,)) == 0


def test_una_sola_roja_por_jugador_y_partido(cur):
    ci = ci_de(cur, "Lautaro", "Medina")
    cur.execute("INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES (8, %s, 40, 'roja')", (ci,))
    falla(cur, "INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES (8, %s, 45, 'roja')",
          (ci,), errno=1062)


def test_sancion_solo_a_jugadores_inscriptos_en_la_edicion(cur):
    # Lucía Fagúndez no está inscripta en ningún equipo
    falla(cur, "INSERT INTO sancion_jugador (ci_jugador, id_torneo, motivo, numero_fecha_inicio) "
               "VALUES ('51234567', 1, 'disciplinaria', 4)", errno=1452)


def test_torneo_solo_avanza_de_estado(cur):
    falla(cur, "UPDATE torneo SET estado = 'inscripcion' WHERE id_torneo = 1", mensaje="solo avanza")
    t, _ = nuevo_torneo(cur, equipos=1, jugadores=1)
    falla(cur, "UPDATE torneo SET estado = 'finalizado' WHERE id_torneo = %s", (t,), mensaje="solo avanza")


def test_torneo_finalizado_no_admite_partidos_nuevos(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2)
    cur.execute("UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,))
    cur.execute("UPDATE torneo SET estado = 'finalizado' WHERE id_torneo = %s", (t,))
    falla(cur, "INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
               "id_turno, id_complejo, nombre_cancha) VALUES (%s, 1, %s, %s, '2031-04-10', 1, 1, 'Cancha 1')",
          (t, a, b), mensaje="finalizado")


def test_borrar_una_amarilla_recalcula_la_acumulacion(cur):
    # Mateo Rodríguez tiene 2 amarillas (una en el partido 8, de ayer).
    # Se le carga una 3ra por error -> sanción. Se borra la del minuto 9:
    # vuelve a tener 2 amarillas y la sanción tiene que desaparecer.
    ci = ci_de(cur, "Mateo", "Rodríguez")
    cur.execute("INSERT INTO tarjeta (id_partido, ci_jugador, minuto, color) VALUES (8, %s, 50, 'amarilla')", (ci,))
    assert uno(cur, "SELECT COUNT(*) FROM sancion_jugador WHERE ci_jugador = %s", (ci,)) == 1
    cur.execute("DELETE FROM tarjeta WHERE id_partido = 8 AND ci_jugador = %s AND minuto = 9", (ci,))
    assert uno(cur, "SELECT COUNT(*) FROM sancion_jugador WHERE ci_jugador = %s", (ci,)) == 0


def test_no_se_cambia_el_color_de_una_tarjeta_con_update(cur):
    ci = ci_de(cur, "Sebastián", "Correa")
    falla(cur, "UPDATE tarjeta SET color = 'roja' WHERE id_partido = 8 AND ci_jugador = %s", (ci,),
          mensaje="eliminala y cargala de nuevo")
    # el minuto sí se puede corregir
    cur.execute("UPDATE tarjeta SET minuto = 40 WHERE id_partido = 8 AND ci_jugador = %s", (ci,))


def test_torneo_no_arranca_con_equipos_incompletos(cur):
    t, (a, b) = nuevo_torneo(cur, equipos=2, jugadores=5)
    cur.execute("UPDATE equipo SET ci_capitan = NULL WHERE id_equipo = %s", (b,))
    falla(cur, "UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,), mensaje="necesita capitán")


def test_torneo_no_arranca_con_menos_de_5_jugadores(cur):
    t, _ = nuevo_torneo(cur, equipos=2, jugadores=4)
    falla(cur, "UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,), mensaje="al menos 5 jugadores")


def test_torneo_no_arranca_con_un_solo_equipo(cur):
    t, _ = nuevo_torneo(cur, equipos=1, jugadores=5)
    falla(cur, "UPDATE torneo SET estado = 'en curso' WHERE id_torneo = %s", (t,), mensaje="al menos 2 equipos")