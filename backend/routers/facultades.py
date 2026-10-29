"""
Facultades: la lectura es para administradores y planilleros (la usan los
formularios del front); el alta, baja y modificación, solo para administradores.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import admin_o_planillero, solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/facultades", tags=["Facultades"])


class FacultadDatos(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)

    @field_validator("nombre")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("no puede estar vacío")
        return valor


@router.get("")
def listar_facultades(usuario: dict = Depends(admin_o_planillero)):
    return consultar(usuario, "SELECT id_facultad, nombre FROM facultad ORDER BY nombre")


@router.get("/{id_facultad}")
def obtener_facultad(id_facultad: int, usuario: dict = Depends(admin_o_planillero)):
    filas = consultar(usuario, "SELECT id_facultad, nombre FROM facultad WHERE id_facultad = %s",
                      (id_facultad,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe esa facultad")
    return filas[0]


@router.post("", status_code=201)
def crear_facultad(facultad: FacultadDatos, usuario: dict = Depends(solo_admin)):
    _, id_facultad = ejecutar(usuario, "INSERT INTO facultad (nombre) VALUES (%s)", (facultad.nombre,))
    return obtener_facultad(id_facultad, usuario)


@router.put("/{id_facultad}")
def modificar_facultad(id_facultad: int, facultad: FacultadDatos, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, "UPDATE facultad SET nombre = %s WHERE id_facultad = %s",
             (facultad.nombre, id_facultad))
    # rowcount es 0 también si no cambió nada: obtener_facultad verifica que exista
    return obtener_facultad(id_facultad, usuario)


@router.delete("/{id_facultad}", status_code=204)
def eliminar_facultad(id_facultad: int, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM facultad WHERE id_facultad = %s", (id_facultad,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe esa facultad")