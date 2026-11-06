import pytest
from fastapi.testclient import TestClient

from backend.main import app

api = TestClient(app)

REPORTES = ["posiciones", "goleadores", "fair-play", "promedio-goles", "canchas", "turnos",
            "jugadores-sin-planilla", "sanciones", "estado-partidos", "remontadas",
            "franjas-goles", "rachas"]


@pytest.fixture(scope="module")
def admin():
    r = api.post("/login", json={"correo": "admin@ucu.edu.uy", "contrasena": "admin123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.mark.parametrize("reporte", REPORTES)
def test_cada_reporte_responde_con_datos(admin, reporte):
    r = api.get(f"/torneos/1/{reporte}", headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()


def test_jugadores_por_facultad(admin):
    filas = api.get("/reportes/jugadores-facultad", headers=admin).json()
    assert filas[-1]["facultad"] == "TOTAL" and int(filas[-1]["total"]) == 45


def test_tabla_de_posiciones_ordenada_con_desempates(admin):
    tabla = api.get("/torneos/1/posiciones", headers=admin).json()["posiciones"]
    claves = [(f["pts"], f["dg"], f["gf"]) for f in tabla]
    assert claves == sorted(claves, reverse=True)


def test_goleadores_con_empatados(admin):
    filas = api.get("/torneos/1/goleadores", headers=admin).json()
    assert [f["posicion"] for f in filas[:4]] == [1, 2, 2, 2]
    assert len(filas) == 15  # entran todos los empatados del último puesto


def test_torneo_inexistente_da_404(admin):
    assert api.get("/torneos/999/posiciones", headers=admin).status_code == 404


def test_los_dos_roles_ven_la_lista_de_torneos():
    for correo, clave in [("admin@ucu.edu.uy", "admin123"), ("planillero@ucu.edu.uy", "planillero123")]:
        token = api.post("/login", json={"correo": correo, "contrasena": clave}).json()["token"]
        r = api.get("/torneos", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200 and len(r.json()) >= 1

def test_sanciones_cuenta_rojas_y_dobles_amarillas(admin):
    filas = api.get("/torneos/1/sanciones", headers=admin).json()
    assert sum(int(f["roja"]) for f in filas) == 2
    assert sum(int(f["doble_amarilla"]) for f in filas) == 0
    assert all(int(f["total"]) == int(f["roja"]) + int(f["doble_amarilla"])
               + int(f["acumulacion_amarillas"]) + int(f["disciplinaria"]) for f in filas)
