"""
Login y control de acceso por rol.

"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from backend.database import consultar

SECRET_KEY = os.getenv("SECRET_KEY", "cambiar-esta-clave-en-produccion")
ALGORITMO = "HS256"
HORAS_VALIDEZ = 8

router = APIRouter(tags=["Autenticación"])
esquema_bearer = HTTPBearer(auto_error=False)


class Credenciales(BaseModel):
    correo: str = Field(min_length=3, max_length=100)
    contrasena: str = Field(min_length=1, max_length=100)


@router.post("/login")
def login(datos: Credenciales):
    filas = consultar({"rol": "auth"},
                      "SELECT correo, contrasena, rol FROM login WHERE correo = %s",
                      (datos.correo.strip().lower(),))

    # Mismo mensaje si no existe el correo o si la contraseña está mal, así no se puede averiguar qué correos están registrados.
    if not filas or not bcrypt.checkpw(datos.contrasena.encode(), filas[0]["contrasena"].encode()):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    usuario = filas[0]
    token = jwt.encode(
        {"sub": usuario["correo"], "rol": usuario["rol"],
         "exp": datetime.now(timezone.utc) + timedelta(hours=HORAS_VALIDEZ)},
        SECRET_KEY, algorithm=ALGORITMO)
    return {"token": token, "correo": usuario["correo"], "rol": usuario["rol"]}


def usuario_actual(credenciales: HTTPAuthorizationCredentials | None = Depends(esquema_bearer)) -> dict:
    if credenciales is None:
        raise HTTPException(status_code=401, detail="Tenés que iniciar sesión")
    try:
        datos = jwt.decode(credenciales.credentials, SECRET_KEY, algorithms=[ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró, volvé a iniciar sesión")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    return {"correo": datos["sub"], "rol": datos["rol"]}


def requiere_rol(*roles: str):
    """Dependencia para los endpoints: Depends(requiere_rol("administrador"))."""
    def verificar(usuario: dict = Depends(usuario_actual)) -> dict:
        if usuario["rol"] not in roles:
            raise HTTPException(status_code=403, detail="Tu rol no tiene permiso para esta operación")
        return usuario
    return verificar


solo_admin = requiere_rol("administrador")
admin_o_planillero = requiere_rol("administrador", "planillero")