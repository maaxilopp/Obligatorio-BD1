"""Pruebas de integración de los routers de facultades, complejos, canchas,
turnos, equipos y torneos.

Se ejecutan contra la base de pruebas real que prepara tests/conftest.py.
No usar contra una base con datos importantes: conftest.py recrea torneo_futbol5.
"""

from fastapi.testclient import TestClient
import pytest

from backend.main import app

api = TestClient(app)


@pytest.fixture(scope="module")
def admin():
    r = api.post("/login", json={"correo": "admin@ucu.edu.uy", "contrasena": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def planillero():
    r = api.post("/login", json={"correo": "planillero@ucu.edu.uy", "contrasena": "planillero123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def crear_torneo(api, headers, sufijo="test-router"):
    datos = {
        "nombre": f"Torneo {sufijo}",
        "anio": 2097,
        "semestre": 1,
        "fecha_inicio": "2097-03-01",
        "fecha_fin": "2097-07-31",
    }
    r = api.post("/torneos", json=datos, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id_torneo"], datos


def test_facultades_crud_y_lectura_por_rol(admin, planillero):
    datos = {"nombre": "Facultad test API"}
    creado = api.post("/facultades", json=datos, headers=admin)
    assert creado.status_code == 201, creado.text
    id_facultad = creado.json()["id_facultad"]

    try:
        obtenido = api.get(f"/facultades/{id_facultad}", headers=admin)
        assert obtenido.status_code == 200
        assert obtenido.json()["nombre"] == datos["nombre"]

        listado = api.get("/facultades", headers=planillero)
        assert listado.status_code == 200
        assert any(f["id_facultad"] == id_facultad for f in listado.json())

        modificado = api.put(
            f"/facultades/{id_facultad}",
            json={"nombre": "Facultad test API modificada"},
            headers=admin,
        )
        assert modificado.status_code == 200, modificado.text
        assert modificado.json()["nombre"] == "Facultad test API modificada"
    finally:
        eliminado = api.delete(f"/facultades/{id_facultad}", headers=admin)
        assert eliminado.status_code in (204, 404), eliminado.text

    assert api.get(f"/facultades/{id_facultad}", headers=admin).status_code == 404


def test_complejos_canchas_y_turnos_crud(admin, planillero):
    datos = {
        "nombre": "Complejo test API",
        "direccion": "Calle de prueba 123",
        "departamento": "Montevideo",
    }
    creado = api.post("/complejos", json=datos, headers=admin)
    assert creado.status_code == 201, creado.text
    id_complejo = creado.json()["id_complejo"]

    try:
        # Lectura disponible para el planillero.
        listado = api.get("/complejos", headers=planillero)
        assert listado.status_code == 200
        assert any(c["id_complejo"] == id_complejo for c in listado.json())

        obtenido = api.get(f"/complejos/{id_complejo}", headers=admin)
        assert obtenido.status_code == 200

        cancha = {
            "nombre_cancha": "Cancha test",
            "superficie": "sintetico",
            "techada": False,
        }
        alta_cancha = api.post(
            f"/complejos/{id_complejo}/canchas", json=cancha, headers=admin
        )
        assert alta_cancha.status_code == 201, alta_cancha.text

        listado_canchas = api.get(
            f"/complejos/{id_complejo}/canchas", headers=planillero
        )
        assert listado_canchas.status_code == 200
        assert any(c["nombre_cancha"] == "Cancha test" for c in listado_canchas.json())

        modificada = api.put(
            f"/complejos/{id_complejo}/canchas/Cancha test",
            json={"superficie": "parquet", "techada": True},
            headers=admin,
        )
        assert modificada.status_code == 200, modificada.text
        assert modificada.json()["superficie"] == "parquet"
        assert modificada.json()["techada"] is True

        baja_cancha = api.delete(
            f"/complejos/{id_complejo}/canchas/Cancha test", headers=admin
        )
        assert baja_cancha.status_code == 204, baja_cancha.text

        turnos = api.get("/turnos", headers=planillero)
        assert turnos.status_code == 200
        assert len(turnos.json()) > 0
    finally:
        # La cancha puede haber sido eliminada antes de llegar al finally.
        api.delete(f"/complejos/{id_complejo}/canchas/Cancha test", headers=admin)
        baja_complejo = api.delete(f"/complejos/{id_complejo}", headers=admin)
        assert baja_complejo.status_code in (204, 404), baja_complejo.text


def test_equipos_crud_y_permisos(admin, planillero):
    id_torneo, _ = crear_torneo(api, admin, "equipos-api")
    id_equipo = None
    try:
        datos = {"nombre": "Equipo test API", "id_torneo": id_torneo, "id_facultad": 1}
        creado = api.post("/equipos", json=datos, headers=admin)
        assert creado.status_code == 201, creado.text
        id_equipo = creado.json()["id_equipo"]

        listado = api.get(f"/equipos?id_torneo={id_torneo}", headers=planillero)
        assert listado.status_code == 200
        assert any(e["id_equipo"] == id_equipo for e in listado.json())

        obtenido = api.get(f"/equipos/{id_equipo}", headers=planillero)
        assert obtenido.status_code == 200
        assert obtenido.json()["nombre"] == "Equipo test API"

        modificado = api.put(
            f"/equipos/{id_equipo}",
            json={"nombre": "Equipo test API editado", "ci_capitan": None},
            headers=admin,
        )
        assert modificado.status_code == 200, modificado.text
        assert modificado.json()["nombre"] == "Equipo test API editado"

        # El planillero puede consultar, pero no crear ni modificar equipos.
        denegado = api.post("/equipos", json=datos, headers=planillero)
        assert denegado.status_code == 403
    finally:
        if id_equipo is not None:
            baja_equipo = api.delete(f"/equipos/{id_equipo}", headers=admin)
            assert baja_equipo.status_code in (204, 404), baja_equipo.text
        baja_torneo = api.delete(f"/torneos/{id_torneo}", headers=admin)
        assert baja_torneo.status_code in (204, 404), baja_torneo.text


def test_torneos_crud_y_validacion_de_fechas(admin, planillero):
    id_torneo, datos = crear_torneo(api, admin, "crud-api")
    try:
        obtenido = api.get(f"/torneos/{id_torneo}", headers=planillero)
        assert obtenido.status_code == 200
        assert obtenido.json()["estado"] == "inscripcion"

        nuevo = {**datos, "nombre": "Torneo test API editado"}
        modificado = api.put(f"/torneos/{id_torneo}", json=nuevo, headers=admin)
        assert modificado.status_code == 200, modificado.text
        assert modificado.json()["nombre"] == nuevo["nombre"]

        # Las fechas incoherentes deben rechazarse antes de llegar a MySQL.
        invalido = api.post(
            "/torneos",
            json={
                "nombre": "Torneo fechas inválidas",
                "anio": 2097,
                "semestre": 1,
                "fecha_inicio": "2097-08-01",
                "fecha_fin": "2097-03-01",
            },
            headers=admin,
        )
        assert invalido.status_code == 422

        denegado = api.post(
            "/torneos",
            json={**datos, "nombre": "Torneo planillero no puede crear"},
            headers=planillero,
        )
        assert denegado.status_code == 403
    finally:
        baja = api.delete(f"/torneos/{id_torneo}", headers=admin)
        assert baja.status_code in (204, 404), baja.text
