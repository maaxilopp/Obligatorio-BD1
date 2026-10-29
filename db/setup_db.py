"""Crea la base torneo_futbol5 desde cero corriendo los scripts SQL en orden.

para levantar la base local: solo necesita MySQL 8
instalado y PyMySQL (pip install -r requirements-dev.txt).

    python db/setup_db.py --password <contraseña de root>
    python db/setup_db.py --password <...> --sin-datos   # sin datos de prueba

También toma la configuración de variables de entorno:
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.

ATENCIÓN: borra la base torneo_futbol5 si ya existe.
"""

import argparse
import os
import sys
from pathlib import Path

import pymysql

DB_DIR = Path(__file__).resolve().parent

SCRIPTS = [
    "01_schema.sql",
    "02_triggers.sql",
    "03_procedimientos.sql",
    "04_vistas.sql",
    "05_usuarios.sql",
    "06_datos.sql",
]


def dividir_sentencias(sql: str) -> list[str]:
    """Divide un script en sentencias respetando DELIMITER, strings y comentarios.

    PyMySQL ejecuta una sentencia por vez y no entiende la directiva DELIMITER
    (que es del cliente mysql / DataGrip), así que la interpretamos acá.
    """
    sentencias, actual = [], []
    delim = ";"
    i, n = 0, len(sql)
    inicio_linea = True

    while i < n:
        # directiva DELIMITER al inicio de una línea
        if inicio_linea:
            j = i
            while j < n and sql[j] in " \t":
                j += 1
            if sql[j:j + 9].upper() == "DELIMITER":
                fin = sql.find("\n", j)
                fin = n if fin == -1 else fin
                delim = sql[j + 9:fin].strip()
                i = fin + 1
                continue
        inicio_linea = False

        c = sql[i]
        # comentarios de línea: -- y #
        if (sql.startswith("--", i) and sql[i + 2:i + 3] in (" ", "\t", "\n", "\r", "")) or c == "#":
            fin = sql.find("\n", i)
            i = n if fin == -1 else fin
            continue
        # comentario de bloque
        if sql.startswith("/*", i):
            fin = sql.find("*/", i + 2)
            i = n if fin == -1 else fin + 2
            continue
        # strings y nombres entre comillas
        if c in "'\"`":
            j = i + 1
            while j < n:
                if sql[j] == "\\" and c != "`":
                    j += 2
                    continue
                if sql[j] == c:
                    if j + 1 < n and sql[j + 1] == c:  # comilla duplicada ''
                        j += 2
                        continue
                    break
                j += 1
            actual.append(sql[i:j + 1])
            i = j + 1
            continue
        # fin de sentencia
        if sql.startswith(delim, i):
            texto = "".join(actual).strip()
            if texto:
                sentencias.append(texto)
            actual = []
            i += len(delim)
            continue

        actual.append(c)
        if c == "\n":
            inicio_linea = True
        i += 1

    texto = "".join(actual).strip()
    if texto:
        sentencias.append(texto)
    return sentencias


def conectar(host, port, user, password, database=None):
    con = pymysql.connect(host=host, port=port, user=user, password=password,
                          database=database, charset="utf8mb4", autocommit=True)
    with con.cursor() as cur:
        cur.execute("SET time_zone = '-03:00'")
    return con


def ejecutar_script(con, ruta: Path):
    with con.cursor() as cur:
        for sentencia in dividir_sentencias(ruta.read_text(encoding="utf-8")):
            cur.execute(sentencia)


def crear_base(host="localhost", port=3306, user="root", password="", con_datos=True, verbose=True):
    con = conectar(host, port, user, password)
    try:
        for nombre in SCRIPTS:
            if nombre == "06_datos.sql" and not con_datos:
                continue
            if verbose:
                print(f"  -> {nombre}")
            ejecutar_script(con, DB_DIR / nombre)
    finally:
        con.close()


def main():
    p = argparse.ArgumentParser(description="Crea la base torneo_futbol5 desde cero.")
    p.add_argument("--host", default=os.getenv("DB_HOST", "localhost"))
    p.add_argument("--port", type=int, default=int(os.getenv("DB_PORT", "3306")))
    p.add_argument("--user", default=os.getenv("DB_USER", "root"))
    p.add_argument("--password", default=os.getenv("DB_PASSWORD", ""))
    p.add_argument("--sin-datos", action="store_true", help="no carga 06_datos.sql")
    args = p.parse_args()

    print(f"Creando torneo_futbol5 en {args.host}:{args.port} como {args.user}...")
    try:
        crear_base(args.host, args.port, args.user, args.password, not args.sin_datos)
    except pymysql.MySQLError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    print("Listo.")


if __name__ == "__main__":
    main()
