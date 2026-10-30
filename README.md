# Obligatorio - Torneo Interfacultades de Fútbol 5

Sistema de gestión del Torneo Interfacultades de Fútbol 5 de la Universidad Católica del Uruguay.

Trabajo obligatorio de Base de Datos I - Segundo semestre de 2026.

## Integrantes

[![Maximiliano López](https://img.shields.io/badge/GitHub-Maximiliano_López-B7E3FF?logo=github&logoColor=black)](https://github.com/maaxilopp)
[![Trinidad Bunge](https://img.shields.io/badge/GitHub-Trinidad_Bunge-FFD966?logo=github&logoColor=black)](https://github.com/trinibunge)
[![Paulina Silveira](https://img.shields.io/badge/GitHub-Paulina_Silveira-FFC1DC?logo=github&logoColor=black)](https://github.com/paulinasilveira)

## Tecnologías

![MySQL](https://img.shields.io/badge/MySQL_8-B7E3FF?logo=mysql&logoColor=black)
![Python](https://img.shields.io/badge/Python-FFD966?logo=python&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-C1F0D0?logo=fastapi&logoColor=black)
![React](https://img.shields.io/badge/React-D9C8FF?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-FFC1DC?logo=vite&logoColor=black)
![Pytest](https://img.shields.io/badge/pytest-FFD1B3?logo=pytest&logoColor=black)
![Docker](https://img.shields.io/badge/Docker_Compose-FFD1B3?logo=docker&logoColor=black)

## Descripción del proyecto

El proyecto consiste en el diseño e implementación de un sistema de información para la gestión del Torneo Interfacultades de Fútbol 5.

El objetivo es centralizar la información del torneo y asegurar la integridad de los datos, automatizando las reglas de negocio relacionadas con la inscripción de equipos, la programación de partidos, el registro de resultados y las sanciones disciplinarias.

### Funcionalidades

- **Gestión de torneos:** administración de las ediciones semestrales y sus estados: inscripción, en curso y finalizado.
- **Gestión de jugadores y equipos:** registro de jugadores, facultades, capitanes y planteles, con validaciones sobre la cantidad y el tipo de integrantes.
- **Gestión de complejos y canchas:** administración de las instalaciones deportivas y sus características.
- **Organización del fixture:** generación y administración de partidos, con controles para evitar enfrentamientos duplicados, equipos asignados a más de un partido en una misma fecha y superposición de partidos en una cancha.
- **Registro de planillas:** inscripción de los jugadores participantes, goles y tarjetas de cada partido.
- **Gestión de sanciones:** aplicación automática de suspensiones por tarjetas rojas o acumulación de amarillas, además de sanciones disciplinarias.
- **Control de resultados:** cálculo del marcador a partir de los goles registrados, validación del momento en que se puede marcar un partido como jugado y restricciones para corregir resultados.
- **Control de acceso:** diferenciación de permisos entre administradores y planilleros, tanto en la aplicación como en la base de datos.

### Reportes

1. Tabla de posiciones, con partidos jugados, ganados, empatados y perdidos, goles a favor y en contra, diferencia de goles y puntos.
2. Tabla de goleadores los 10 primeros, incluyendo a los empatados.
3. Clasificación de fair play por equipo.
4. Promedio de goles por fecha y para toda la edición.
5. Utilización de canchas y turnos.
6. Cantidad de jugadores por facultad y tipo.
7. Jugadores inscriptos que nunca participaron en una planilla.
8. Cantidad de sanciones por equipo y motivo.
9. Porcentaje de partidos jugados, postergados y cancelados.
10. Consultas propuestas por el grupo: remontadas, distribución de los goles por minuto y rachas recientes de los equipos.

### Implementación

**Base de datos (MySQL).** Las reglas de negocio viven en la base, así se cumplen sin importar desde dónde se accede:

- Tablas con claves primarias, foráneas, algunas compuestas, y restricciones.
- Triggers para las reglas que no entran en una constraint y para las sanciones automáticas.
- Procedimientos almacenados para generar el fixture y para cerrar un partido.
- Vistas que centralizan los cálculos de los reportes.
- Usuarios de MySQL con permisos diferenciados por rol.
- Auditoría de las correcciones de resultados.

**Backend.** Valida los datos de entrada, autentica a los usuarios y se conecta a MySQL con el usuario que corresponde al rol de quien inició sesión. Los errores de la base (por ejemplo, el mensaje de un trigger) se devuelven al usuario en español.

**Validación en las tres capas:** el frontend valida los formularios, el backend valida cada campo con Pydantic y la base vuelve a controlar todo con constraints y triggers.

## Estructura del repositorio

| Carpeta     | Contenido                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `db/`       | Scripts SQL numerados (esquema, triggers, procedimientos, vistas, usuarios, datos de prueba, reportes) y `setup_db.py` |
| `backend/`  | API en FastAPI: conexión por rol, login, traducción de errores y un archivo por grupo de endpoints en `routers/`       |
| `frontend/` | Aplicación en React + Vite: login, menú por rol, catálogos, partidos, planillas y reportes                             |
| `tests/`    | Tests automáticos (pytest) contra MySQL real: `db/` reglas de la base (triggers, permisos) y `api/` endpoints del backend |
| `docs/`     | Diagrama, informe y bitácora                                                                                           |

## Cómo correrlo

Hay dos formas: con Docker o instalando todo en una computadora.

### Opción 1: con Docker

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

- MySQL: `localhost:3307`, usuario `root`, contraseña `root` (puerto 3307 para no chocar con un MySQL instalado). Sirve para conectarse desde DataGrip.

La base se crea **solo la primera vez**, con los scripts `01` a `06`. Como los datos de prueba usan fechas relativas al día de carga, para recrearla desde cero (por ejemplo, el día de la defensa):

```bash
docker compose down -v
docker compose up --build
```

### Opción 2: sin Docker

Requisitos: MySQL 8.0 o superior, Python 3.10 o superior y, opcionalmente, DataGrip.

#### 1. Crear la base de datos

Los scripts de `db/` se ejecutan **en orden**:

| Script                  | Qué hace                                                                          |
| ----------------------- | --------------------------------------------------------------------------------- |
| `01_schema.sql`         | Crea la base `torneo_futbol5` (la borra si existe), las tablas y los turnos       |
| `02_triggers.sql`       | Reglas de negocio que no entran en constraints, sanciones automáticas y auditoría |
| `03_procedimientos.sql` | `marcar_jugado` y `generar_fixture`                                               |
| `04_vistas.sql`         | Resultado de cada partido, tabla de posiciones, goleadores, fair play, sanciones  |
| `05_usuarios.sql`       | Usuarios con permisos diferenciados                                               |
| `06_datos.sql`          | Datos de prueba (6 equipos, 3 fechas jugadas, fecha 4 a futuro)                   |
| `07_reportes.sql`       | Las consultas de los reportes (no modifica nada)                                  |

**Con DataGrip**

1. Crear una conexión MySQL como `root`.
2. Clic derecho en la conexión → _SQL Scripts_ → _Run SQL Script..._ y ejecutar los scripts `01` a `06`, uno por uno y en orden.
3. Marcar el schema `torneo_futbol5` para que aparezca en el explorador.
4. Abrir `07_reportes.sql`, ejecutar `SET @torneo = 1;` y después cualquier consulta con Ctrl+Enter.

**Con un comando**

```bash
pip install -r requirements-dev.txt
python db/setup_db.py --password <contraseña de root>
```

> Los datos de prueba usan fechas relativas al día en que se cargan: la fecha 3 se jugó "ayer" (todavía se puede corregir, ventana de 48 h) y la fecha 4 queda a futuro. Si pasan más de dos días, conviene volver a cargarlos.

#### 2. Levantar el backend

Desde la raíz del repositorio:

```bash
python -m venv .venv
# Windows (PowerShell): .venv\Scripts\Activate.ps1   |   Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # en Windows: copy .env.example .env
uvicorn backend.main:app --reload
```

#### 3. Levantar el frontend

Requiere [Node.js](https://nodejs.org/) 20 o superior. Con el backend corriendo, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en http://localhost:5173 (la API corre en http://localhost:8000). Se entra con los usuarios de la tabla de abajo.

## Usuarios

| Aplicación              | Contraseña      | Rol           |
| ----------------------- | --------------- | ------------- |
| `admin@ucu.edu.uy`      | `admin123`      | administrador |
| `planillero@ucu.edu.uy` | `planillero123` | planillero    |

| Usuario MySQL       | Contraseña              | Uso                                               |
| ------------------- | ----------------------- | ------------------------------------------------- |
| `torneo_admin`      | `Admin.Torneo2026`      | conexión del backend para administradores         |
| `torneo_planillero` | `Planillero.Torneo2026` | conexión del backend para planilleros             |
| `torneo_auth`       | `Auth.Torneo2026`       | solo lee `login` para validar el inicio de sesión |

## Tests

Prueban cada regla de la letra intentando violarla, además de los permisos, los reportes y la API. **Recrean la base `torneo_futbol5` desde cero**, así que se pierden los cambios hechos a mano.

```bash
pip install -r requirements.txt -r requirements-dev.txt
# Windows (PowerShell): $env:DB_PASSWORD="..."   |   Linux/Mac: export DB_PASSWORD=...
pytest -v
```

Con la base de Docker, agregar también `DB_PORT=3307` y usar `DB_PASSWORD=root`.

**Última ejecución:** 144 tests aprobados.

## Organización

[![Tablero en Trello](https://img.shields.io/badge/Trello-Tablero_del_proyecto-C1F0D0?logo=trello&logoColor=black)](https://trello.com/b/xCyPoRcR)
