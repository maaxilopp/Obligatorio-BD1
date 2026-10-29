"""
Complejos deportivos, canchas y turnos.

Lectura: administradores y planilleros. Alta, baja y modificación: solo
administradores. Los turnos son fijos (18:00 a 23:00), solo se consultan.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import admin_o_planillero, solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(tags=["Complejos y canchas"])

Departamento = Literal[
    "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
    "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
    "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"]

# En la base se guarda sin tilde (ENUM 'sintetico'); el front puede mostrar "sintético".
Superficie = Literal["sintetico", "parquet"]


def _texto_no_vacio(valor: str) -> str:
    valor = valor.strip()
    if not valor:
        raise ValueError("no puede estar vacío")
    return valor


class ComplejoDatos(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    direccion: str = Field(min_length=1, max_length=150)
    departamento: Departamento

    @field_validator("nombre", "direccion")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        return _texto_no_vacio(valor)


class CanchaDatos(BaseModel):
    superficie: Superficie
    techada: bool


class CanchaNueva(CanchaDatos):
    nombre_cancha: str = Field(min_length=1, max_length=50)

    @field_validator("nombre_cancha")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        return _texto_no_vacio(valor)


# ---------- turnos ----------

@router.get("/turnos")
def listar_turnos(usuario: dict = Depends(admin_o_planillero)):
    # CAST ... AS CHAR: el conector devuelve los TIME como timedelta, que no sale como "18:00" en el JSON
    return consultar(usuario, """
        SELECT id_turno,
               SUBSTR(CAST(hora_inicio AS CHAR), 1, 5) AS hora_inicio,
               SUBSTR(CAST(hora_fin AS CHAR), 1, 5)    AS hora_fin
        FROM turno ORDER BY hora_inicio
    """)


# ---------- complejos ----------

@router.get("/complejos")
def listar_complejos(departamento: Departamento | None = None,
                     usuario: dict = Depends(admin_o_planillero)):
    sql = """SELECT c.id_complejo, c.nombre, c.direccion, c.departamento,
                    (SELECT COUNT(*) FROM cancha ca WHERE ca.id_complejo = c.id_complejo) AS cantidad_canchas
             FROM complejo c"""
    parametros = []
    if departamento is not None:
        sql += " WHERE c.departamento = %s"
        parametros.append(departamento)
    return consultar(usuario, sql + " ORDER BY c.nombre", tuple(parametros))


def _complejo(id_complejo: int, usuario: dict) -> dict:
    filas = consultar(usuario, """SELECT id_complejo, nombre, direccion, departamento
                                  FROM complejo WHERE id_complejo = %s""", (id_complejo,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe ese complejo")
    return filas[0]


@router.get("/complejos/{id_complejo}")
def obtener_complejo(id_complejo: int, usuario: dict = Depends(admin_o_planillero)):
    complejo = _complejo(id_complejo, usuario)
    complejo["canchas"] = listar_canchas(id_complejo, usuario)
    return complejo


@router.post("/complejos", status_code=201)
def crear_complejo(complejo: ComplejoDatos, usuario: dict = Depends(solo_admin)):
    _, id_complejo = ejecutar(usuario, """
        INSERT INTO complejo (nombre, direccion, departamento) VALUES (%s, %s, %s)
    """, (complejo.nombre, complejo.direccion, complejo.departamento))
    return _complejo(id_complejo, usuario)


@router.put("/complejos/{id_complejo}")
def modificar_complejo(id_complejo: int, complejo: ComplejoDatos, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, """
        UPDATE complejo SET nombre = %s, direccion = %s, departamento = %s WHERE id_complejo = %s
    """, (complejo.nombre, complejo.direccion, complejo.departamento, id_complejo))
    return _complejo(id_complejo, usuario)   # también verifica que exista


@router.delete("/complejos/{id_complejo}", status_code=204)
def eliminar_complejo(id_complejo: int, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM complejo WHERE id_complejo = %s", (id_complejo,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe ese complejo")


# ---------- canchas ----------

def _con_booleano(filas: list[dict]) -> list[dict]:
    for fila in filas:
        fila["techada"] = bool(fila["techada"])
    return filas


@router.get("/complejos/{id_complejo}/canchas")
def listar_canchas(id_complejo: int, usuario: dict = Depends(admin_o_planillero)):
    _complejo(id_complejo, usuario)
    return _con_booleano(consultar(usuario, """
        SELECT id_complejo, nombre_cancha, superficie, techada
        FROM cancha WHERE id_complejo = %s ORDER BY nombre_cancha
    """, (id_complejo,)))


def _cancha(id_complejo: int, nombre_cancha: str, usuario: dict) -> dict:
    filas = _con_booleano(consultar(usuario, """
        SELECT id_complejo, nombre_cancha, superficie, techada
        FROM cancha WHERE id_complejo = %s AND nombre_cancha = %s
    """, (id_complejo, nombre_cancha)))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe esa cancha en ese complejo")
    return filas[0]


@router.post("/complejos/{id_complejo}/canchas", status_code=201)
def crear_cancha(id_complejo: int, cancha: CanchaNueva, usuario: dict = Depends(solo_admin)):
    _complejo(id_complejo, usuario)
    ejecutar(usuario, """
        INSERT INTO cancha (id_complejo, nombre_cancha, superficie, techada) VALUES (%s, %s, %s, %s)
    """, (id_complejo, cancha.nombre_cancha, cancha.superficie, cancha.techada))
    return _cancha(id_complejo, cancha.nombre_cancha, usuario)


@router.put("/complejos/{id_complejo}/canchas/{nombre_cancha}")
def modificar_cancha(id_complejo: int, nombre_cancha: str, cancha: CanchaDatos,
                     usuario: dict = Depends(solo_admin)):
    # El nombre es parte de la clave primaria (y los partidos la referencian): no se cambia.
    ejecutar(usuario, """
        UPDATE cancha SET superficie = %s, techada = %s WHERE id_complejo = %s AND nombre_cancha = %s
    """, (cancha.superficie, cancha.techada, id_complejo, nombre_cancha))
    return _cancha(id_complejo, nombre_cancha, usuario)


@router.delete("/complejos/{id_complejo}/canchas/{nombre_cancha}", status_code=204)
def eliminar_cancha(id_complejo: int, nombre_cancha: str, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM cancha WHERE id_complejo = %s AND nombre_cancha = %s",
                        (id_complejo, nombre_cancha))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe esa cancha en ese complejo")