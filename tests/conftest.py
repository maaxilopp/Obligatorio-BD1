"""Configuración común de los tests.

Los tests corren contra un MySQL real (no hay mocks): la idea es probar que
las reglas de negocio están garantizadas POR LA BASE, sin importar qué
aplicación la use.

Al empezar, se recrea torneo_futbol5 con los scripts de db/ (incluye los
datos de prueba). Cada test corre dentro de una transacción que se deshace
al final, así los tests no se afectan entre sí.

Configuración por variables de entorno: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.
"""

import os
import sys
from pathlib import Path

import pymysql
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "db"))
from setup_db import crear_base, dividir_sentencias  # noqa: E402

CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
}

# Usuarios creados en db/05_usuarios.sql
USUARIOS = {
    "admin": ("torneo_admin", "Admin.Torneo2026"),
    "planillero": ("torneo_planillero", "Planillero.Torneo2026"),
    "auth": ("torneo_auth", "Auth.Torneo2026"),
}


def conectar(user=None, password=None):
    con = pymysql.connect(
        host=CONFIG["host"], port=CONFIG["port"],
        user=user or CONFIG["user"],
        password=CONFIG["password"] if password is None else password,
        database="torneo_futbol5", charset="utf8mb4", autocommit=False,
    )
    with con.cursor() as cur:
        cur.execute("SET time_zone = '-03:00'")
    return con


@pytest.fixture(scope="session", autouse=True)
def base():
    """Recrea la base una vez por corrida de tests."""
    crear_base(**CONFIG, con_datos=True, verbose=False)


@pytest.fixture
def cur():
    """Cursor como root dentro de una transacción que se deshace al final."""
    con = conectar()
    cursor = con.cursor()
    try:
        yield cursor
    finally:
        con.rollback()
        con.close()


@pytest.fixture
def conexion_rol():
    """Abre conexiones con los usuarios de MySQL de cada rol."""
    abiertas = []

    def _abrir(rol):
        user, pwd = USUARIOS[rol]
        con = conectar(user, pwd)
        abiertas.append(con)
        return con.cursor()

    yield _abrir
    for con in abiertas:
        con.rollback()
        con.close()


# ---------- helpers ----------

def falla(cur, sql, params=None, mensaje=None, errno=None):
    """Ejecuta sql y verifica que MySQL lo rechace (por mensaje o por código)."""
    with pytest.raises(pymysql.MySQLError) as exc:
        cur.execute(sql, params)
    codigo, texto = exc.value.args[0], str(exc.value.args[1])
    if mensaje:
        assert mensaje in texto, f"se esperaba '{mensaje}' y llegó: {texto}"
    if errno:
        assert codigo == errno, f"se esperaba error {errno} y llegó {codigo}: {texto}"
    return texto


def uno(cur, sql, params=None):
    cur.execute(sql, params)
    fila = cur.fetchone()
    return fila[0] if fila else None


def ci_de(cur, nombre, apellido):
    return uno(cur, "SELECT ci FROM jugador WHERE nombre = %s AND apellido = %s", (nombre, apellido))


def nuevo_torneo(cur, equipos=3, jugadores=5, anio=2031):
    """Crea una edición en inscripción con equipos de la facultad 1.

    Devuelve (id_torneo, [id_equipo, ...]). Los CI de los jugadores
    empiezan con 6 para no chocar con los datos de prueba.
    """
    cur.execute(
        "INSERT INTO torneo (nombre, anio, semestre, fecha_inicio, fecha_fin) "
        "VALUES (%s, %s, 1, %s, %s)",
        (f"Test {anio}", anio, f"{anio}-03-01", f"{anio}-07-31"))
    id_torneo = cur.lastrowid
    ids = []
    for e in range(equipos):
        cur.execute("INSERT INTO equipo (nombre, id_torneo, id_facultad) VALUES (%s, %s, 1)",
                    (f"Equipo test {e + 1}", id_torneo))
        id_equipo = cur.lastrowid
        ids.append(id_equipo)
        for k in range(jugadores):
            agregar_jugador(cur, id_torneo, id_equipo, k + 1)
    return id_torneo, ids


def agregar_jugador(cur, id_torneo, id_equipo, camiseta, tipo="grado", id_facultad=1):
    ci = f"6{id_equipo % 1000:03d}{camiseta:02d}{id_torneo % 100:02d}"
    cur.execute(
        "INSERT INTO jugador (ci, nombre, apellido, email, fecha_nacimiento, id_facultad, tipo) "
        "VALUES (%s, 'Test', 'Jugador', %s, '2002-01-01', %s, %s)",
        (ci, f"t{ci}@correo.ucu.edu.uy", id_facultad, tipo))
    cur.execute(
        "INSERT INTO equipo_jugador_torneo (id_equipo, ci_jugador, id_torneo, id_facultad, numero_camiseta) "
        "VALUES (%s, %s, %s, %s, %s)", (id_equipo, ci, id_torneo, id_facultad, camiseta))
    return ci


def programar(cur, id_torneo, fecha, local, visitante, dia, turno=1, cancha=(1, "Cancha 1"), estado="programado"):
    cur.execute(
        "INSERT INTO partido (id_torneo, numero_fecha, id_equipo_local, id_equipo_visitante, dia, "
        "id_turno, id_complejo, nombre_cancha, estado) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (id_torneo, fecha, local, visitante, dia, turno, cancha[0], cancha[1], estado))
    return cur.lastrowid
