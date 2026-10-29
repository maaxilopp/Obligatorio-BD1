"""
Conexión a MySQL según el rol del usuario logueado.

"""
import os

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

from backend.errores import traducir_error

load_dotenv()

CREDENCIALES = {
    "administrador": (os.getenv("DB_ADMIN_USER", "torneo_admin"),
                      os.getenv("DB_ADMIN_PASSWORD", "Admin.Torneo2026")),
    "planillero": (os.getenv("DB_PLANILLERO_USER", "torneo_planillero"),
                   os.getenv("DB_PLANILLERO_PASSWORD", "Planillero.Torneo2026")),
    "auth": (os.getenv("DB_AUTH_USER", "torneo_auth"),
             os.getenv("DB_AUTH_PASSWORD", "Auth.Torneo2026")),
}


def obtener_conexion(rol: str, correo: str | None = None):
    """Abre una conexión con el usuario de MySQL que corresponde al rol.

    - SET time_zone: los triggers usan NOW() (partido ya disputado, ventana
      de 48 h); sin esto, con el servidor en UTC todo queda corrido 3 horas.
    - @usuario_app: la auditoría de correcciones guarda este correo en vez
      del usuario de MySQL.
    """
    usuario, contrasena = CREDENCIALES[rol]
    conexion = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=usuario,
        password=contrasena,
        database=os.getenv("DB_NAME", "torneo_futbol5"),
        charset="utf8mb4",
        collation="utf8mb4_0900_ai_ci",
    )
    cursor = conexion.cursor()
    cursor.execute("SET time_zone = '-03:00'")
    cursor.execute("SET @usuario_app = %s", (correo,))
    cursor.close()
    return conexion


def consultar(usuario: dict, sql: str, parametros=()):
    """SELECT: devuelve una lista de diccionarios."""
    conexion = cursor = None
    try:
        conexion = obtener_conexion(usuario["rol"], usuario.get("correo"))
        cursor = conexion.cursor(dictionary=True)
        cursor.execute(sql, parametros)
        return cursor.fetchall()
    except Error as e:
        raise traducir_error(e)
    finally:
        _cerrar(conexion, cursor)


def ejecutar(usuario: dict, sql: str, parametros=()):
    """INSERT / UPDATE / DELETE / CALL en una transacción.

    Devuelve (filas_afectadas, id_generado). Si MySQL rechaza la operación
    (un trigger, una FK, un UNIQUE...), se deshace todo y se devuelve el
    error traducido.
    """
    conexion = cursor = None
    try:
        conexion = obtener_conexion(usuario["rol"], usuario.get("correo"))
        cursor = conexion.cursor()
        cursor.execute(sql, parametros)
        conexion.commit()
        return cursor.rowcount, cursor.lastrowid
    except Error as e:
        if conexion is not None and conexion.is_connected():
            conexion.rollback()
        raise traducir_error(e)
    finally:
        _cerrar(conexion, cursor)


def _cerrar(conexion, cursor):
    if cursor is not None:
        cursor.close()
    if conexion is not None and conexion.is_connected():
        conexion.close()