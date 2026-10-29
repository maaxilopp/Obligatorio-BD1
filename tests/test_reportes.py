"""Reportes: se ejecuta db/07_reportes.sql tal cual y se comparan los
resultados con lo que se calculó a mano a partir de db/06_datos.sql.

Si se agrega o reordena una consulta en 07_reportes.sql, actualizar NOMBRES.
"""
import pytest

from conftest import RAIZ, conectar, dividir_sentencias

NOMBRES = [
    "posiciones", "goleadores", "fair_play", "promedio_goles", "canchas", "turnos",
    "jugadores_facultad", "nunca_jugaron", "sanciones_equipo", "porcentaje_estados",
    "remontadas", "goles_por_franja", "racha", "suspendidos", "auditoria",
]


@pytest.fixture(scope="module")
def r():
    con = conectar()
    resultados = []
    with con.cursor() as cur:
        sql = (RAIZ / "db" / "07_reportes.sql").read_text(encoding="utf-8")
        for sentencia in dividir_sentencias(sql):
            cur.execute(sentencia)
            if cur.description:
                resultados.append(cur.fetchall())
    con.close()
    assert len(resultados) == len(NOMBRES)
    return dict(zip(NOMBRES, resultados))


def test_tabla_de_posiciones_con_desempates(r):
    equipos = [fila[1] for fila in r["posiciones"]]

    assert equipos == [
        "Derecho al Gol",
        "Ingenieros FC",
        "Bisturí FC",
        "Dando clase",
        "Analisis FODA FC",
        "Vilardebo FC",
    ]

    # posicion, equipo, pj, pg, pe, pp, gf, gc, dg, pts
    assert r["posiciones"][0] == (
        1, "Derecho al Gol", 3, 1, 2, 0, 7, 4, 3, 5
    )
    assert r["posiciones"][5] == (
        6, "Vilardebo FC", 3, 0, 0, 3, 1, 7, -6, 0
    )


def test_goleadores_sin_autogoles(r):
    assert len(r["goleadores"]) == 10
    assert r["goleadores"][0] == ("Valentín Cabrera", "Derecho al Gol", 4)
    assert all(f[0] != "Federico López" for f in r["goleadores"])


def test_fair_play(r):
    assert r["fair_play"][-1][1:] == ("Vilardebo FC", 2, 1, 5)
    assert {
        f[1] for f in r["fair_play"]
        if f[0] == 1
    } == {"Bisturí FC", "Derecho al Gol", "Ingenieros FC"}


def test_promedio_de_goles(r):
    filas = {f[0]: f[1:] for f in r["promedio_goles"]}
    assert float(filas["Total edición"][2]) == pytest.approx(3.11)
    assert filas["Fecha 3"][:2] == (3, 11)


def test_cancha_y_turno_mas_usados(r):
    assert r["canchas"][0][:2] == ("Complejo Deportivo UCU", "Cancha 1")
    assert r["turnos"][0] == ("18:00 a 19:00", 8)


def test_jugadores_por_facultad_y_tipo(r):
    total = r["jugadores_facultad"][-1]
    assert total[0] == "TOTAL"
    assert tuple(int(x) for x in total[1:]) == (36, 4, 3, 2, 45)


def test_inscriptos_que_nunca_jugaron(r):
    assert {f[3] for f in r["nunca_jugaron"]} == {
        "Ricardo Olivera", "Hernán Da Silva"
    }


def test_sanciones_por_equipo_y_motivo(r):
    assert r["sanciones_equipo"][0][0] == "Vilardebo FC"
    assert tuple(int(x) for x in r["sanciones_equipo"][0][1:]) == (1, 0, 1, 2)


def test_porcentaje_jugados_vs_postergados_cancelados(r):
    filas = {f[0]: float(f[2]) for f in r["porcentaje_estados"]}
    assert filas == {"jugado": 81.8, "cancelado": 9.1, "postergado": 9.1}


def test_remontadas(r):
    assert [f[2] for f in r["remontadas"]] == ["Bisturí FC", "Derecho al Gol"]


def test_goles_por_franja_suman_el_total(r):
    assert sum(f[1] for f in r["goles_por_franja"]) == 28


def test_racha(r):
    racha = {f[0]: f[1] for f in r["racha"]}
    assert racha["Vilardebo FC"] == "P P P"
    assert racha["Ingenieros FC"] == "E E G"
