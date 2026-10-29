"""
Ediciones del torneo: ABM, avance de estado y generación del fixture.

El listado `GET /torneos` ya lo tiene routers/reportes.py. Las reglas
(el estado solo avanza, para iniciar hacen falta equipos completos, etc.)
las controla la base con triggers.
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.auth import admin_o_planillero, solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/torneos", tags=["Torneos"])

EstadoTorneo = Literal["inscripcion", "en curso", "finalizado"]


class TorneoDatos(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    anio: int = Field(ge=2000, le=2100)
    semestre: int = Field(ge=1, le=2)
    fecha_inicio: date
    fecha_fin: date

    @field_validator("nombre")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("no puede estar vacío")
        return valor

    @model_validator(mode="after")
    def fechas_coherentes(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio")
        if self.fecha_inicio.year != self.anio:
            raise ValueError("El año del torneo debe coincidir con el de su fecha de inicio")
        return self


class CambioEstado(BaseModel):
    estado: EstadoTorneo


class FixtureDatos(BaseModel):
    primer_dia: date = Field(description="Día en que se juega la fecha 1; las demás, una semana después de la anterior")


COLUMNAS = "id_torneo, nombre, anio, semestre, fecha_inicio, fecha_fin, estado"


@router.get("/{id_torneo}")
def obtener_torneo(id_torneo: int, usuario: dict = Depends(admin_o_planillero)):
    filas = consultar(usuario, f"SELECT {COLUMNAS} FROM torneo WHERE id_torneo = %s", (id_torneo,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe ese torneo")
    return filas[0]


@router.post("", status_code=201)
def crear_torneo(torneo: TorneoDatos, usuario: dict = Depends(solo_admin)):
    # El estado inicial es siempre 'inscripcion' (default de la tabla)
    _, id_torneo = ejecutar(usuario, """
        INSERT INTO torneo (nombre, anio, semestre, fecha_inicio, fecha_fin) VALUES (%s, %s, %s, %s, %s)
    """, (torneo.nombre, torneo.anio, torneo.semestre, torneo.fecha_inicio, torneo.fecha_fin))
    return obtener_torneo(id_torneo, usuario)


@router.put("/{id_torneo}")
def modificar_torneo(id_torneo: int, torneo: TorneoDatos, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, """
        UPDATE torneo SET nombre = %s, anio = %s, semestre = %s, fecha_inicio = %s, fecha_fin = %s
        WHERE id_torneo = %s
    """, (torneo.nombre, torneo.anio, torneo.semestre, torneo.fecha_inicio, torneo.fecha_fin, id_torneo))
    return obtener_torneo(id_torneo, usuario)   # también verifica que exista


@router.patch("/{id_torneo}/estado")
def cambiar_estado(id_torneo: int, cambio: CambioEstado, usuario: dict = Depends(solo_admin)):
    """inscripcion -> en curso -> finalizado. Cualquier otro cambio lo rechaza el trigger."""
    ejecutar(usuario, "UPDATE torneo SET estado = %s WHERE id_torneo = %s", (cambio.estado, id_torneo))
    return obtener_torneo(id_torneo, usuario)


@router.delete("/{id_torneo}", status_code=204)
def eliminar_torneo(id_torneo: int, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM torneo WHERE id_torneo = %s", (id_torneo,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe ese torneo")


@router.post("/{id_torneo}/fixture", status_code=201)
def generar_fixture(id_torneo: int, datos: FixtureDatos, usuario: dict = Depends(solo_admin)):
    """Arma todo el fixture de la edición (todos contra todos, una rueda) con el
    procedimiento almacenado. Solo funciona sobre un torneo sin partidos."""
    ejecutar(usuario, "CALL generar_fixture(%s, %s)", (id_torneo, datos.primer_dia))
    return consultar(usuario, """
        SELECT id_partido, numero_fecha, dia, id_turno, id_complejo, nombre_cancha, estado,
               id_equipo_local, equipo_local, id_equipo_visitante, equipo_visitante
        FROM v_resultado_partido WHERE id_torneo = %s
        ORDER BY numero_fecha, dia, id_turno
    """, (id_torneo,))