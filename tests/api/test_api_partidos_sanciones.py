
from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.main import app

api = TestClient(app)


@pytest.fixture(scope="module")
def admin():
    r = api.post("/login", json={"correo": "admin@ucu.edu.uy", "contrasena": "admin123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def planillero():
    r = api.post("/login", json={"correo": "planillero@ucu.edu.uy", "contrasena": "planillero123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def partido_nuevo(**cambios):
    # fecha 5: Ingenieros FC vs Psico Team todavía no se programó
    datos = {"id_torneo": 1, "numero_fecha": 5, "id_equipo_local": 1, "id_equipo_visitante": 6,
             "dia": date.today().isoformat(), "id_turno": 5, "id_complejo": 1, "nombre_cancha": "Cancha 1"}
    return {**datos, **cambios}


def test_programar_postergar_reprogramar_y_eliminar(admin):
    r = api.post("/partidos", headers=admin, json=partido_nuevo())
    assert r.status_code == 201, r.text
    id_partido = r.json()["id_partido"]
    try:
        assert api.patch(f"/partidos/{id_partido}/estado", headers=admin,
                         json={"estado": "postergado"}).json()["estado"] == "postergado"
        # un partido postergado se puede volver a programar
        assert api.patch(f"/partidos/{id_partido}/estado", headers=admin,
                         json={"estado": "programado"}).json()["estado"] == "programado"
    finally:
        assert api.delete(f"/partidos/{id_partido}", headers=admin).status_code == 204


def test_equipos_iguales_lo_frena_el_backend(admin):
    r = api.post("/partidos", headers=admin, json=partido_nuevo(id_equipo_visitante=1))
    assert r.status_code == 422


def test_cruce_repetido_lo_frena_la_base(admin):
    # Ingenieros FC y Balance FC ya jugaron en la fecha 1
    r = api.post("/partidos", headers=admin, json=partido_nuevo(id_equipo_visitante=2))
    assert r.status_code == 409 and "ya tienen un partido" in r.json()["detail"]


def test_partido_jugado_no_se_mueve_ni_se_borra(admin):
    r = api.put("/partidos/1", headers=admin, json=partido_nuevo(numero_fecha=1, id_equipo_visitante=2))
    assert r.status_code == 400 and "no puede modificarse" in r.json()["detail"]
    assert api.delete("/partidos/1", headers=admin).status_code == 400


def test_no_se_puede_marcar_jugado_con_el_endpoint_de_estado(admin):
    assert api.patch("/partidos/11/estado", headers=admin, json={"estado": "jugado"}).status_code == 422


def test_el_planillero_no_administra_partidos(planillero):
    assert api.post("/partidos", headers=planillero, json=partido_nuevo()).status_code == 403


def test_sancion_disciplinaria_completa(admin):
    r = api.post("/sanciones", headers=admin, json={"ci_jugador": "41100048", "id_torneo": 1,
                                                     "numero_fecha_inicio": 5, "cantidad_fechas": 2,
                                                     "descripcion": "Prueba"})
    assert r.status_code == 201, r.text
    id_sancion = r.json()["id_sancion"]
    assert r.json()["motivo"] == "disciplinaria"
    assert api.delete(f"/sanciones/{id_sancion}", headers=admin).status_code == 204


def test_las_sanciones_automaticas_no_se_borran_a_mano(admin):
    automatica = api.get("/sanciones", headers=admin, params={"id_torneo": 1, "automaticas": True}).json()[0]
    r = api.delete(f"/sanciones/{automatica['id_sancion']}", headers=admin)
    assert r.status_code == 400 and "tarjeta" in r.json()["detail"]


def test_sancion_a_jugador_no_inscripto(admin):
    r = api.post("/sanciones", headers=admin, json={"ci_jugador": "51234567", "id_torneo": 1,
                                                     "numero_fecha_inicio": 5, "cantidad_fechas": 1,
                                                     "descripcion": "Prueba"})
    assert r.status_code == 400 and "inscripto" in r.json()["detail"]