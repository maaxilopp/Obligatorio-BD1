"""Consulta y administración de sanciones disciplinarias."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from backend.auth import admin_o_planillero, solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/sanciones", tags=["Sanciones"])
Motivo = Literal["roja", "acumulacion de amarillas", "disciplinaria"]

class SancionNueva(BaseModel):
    ci_jugador: str = Field(pattern=r"^[0-9]{7,8}$")
    id_torneo: int = Field(gt=0)
    motivo: Literal["disciplinaria"] = "disciplinaria"
    numero_fecha_inicio: int = Field(ge=1, le=255)
    cantidad_fechas: int = Field(ge=1, le=255)
    descripcion: str = Field(min_length=1, max_length=255)

COLUMNAS = "id_sancion, ci_jugador, id_torneo, motivo, numero_fecha_inicio, cantidad_fechas, id_tarjeta, descripcion"

@router.get("")
def listar_sanciones(id_torneo: int | None = None, ci_jugador: str | None = None,
                     automaticas: bool | None = None, usuario: dict = Depends(admin_o_planillero)):
    sql = f"SELECT {COLUMNAS} FROM sancion_jugador WHERE 1=1"
    params = []
    if id_torneo is not None:
        sql += " AND id_torneo=%s"; params.append(id_torneo)
    if ci_jugador is not None:
        sql += " AND ci_jugador=%s"; params.append(ci_jugador)
    if automaticas is True:
        sql += " AND id_tarjeta IS NOT NULL"
    elif automaticas is False:
        sql += " AND id_tarjeta IS NULL"
    sql += " ORDER BY id_torneo, numero_fecha_inicio, ci_jugador"
    return consultar(usuario, sql, tuple(params))

@router.get("/{id_sancion}")
def obtener_sancion(id_sancion: int, usuario: dict = Depends(admin_o_planillero)):
    filas = consultar(usuario, f"SELECT {COLUMNAS} FROM sancion_jugador WHERE id_sancion=%s", (id_sancion,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe esa sanción")
    return filas[0]

@router.post("", status_code=201)
def crear_sancion(datos: SancionNueva, usuario: dict = Depends(solo_admin)):
    _, id_sancion = ejecutar(usuario, "INSERT INTO sancion_jugador (ci_jugador,id_torneo,motivo,numero_fecha_inicio,cantidad_fechas,descripcion) VALUES (%s,%s,%s,%s,%s,%s)", (datos.ci_jugador, datos.id_torneo, datos.motivo, datos.numero_fecha_inicio, datos.cantidad_fechas, datos.descripcion.strip()))
    return obtener_sancion(id_sancion, usuario)

@router.put("/{id_sancion}")
def modificar_sancion(id_sancion: int, datos: SancionNueva, usuario: dict = Depends(solo_admin)):
    actual = obtener_sancion(id_sancion, usuario)
    if actual["id_tarjeta"] is not None:
        raise HTTPException(status_code=400, detail="Las sanciones automáticas se corrigen modificando o eliminando la tarjeta que las originó")
    ejecutar(usuario, "UPDATE sancion_jugador SET ci_jugador=%s,id_torneo=%s,motivo=%s,numero_fecha_inicio=%s,cantidad_fechas=%s,descripcion=%s WHERE id_sancion=%s", (datos.ci_jugador, datos.id_torneo, datos.motivo, datos.numero_fecha_inicio, datos.cantidad_fechas, datos.descripcion.strip(), id_sancion))
    return obtener_sancion(id_sancion, usuario)

@router.delete("/{id_sancion}", status_code=204)
def eliminar_sancion(id_sancion: int, usuario: dict = Depends(solo_admin)):
    actual = obtener_sancion(id_sancion, usuario)
    if actual["id_tarjeta"] is not None:
        raise HTTPException(status_code=400, detail="Las sanciones automáticas se eliminan al eliminar la tarjeta que las originó")
    ejecutar(usuario, "DELETE FROM sancion_jugador WHERE id_sancion=%s", (id_sancion,))
