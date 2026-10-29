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


class JugadorPlanilla(BaseModel):
    ci_jugador: str = Field(pattern=r"^[0-9]{7,8}$")
    id_equipo: int = Field(gt=0)


class TarjetaNueva(BaseModel):
    ci_jugador: str = Field(pattern=r"^[0-9]{7,8}$")
    minuto: int = Field(ge=0, le=60)
    color: str = Field(pattern=r"^(amarilla|roja)$")


@router.get("/{id_partido}/plantel")
def obtener_planteles_partido(id_partido: int, usuario: dict = Depends(admin_o_planillero)):
    partido = consultar(usuario, "SELECT id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante FROM partido WHERE id_partido=%s", (id_partido,))
    if not partido:
        raise HTTPException(status_code=404, detail="No existe ese partido")
    p = partido[0]
    return consultar(usuario, """
        SELECT ejt.id_equipo, e.nombre AS equipo, j.ci, j.nombre, j.apellido,
               ejt.numero_camiseta,
               EXISTS(SELECT 1 FROM sancion_jugador s WHERE s.ci_jugador=j.ci AND s.id_torneo=%s
                      AND %s BETWEEN s.numero_fecha_inicio AND s.numero_fecha_inicio+s.cantidad_fechas-1) AS suspendido,
               EXISTS(SELECT 1 FROM planilla_partido pp WHERE pp.id_partido=%s AND pp.ci_jugador=j.ci) AS en_planilla
        FROM equipo_jugador_torneo ejt JOIN jugador j ON j.ci=ejt.ci_jugador
        JOIN equipo e ON e.id_equipo=ejt.id_equipo
        WHERE ejt.id_equipo IN (%s,%s) ORDER BY e.nombre, ejt.numero_camiseta
    """, (p["id_torneo"], p["numero_fecha"], id_partido, p["id_equipo_local"], p["id_equipo_visitante"]))


@router.get("/{id_partido}/planilla")
def listar_planilla(id_partido: int, usuario: dict = Depends(admin_o_planillero)):
    existe = consultar(usuario, "SELECT id_partido FROM partido WHERE id_partido=%s", (id_partido,))
    if not existe:
        raise HTTPException(status_code=404, detail="No existe ese partido")
    return consultar(usuario, """
        SELECT pp.id_partido, pp.id_equipo, e.nombre AS equipo, j.ci, j.nombre, j.apellido
        FROM planilla_partido pp JOIN equipo e ON e.id_equipo=pp.id_equipo
        JOIN jugador j ON j.ci=pp.ci_jugador WHERE pp.id_partido=%s ORDER BY e.nombre,j.apellido,j.nombre
    """, (id_partido,))


@router.post("/{id_partido}/planilla", status_code=201)
def agregar_a_planilla(id_partido: int, datos: JugadorPlanilla, usuario: dict = Depends(admin_o_planillero)):
    ejecutar(usuario, "INSERT INTO planilla_partido (id_partido,ci_jugador,id_equipo) VALUES (%s,%s,%s)", (id_partido, datos.ci_jugador, datos.id_equipo))
    return {"id_partido": id_partido, "ci_jugador": datos.ci_jugador, "id_equipo": datos.id_equipo}


@router.delete("/{id_partido}/planilla/{ci_jugador}", status_code=204)
def quitar_de_planilla(id_partido: int, ci_jugador: str, usuario: dict = Depends(admin_o_planillero)):
    filas, _ = ejecutar(usuario, "DELETE FROM planilla_partido WHERE id_partido=%s AND ci_jugador=%s", (id_partido, ci_jugador))
    if filas == 0:
        raise HTTPException(status_code=404, detail="El jugador no figura en la planilla de ese partido")


@router.get("/{id_partido}/tarjetas")
def listar_tarjetas(id_partido: int, usuario: dict = Depends(admin_o_planillero)):
    return consultar(usuario, """
        SELECT t.id_tarjeta,t.id_partido,t.ci_jugador,CONCAT(j.nombre,' ',j.apellido) AS jugador,
               t.minuto,t.color FROM tarjeta t JOIN jugador j ON j.ci=t.ci_jugador
        WHERE t.id_partido=%s ORDER BY t.minuto,t.id_tarjeta
    """, (id_partido,))


@router.post("/{id_partido}/tarjetas", status_code=201)
def agregar_tarjeta(id_partido: int, datos: TarjetaNueva, usuario: dict = Depends(admin_o_planillero)):
    _, id_tarjeta = ejecutar(usuario, "INSERT INTO tarjeta (id_partido,ci_jugador,minuto,color) VALUES (%s,%s,%s,%s)", (id_partido, datos.ci_jugador, datos.minuto, datos.color))
    return {"id_tarjeta": id_tarjeta, "id_partido": id_partido}


@router.delete("/{id_partido}/tarjetas/{id_tarjeta}", status_code=204)
def eliminar_tarjeta(id_partido: int, id_tarjeta: int, usuario: dict = Depends(admin_o_planillero)):
    filas, _ = ejecutar(usuario, "DELETE FROM tarjeta WHERE id_tarjeta=%s AND id_partido=%s", (id_tarjeta, id_partido))
    if filas == 0:
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe en ese partido")


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