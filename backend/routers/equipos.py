"""
Equipos y planteles.

Lectura: administradores y planilleros. Escritura: solo administradores.

Las reglas del plantel (5 a 10 jugadores, máximo 2 docentes/funcionarios,
misma facultad que el equipo, un solo equipo por edición, solo modificable en
inscripción) las garantiza la base; acá se devuelve el mensaje en español.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import admin_o_planillero, solo_admin
from backend.database import consultar, ejecutar

router = APIRouter(prefix="/equipos", tags=["Equipos y planteles"])

CI = r"^[0-9]{7,8}$"


class EquipoNuevo(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    id_torneo: int = Field(gt=0)
    id_facultad: int = Field(gt=0)

    @field_validator("nombre")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("no puede estar vacío")
        return valor


class EquipoDatos(BaseModel):
    """Lo único que se edita de un equipo: el nombre y el capitán (que tiene que
    estar en el plantel). El torneo y la facultad no cambian."""
    nombre: str = Field(min_length=1, max_length=50)
    ci_capitan: str | None = Field(default=None, pattern=CI)

    @field_validator("nombre")
    @classmethod
    def sin_espacios_sobrantes(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("no puede estar vacío")
        return valor


class JugadorEnPlantel(BaseModel):
    ci_jugador: str = Field(pattern=CI)
    numero_camiseta: int = Field(ge=1, le=99)


class Camiseta(BaseModel):
    numero_camiseta: int = Field(ge=1, le=99)


def _equipo(id_equipo: int, usuario: dict) -> dict:
    filas = consultar(usuario, """
        SELECT e.id_equipo, e.nombre, e.id_torneo, e.id_facultad, f.nombre AS facultad,
               e.ci_capitan,
               (SELECT COUNT(*) FROM equipo_jugador_torneo ejt
                WHERE ejt.id_equipo = e.id_equipo) AS cantidad_jugadores
        FROM equipo e JOIN facultad f ON f.id_facultad = e.id_facultad
        WHERE e.id_equipo = %s
    """, (id_equipo,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe ese equipo")
    return filas[0]


def _exigir_inscripcion(id_torneo: int, usuario: dict):
    """Los equipos se inscriben (y se dan de baja) solo mientras el torneo está en inscripción."""
    filas = consultar(usuario, "SELECT estado FROM torneo WHERE id_torneo = %s", (id_torneo,))
    if not filas:
        raise HTTPException(status_code=404, detail="No existe ese torneo")
    if filas[0]["estado"] != "inscripcion":
        raise HTTPException(status_code=400,
                            detail="Los equipos solo pueden inscribirse o darse de baja mientras el "
                                   "torneo está en etapa de inscripción")


@router.get("")
def listar_equipos(id_torneo: int | None = None, id_facultad: int | None = None,
                   usuario: dict = Depends(admin_o_planillero)):
    sql = """SELECT e.id_equipo, e.nombre, e.id_torneo, e.id_facultad, f.nombre AS facultad,
                    e.ci_capitan, CONCAT(c.nombre, ' ', c.apellido) AS capitan,
                    (SELECT COUNT(*) FROM equipo_jugador_torneo ejt
                     WHERE ejt.id_equipo = e.id_equipo) AS cantidad_jugadores
             FROM equipo e
             JOIN facultad f ON f.id_facultad = e.id_facultad
             LEFT JOIN jugador c ON c.ci = e.ci_capitan
             WHERE 1 = 1"""
    parametros = []
    if id_torneo is not None:
        sql += " AND e.id_torneo = %s"
        parametros.append(id_torneo)
    if id_facultad is not None:
        sql += " AND e.id_facultad = %s"
        parametros.append(id_facultad)
    return consultar(usuario, sql + " ORDER BY e.nombre", tuple(parametros))


@router.get("/{id_equipo}")
def obtener_equipo(id_equipo: int, usuario: dict = Depends(admin_o_planillero)):
    equipo = _equipo(id_equipo, usuario)
    equipo["jugadores"] = listar_plantel(id_equipo, usuario)
    return equipo


@router.post("", status_code=201)
def crear_equipo(equipo: EquipoNuevo, usuario: dict = Depends(solo_admin)):
    _exigir_inscripcion(equipo.id_torneo, usuario)
    # Se crea sin capitán: tiene que ser uno de sus jugadores, así que se asigna
    # (PUT /equipos/{id}) después de cargar el plantel.
    _, id_equipo = ejecutar(usuario, "INSERT INTO equipo (nombre, id_torneo, id_facultad) VALUES (%s, %s, %s)",
                            (equipo.nombre, equipo.id_torneo, equipo.id_facultad))
    return _equipo(id_equipo, usuario)


@router.put("/{id_equipo}")
def modificar_equipo(id_equipo: int, equipo: EquipoDatos, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, "UPDATE equipo SET nombre = %s, ci_capitan = %s WHERE id_equipo = %s",
             (equipo.nombre, equipo.ci_capitan, id_equipo))
    return _equipo(id_equipo, usuario)   # también verifica que exista


@router.delete("/{id_equipo}", status_code=204)
def eliminar_equipo(id_equipo: int, usuario: dict = Depends(solo_admin)):
    _exigir_inscripcion(_equipo(id_equipo, usuario)["id_torneo"], usuario)
    filas, _ = ejecutar(usuario, "DELETE FROM equipo WHERE id_equipo = %s", (id_equipo,))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe ese equipo")


# ---------- plantel ----------

@router.get("/{id_equipo}/jugadores")
def listar_plantel(id_equipo: int, usuario: dict = Depends(admin_o_planillero)):
    _equipo(id_equipo, usuario)
    jugadores = consultar(usuario, """
        SELECT j.ci, j.nombre, j.apellido, j.tipo, ejt.numero_camiseta,
               COALESCE(e.ci_capitan = j.ci, 0) AS es_capitan
        FROM equipo_jugador_torneo ejt
        JOIN equipo e  ON e.id_equipo = ejt.id_equipo
        JOIN jugador j ON j.ci = ejt.ci_jugador
        WHERE ejt.id_equipo = %s
        ORDER BY ejt.numero_camiseta
    """, (id_equipo,))
    for jugador in jugadores:
        jugador["es_capitan"] = bool(jugador["es_capitan"])
    return jugadores


@router.post("/{id_equipo}/jugadores", status_code=201)
def agregar_jugador(id_equipo: int, datos: JugadorEnPlantel, usuario: dict = Depends(solo_admin)):
    # El torneo y la facultad se toman del equipo, así el cliente no puede
    # mandar una combinación inconsistente.
    filas, _ = ejecutar(usuario, """
        INSERT INTO equipo_jugador_torneo (id_equipo, ci_jugador, id_torneo, id_facultad, numero_camiseta)
        SELECT e.id_equipo, %s, e.id_torneo, e.id_facultad, %s FROM equipo e WHERE e.id_equipo = %s
    """, (datos.ci_jugador, datos.numero_camiseta, id_equipo))
    if filas == 0:
        raise HTTPException(status_code=404, detail="No existe ese equipo")
    return obtener_equipo(id_equipo, usuario)


@router.put("/{id_equipo}/jugadores/{ci_jugador}")
def cambiar_camiseta(id_equipo: int, ci_jugador: str, datos: Camiseta, usuario: dict = Depends(solo_admin)):
    ejecutar(usuario, """
        UPDATE equipo_jugador_torneo SET numero_camiseta = %s WHERE id_equipo = %s AND ci_jugador = %s
    """, (datos.numero_camiseta, id_equipo, ci_jugador))
    plantel = listar_plantel(id_equipo, usuario)
    if not any(j["ci"] == ci_jugador for j in plantel):
        raise HTTPException(status_code=404, detail="Ese jugador no está en el plantel")
    return plantel


@router.delete("/{id_equipo}/jugadores/{ci_jugador}", status_code=204)
def quitar_jugador(id_equipo: int, ci_jugador: str, usuario: dict = Depends(solo_admin)):
    filas, _ = ejecutar(usuario, "DELETE FROM equipo_jugador_torneo WHERE id_equipo = %s AND ci_jugador = %s",
                        (id_equipo, ci_jugador))
    if filas == 0:
        raise HTTPException(status_code=404, detail="Ese jugador no está en el plantel")