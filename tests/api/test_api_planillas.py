
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from conftest import conectar

api = TestClient(app)


@pytest.fixture(scope="module")
def planillero():
    r = api.post("/login", json={"correo": "planillero@ucu.edu.uy", "contrasena": "planillero123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_listar_partidos_de_una_fecha(planillero):
    partidos = api.get("/partidos", params={"id_torneo": 1, "numero_fecha": 3}, headers=planillero).json()
    assert len(partidos) == 3 and all(p["estado"] == "jugado" for p in partidos)


def test_listar_goles_de_un_partido(planillero):
    goles = api.get("/partidos/1/goles", headers=planillero).json()
    assert len(goles) == 3 and sum(g["autogol"] for g in goles) == 1


def test_minuto_invalido_lo_frena_el_backend(planillero):
    r = api.post("/partidos/8/goles", headers=planillero, json={"ci_jugador": "41100048", "minuto": 75})
    assert r.status_code == 422 and r.json()["errores"][0]["campo"] == "minuto"


def test_borrar_un_gol_que_no_existe(planillero):
    assert api.delete("/partidos/8/goles/99999", headers=planillero).status_code == 404


def test_la_correccion_queda_auditada_con_el_correo_del_planillero(planillero):
    r = api.post("/partidos/8/goles", headers=planillero, json={"ci_jugador": "41100048", "minuto": 57})
    id_gol = r.json()["id_gol"]
    try:
        con = conectar()
        with con.cursor() as cur:
            cur.execute("SELECT usuario FROM auditoria_resultado WHERE detalle LIKE %s "
                        "ORDER BY id_auditoria DESC LIMIT 1", ("%min 57%",))
            assert cur.fetchone()[0] == "planillero@ucu.edu.uy"
        con.close()
    finally:
        api.delete(f"/partidos/8/goles/{id_gol}", headers=planillero)