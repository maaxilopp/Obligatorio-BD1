"""Tests de la API: login, permisos por rol y traducción de errores.
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app

api = TestClient(app)

JUGADOR = {"ci": "12345678", "nombre": "Ana", "apellido": "Pérez", "email": "ana.test@correo.ucu.edu.uy",
           "fecha_nacimiento": "2003-05-01", "id_facultad": 1, "tipo": "grado"}


def token(correo, contrasena):
    r = api.post("/login", json={"correo": correo, "contrasena": contrasena})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return token("admin@ucu.edu.uy", "admin123")


@pytest.fixture(scope="module")
def planillero():
    return token("planillero@ucu.edu.uy", "planillero123")


def test_login_incorrecto():
    r = api.post("/login", json={"correo": "admin@ucu.edu.uy", "contrasena": "mal"})
    assert r.status_code == 401


def test_sin_sesion_no_hay_acceso():
    assert api.get("/jugadores").status_code == 401


def test_planillero_no_ve_reportes_ni_hace_abm(planillero):
    assert api.get("/torneos/1/posiciones", headers=planillero).status_code == 403
    assert api.post("/jugadores", json=JUGADOR, headers=planillero).status_code == 403


def test_reporte_de_posiciones(admin):
    r = api.get("/torneos/1/posiciones", headers=admin)
    assert r.status_code == 200
    assert r.json()["posiciones"][0]["posicion"] == 1


def test_abm_de_jugador_completo(admin):
    r = api.post("/jugadores", json=JUGADOR, headers=admin)
    assert r.status_code == 201, r.text
    try:
        assert api.post("/jugadores", json=JUGADOR, headers=admin).json()["detail"] == \
            "Ya existe un jugador con esa cédula"
        r = api.put("/jugadores/12345678", headers=admin,
                    json={**{k: v for k, v in JUGADOR.items() if k != "ci"}, "tipo": "posgrado"})
        assert r.json()["tipo"] == "posgrado"
    finally:
        assert api.delete("/jugadores/12345678", headers=admin).status_code == 204
    assert api.get("/jugadores/12345678", headers=admin).status_code == 404


def test_validacion_del_backend_en_espanol(admin):
    r = api.post("/jugadores", headers=admin, json={**JUGADOR, "ci": "12.345", "tipo": "hincha"})
    assert r.status_code == 422
    campos = {e["campo"]: e["mensaje"] for e in r.json()["errores"]}
    assert campos == {"ci": "no tiene un formato válido", "tipo": "no es un valor permitido"}


def test_errores_de_la_base_traducidos(admin):
    r = api.post("/jugadores", headers=admin, json={**JUGADOR, "id_facultad": 99})
    assert (r.status_code, r.json()["detail"]) == (400, "La facultad no existe")
    r = api.delete("/jugadores/41100048", headers=admin)  # está en un plantel
    assert r.status_code == 409


def test_planillero_carga_goles_y_la_base_aplica_las_reglas(planillero):
    # partido 8 se jugó ayer: dentro de las 48 h
    r = api.post("/partidos/8/goles", headers=planillero, json={"ci_jugador": "41100048", "minuto": 59})
    assert r.status_code == 201, r.text
    assert api.delete(f"/partidos/8/goles/{r.json()['id_gol']}", headers=planillero).status_code == 204
    # partido 1: fuera de las 48 h -> mensaje del trigger
    r = api.post("/partidos/1/goles", headers=planillero, json={"ci_jugador": "41100048", "minuto": 59})
    assert r.status_code == 400 and "48 horas" in r.json()["detail"]


def test_marcar_jugado_usa_el_procedimiento(planillero):
    r = api.post("/partidos/11/marcar-jugado", headers=planillero)  # fecha 4, a futuro
    assert r.status_code == 400 and "después de su día y turno" in r.json()["detail"]