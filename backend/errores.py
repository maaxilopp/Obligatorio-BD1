import re

from fastapi import HTTPException
from mysql.connector import Error

DUPLICADOS = {
    "jugador.PRIMARY": "Ya existe un jugador con esa cédula",
    "jugador.email": "Ya existe un jugador con ese email",
    "login.PRIMARY": "Ya existe un usuario con ese correo",
    "facultad.nombre": "Ya existe una facultad con ese nombre",
    "torneo.uq_torneo_edicion": "Ya existe una edición del torneo para ese año y semestre",
    "equipo.uq_equipo_nombre": "Ya existe un equipo con ese nombre en esta edición",
    "equipo_jugador_torneo.PRIMARY": "El jugador ya está en el plantel de ese equipo",
    "equipo_jugador_torneo.uq_jugador_un_equipo_por_torneo": "El jugador ya integra otro equipo en esta edición",
    "equipo_jugador_torneo.uq_camiseta": "Ese número de camiseta ya está usado en el equipo",
    "complejo.nombre": "Ya existe un complejo con ese nombre",
    "cancha.PRIMARY": "Ya existe una cancha con ese nombre en el complejo",
    "partido.uq_partido_cruce": "Esos equipos ya tienen un partido en esta edición (salvo que se haya cancelado)",
    "partido.uq_partido_cancha_turno": "La cancha ya tiene un partido en ese día y turno",
    "planilla_partido.PRIMARY": "El jugador ya figura en la planilla de ese partido",
    "tarjeta.uq_una_roja_por_partido": "El jugador ya tiene una tarjeta roja en ese partido",
}

REFERENCIAS = {
    "fk_jugador_facultad": "La facultad no existe",
    "fk_equipo_torneo": "El torneo no existe",
    "fk_equipo_facultad": "La facultad no existe",
    "fk_equipo_capitan": "El capitán tiene que ser un jugador del plantel del equipo",
    "fk_ejt_equipo": "El equipo no existe, no es de esa edición o no es de esa facultad",
    "fk_ejt_jugador": "El jugador no existe o no pertenece a la facultad del equipo",
    "fk_cancha_complejo": "El complejo no existe",
    "fk_partido_local": "El equipo local no existe o no es de esa edición del torneo",
    "fk_partido_visitante": "El equipo visitante no existe o no es de esa edición del torneo",
    "fk_partido_turno": "El turno no existe",
    "fk_partido_cancha": "La cancha no existe",
    "fk_planilla_partido": "El partido no existe",
    "fk_planilla_plantel": "El jugador no está en el plantel de ese equipo",
    "fk_gol_planilla": "Solo puede convertir goles un jugador que figure en la planilla del partido",
    "fk_tarjeta_planilla": "Solo puede recibir tarjetas un jugador que figure en la planilla del partido",
    "fk_sancion_inscripto": "Solo se puede sancionar a un jugador inscripto en esa edición del torneo",
}

CHECKS = {
    "chk_login_correo": "El correo no tiene un formato válido",
    "chk_jugador_ci": "La cédula debe tener 7 u 8 dígitos, sin puntos ni guión",
    "chk_jugador_email": "El email no tiene un formato válido",
    "chk_jugador_nombre": "El nombre y el apellido no pueden estar vacíos",
    "chk_torneo_semestre": "El semestre debe ser 1 o 2",
    "chk_torneo_fechas": "La fecha de fin no puede ser anterior a la de inicio",
    "chk_torneo_anio": "El año del torneo debe coincidir con el de su fecha de inicio",
    "chk_camiseta": "El número de camiseta debe estar entre 1 y 99",
    "chk_turno_rango": "Los turnos van de 18:00 a 23:00",
    "chk_turno_una_hora": "Los turnos duran una hora y empiezan en punto",
    "chk_partido_rivales": "Un equipo no puede jugar contra sí mismo",
    "chk_partido_fecha": "El número de fecha debe ser 1 o mayor",
    "chk_gol_minuto": "El minuto del gol debe estar entre 0 y 60",
    "chk_tarjeta_minuto": "El minuto de la tarjeta debe estar entre 0 y 60",
    "chk_sancion_fechas": "La sanción debe empezar en la fecha 1 o mayor y durar al menos una fecha",
}


def traducir_error(e: Error) -> HTTPException:
    mensaje = e.msg or ""

    if e.errno == 1644:
        return HTTPException(status_code=400, detail=mensaje)

    if e.errno == 1062:
        clave = re.search(r"for key '([^']+)'", mensaje)
        return HTTPException(
            status_code=409,
            detail=DUPLICADOS.get(clave.group(1) if clave else "", "Ya existe un registro con esos datos"))

    if e.errno == 1452:
        return HTTPException(status_code=400, detail=_por_constraint(mensaje, REFERENCIAS,
                                                                  "Hace referencia a un dato que no existe"))

    if e.errno == 1451:
        return HTTPException(status_code=409,
                             detail="No se puede eliminar porque tiene datos asociados "
                                    "(por ejemplo, partidos, planillas o planteles)")

    if e.errno == 3819:
        return HTTPException(status_code=400, detail=_por_constraint(mensaje, CHECKS, "Algún dato no es válido"))

    if e.errno in (1048, 1364):
        return HTTPException(status_code=400, detail="Falta completar un campo obligatorio")

    if e.errno in (1265, 1406, 1366):
        return HTTPException(status_code=400, detail="Algún dato tiene un valor o largo no permitido")

    if e.errno in (1142, 1143, 1370):
        return HTTPException(status_code=403, detail="Tu rol no tiene permiso para esta operación")

    return HTTPException(status_code=500, detail="Error inesperado en la base de datos")


def _por_constraint(mensaje: str, tabla: dict, por_defecto: str) -> str:
    for constraint, texto in tabla.items():
        if constraint in mensaje:
            return texto
    return por_defecto