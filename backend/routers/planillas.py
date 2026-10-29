"""Partidos desde el punto de vista del planillero: ver los partidos, cargar
goles y cerrar el partido.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth import admin_o_planillero
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/partidos", tags=["Planillas"])


class GolNuevo(BaseModel):
    ci_jugador: str = Field(pattern=r"^[0-9]{7,8}$")
    minuto: int = Field(ge=0, le=60)
    autogol: bool = False


@router.get("")
def listar_partidos(id_torneo: int, numero_fecha: int | None = None,
                    usuario: dict = Depends(admin_o_planillero)):
    sql = """SELECT id_partido, numero_fecha, dia, id_turno, id_complejo, nombre_cancha, estado,
                    equipo_local, goles_local, goles_visitante, equipo_visitante
             FROM v_resultado_partido WHERE id_torneo = %s"""
    parametros = [id_torneo]
    if numero_fecha is not None:
        sql += " AND numero_fecha = %s"
        parametros.append(numero_fecha)
    return consultar(usuario, sql + " ORDER BY numero_fecha, dia, id_turno", tuple(parametros))


@router.get("/{id_partido}/goles")
def listar_goles(id_partido: int, usuario: dict = Depends(admin_o_planillero)):
    return consultar(usuario, """
        SELECT g.id_gol, g.ci_jugador, CONCAT(j.nombre, ' ', j.apellido) AS jugador,
               g.minuto, g.autogol, g.id_equipo_beneficiado
        FROM v_gol_detalle g JOIN jugador j ON j.ci = g.ci_jugador
        WHERE g.id_partido = %s ORDER BY g.minuto, g.id_gol
    """, (id_partido,))


@router.post("/{id_partido}/goles", status_code=201)
def agregar_gol(id_partido: int, gol: GolNuevo, usuario: dict = Depends(admin_o_planillero)):
    _, id_gol = ejecutar(usuario,
                         "INSERT INTO gol (id_partido, ci_jugador, minuto, autogol) VALUES (%s, %s, %s, %s)",
                         (id_partido, gol.ci_jugador, gol.minuto, gol.autogol))
    return {"id_gol": id_gol}


@router.delete("/{id_partido}/goles/{id_gol}", status_code=204)
def eliminar_gol(id_partido: int, id_gol: int, usuario: dict = Depends(admin_o_planillero)):
    filas, _ = ejecutar(usuario, "DELETE FROM gol WHERE id_gol = %s AND id_partido = %s",
                        (id_gol, id_partido))
    if filas == 0:
        raise HTTPException(status_code=404, detail="Ese gol no existe en ese partido")


@router.post("/{id_partido}/marcar-jugado")
def marcar_jugado(id_partido: int, usuario: dict = Depends(admin_o_planillero)):
    # El planillero no tiene UPDATE sobre partido: usa el procedimiento
    # marcar_jugado (SQL SECURITY DEFINER), que solo cambia el estado.
    ejecutar(usuario, "CALL marcar_jugado(%s)", (id_partido,))
    return {"id_partido": id_partido, "estado": "jugado"}