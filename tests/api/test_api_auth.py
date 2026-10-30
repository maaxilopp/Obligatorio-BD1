
from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

from backend.auth import ALGORITMO, SECRET_KEY
from backend.main import app

api = TestClient(app)


def con_token(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_devuelve_token_y_rol():
    r = api.post("/login", json={"correo": "planillero@ucu.edu.uy", "contrasena": "planillero123"})
    assert r.status_code == 200
    assert r.json()["rol"] == "planillero" and r.json()["token"]


def test_login_ignora_mayusculas_y_espacios_en_el_correo():
    r = api.post("/login", json={"correo": "  ADMIN@ucu.edu.uy ", "contrasena": "admin123"})
    assert r.status_code == 200


def test_correo_inexistente_da_el_mismo_error_que_contrasena_incorrecta():
    a = api.post("/login", json={"correo": "nadie@ucu.edu.uy", "contrasena": "x"})
    b = api.post("/login", json={"correo": "admin@ucu.edu.uy", "contrasena": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_token_vencido():
    token = jwt.encode({"sub": "admin@ucu.edu.uy", "rol": "administrador",
                        "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
                       SECRET_KEY, algorithm=ALGORITMO)
    r = api.get("/jugadores", headers=con_token(token))
    assert r.status_code == 401 and "expiró" in r.json()["detail"]


def test_token_firmado_con_otra_clave():
    # Alguien fabrica un token de administrador sin conocer la clave
    token = jwt.encode({"sub": "hacker@x.com", "rol": "administrador",
                        "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                       "una-clave-distinta-de-la-del-backend-32b", algorithm=ALGORITMO)
    assert api.get("/jugadores", headers=con_token(token)).status_code == 401


def test_token_basura():
    assert api.get("/jugadores", headers=con_token("esto-no-es-un-token")).status_code == 401


def test_endpoints_publicos():
    assert api.get("/").status_code == 200
    assert api.get("/health").json() == {"estado": "ok"}