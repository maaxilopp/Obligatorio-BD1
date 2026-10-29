"""
Alta, baja y modificación de jugadores, solo administradores
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/jugadores", tags=["Jugadores"])

TipoJugador = Literal["grado", "posgrado", "docente", "funcionario"]


class JugadorDatos(BaseModel):
    """Campos editables de un jugador (todo menos la cédula)."""
    nombre: str = Field(min_length=1, max_length=50)
    apellido: str = Field(min_length=1, max_length=50)
    email: str = Field(max_length=100, pattern=r"^[^@ ]+@[^@ ]+\.[^@ ]+$")
    fecha_nacimiento: date
    id_facultad: int = Field(gt=0)
    tipo: TipoJugador

    @field_validator("nombre", "apellido")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("no puede estar vacío")
        return valor

    @field_validator("email")
    @classmethod
    def email_en_minuscula(cls, valor: str) -> str:
        return valor.strip().lower()

    @field_validator("fecha_nacimiento")
    @classmethod
    def fecha_razonable(cls, valor: date) -> date:
        if valor >= date.today():
            raise ValueError("tiene que ser una fecha pasada")
        if valor.year < 1920:
            raise ValueError("no es una fecha válida")
        return valor


class JugadorNuevo(JugadorDatos):
    ci: str = Field(pattern=r"^[0-9]{7,8}$", description="7 u 8 dígitos, sin puntos ni guión")


COLUMNAS = """j.ci, j.nombre, j.apellido, j.email, j.fecha_nacimiento,
              j.id_facultad, f.nombre AS facultad, j.tipo"""


@router.get("")
def listar_jugadores(id_facultad: int | None = None, tipo: TipoJugador | None = None,
                     usuario: dict = Depends(solo_admin)):
    sql = f"SELECT {COLUMNAS} FROM jugador j JOIN facultad f ON f.id_facultad = j.id_facultad WHERE 1 = 1"
    parametros = []
    if id_facultad is not None:
        sql += " AND j.id_facultad = %s"
        parametros.append(id_facultad)
    if tipo is not None:
        sql += " AND j.tipo = %s"
        parametros.append(tipo)
    return consultar(usuario, sql + " ORDER BY j.apellido, j.nombre", tuple(parametros))


@router.get("/{ci}")
def obtener_jugador(ci: str, usuario: dict = Depends(solo_admin)):
    filas = consultar(usuario, f"""SELECT {COLUMNAS} FROM jugador j
                                  JOIN facultad f ON f.id_facultad = j.id_facultad
                                  WHERE j.ci = %s""", (ci,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe un jugador con esa cédula")
    return filas[0]


@router.post("", status_code=201)
def crear_jugador(jugador: JugadorNuevo, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, """
        INSERT INTO jugador (ci, nombre, apellido, email, fecha_nacimiento, id_facultad, tipo)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (jugador.ci, jugador.nombre, jugador.apellido, jugador.email,
          jugador.fecha_nacimiento, jugador.id_facultad, jugador.tipo))
    return obtener_jugador(jugador.ci, usuario)


@router.put("/{ci}")
def modificar_jugador(ci: str, jugador: JugadorDatos, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, """
        UPDATE jugador
        SET nombre = %s, apellido = %s, email = %s, fecha_nacimiento = %s,
            id_facultad = %s, tipo = %s
        WHERE ci = %s
    """, (jugador.nombre, jugador.apellido, jugador.email, jugador.fecha_nacimiento,
          jugador.id_facultad, jugador.tipo, ci))
    if filas == 0:
        # rowcount es 0 también si no cambió nada: verificamos que exista
        obtener_jugador(ci, usuario)
    return obtener_jugador(ci, usuario)


@router.delete("/{ci}", status_code=204)
def eliminar_jugador(ci: str, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM jugador WHERE ci = %s", (ci,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe un jugador con esa cédula")