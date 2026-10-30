"""Administración de partidos. La base de datos valida cruces, fechas y cancha."""
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from backend.auth import solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/partidos", tags=["Administración de partidos"])
EstadoEditable = Literal["programado", "cancelado", "postergado"]

class PartidoDatos(BaseModel):
    id_torneo: int = Field(gt=0)
    numero_fecha: int = Field(ge=1, le=255)
    id_equipo_local: int = Field(gt=0)
    id_equipo_visitante: int = Field(gt=0)
    dia: date
    id_turno: int = Field(gt=0)
    id_complejo: int = Field(gt=0)
    nombre_cancha: str = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def equipos_distintos(self):
        if self.id_equipo_local == self.id_equipo_visitante:
            raise ValueError("Los equipos local y visitante deben ser distintos")
        self.nombre_cancha = self.nombre_cancha.strip()
        return self

class EstadoPartido(BaseModel):
    estado: EstadoEditable

COLUMNAS = "id_partido, id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, id_turno, id_complejo, nombre_cancha, estado"

def _partido(id_partido: int, usuario: dict):
    filas = consultar(usuario, f"SELECT {COLUMNAS} FROM partido WHERE id_partido = %s", (id_partido,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe ese partido")
    return filas[0]

@router.post("", status_code=201)
def crear_partido(datos: PartidoDatos, usuario: dict = Depends(solo_admin)):
    _, id_partido = ejecutar(usuario, f"INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, id_turno, id_complejo, nombre_cancha) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", tuple(datos.model_dump().values()))
    return _partido(id_partido, usuario)

@router.get("/{id_partido}/administracion")
def obtener_partido(id_partido: int, usuario: dict = Depends(solo_admin)):
    return _partido(id_partido, usuario)

@router.put("/{id_partido}")
def modificar_partido(id_partido: int, datos: PartidoDatos, usuario: dict = Depends(solo_admin)):
    _partido(id_partido, usuario)
    ejecutar(usuario, "UPDATE partido SET id_torneo=%s, numero_fecha=%s, id_equipo_local=%s, id_equipo_visitante=%s, dia=%s, id_turno=%s, id_complejo=%s, nombre_cancha=%s WHERE id_partido=%s", (*tuple(datos.model_dump().values()), id_partido))
    return _partido(id_partido, usuario)

@router.patch("/{id_partido}/estado")
def cambiar_estado_partido(id_partido: int, cambio: EstadoPartido, usuario: dict = Depends(solo_admin)):
    _partido(id_partido, usuario)
    ejecutar(usuario, "UPDATE partido SET estado=%s WHERE id_partido=%s", (cambio.estado, id_partido))
    return _partido(id_partido, usuario)

@router.delete("/{id_partido}", status_code=204)
def eliminar_partido(id_partido: int, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM partido WHERE id_partido=%s", (id_partido,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe ese partido")

@router.get("/{id_partido}/auditoria")
def auditoria_partido(id_partido: int, usuario: dict = Depends(solo_admin)):
    _partido(id_partido, usuario)
    return consultar(usuario, "SELECT id_auditoria, id_partido, tabla, accion, detalle, usuario, fecha_hora FROM auditoria_resultado WHERE id_partido=%s ORDER BY fecha_hora, id_auditoria", (id_partido,))