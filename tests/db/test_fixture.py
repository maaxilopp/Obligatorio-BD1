"""Generador automático de fixture (procedimiento generar_fixture)."""
import pytest

from conftest import falla, nuevo_torneo, uno


@pytest.mark.parametrize("n_equipos", [4, 5, 6])
def test_fixture_liga_a_una_rueda(cur, n_equipos):
    t, equipos = nuevo_torneo(cur, equipos=n_equipos)
    cur.execute("CALL generar_fixture(%s, '2031-03-05')", (t,))

    # todos contra todos una vez: n(n-1)/2 partidos
    assert uno(cur, "SELECT COUNT(*) FROM partido WHERE id_torneo = %s", (t,)) == n_equipos * (n_equipos - 1) // 2

    # n-1 fechas si n es par, n si es impar (cada equipo descansa una)
    fechas_esperadas = n_equipos - 1 if n_equipos % 2 == 0 else n_equipos
    assert uno(cur, "SELECT COUNT(DISTINCT numero_fecha) FROM partido WHERE id_torneo = %s", (t,)) == fechas_esperadas

    # cada equipo juega contra cada rival exactamente una vez
    cur.execute("""SELECT LEAST(id_equipo_local, id_equipo_visitante), GREATEST(id_equipo_local, id_equipo_visitante)
                   FROM partido WHERE id_torneo = %s""", (t,))
    cruces = cur.fetchall()
    assert len(set(cruces)) == len(cruces)

    # cada equipo como máximo un partido por fecha
    cur.execute("""SELECT id_equipo, numero_fecha, COUNT(*) FROM (
                       SELECT id_equipo_local AS id_equipo, numero_fecha FROM partido WHERE id_torneo = %s
                       UNION ALL
                       SELECT id_equipo_visitante, numero_fecha FROM partido WHERE id_torneo = %s) x
                   GROUP BY id_equipo, numero_fecha HAVING COUNT(*) > 1""", (t, t))
    assert cur.fetchall() == ()


def test_fixture_solo_sobre_torneo_vacio(cur):
    falla(cur, "CALL generar_fixture(1, CURDATE())", mensaje="ya tiene partidos")
