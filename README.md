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

## Estructura del repositorio
| Carpeta | Contenido |
|---|---|
| `db/` |	Scripts SQL numerados (esquema, triggers, procedimientos, vistas, usuarios, datos de prueba, reportes) y setup_db.py |
| `backend/` | API en FastAPI |
| `frontend/` | Aplicación en React |
| `tests/` | 	Tests automáticos (pytest) de todas las reglas de negocio, permisos y reportes, contra MySQL real|
| `docs/` | Bitácora, Diagrama e Informe  |

## Cómo correrlo localmente

### Requisitos
- MySQL 8.0 o superior
- Python 3.10 o superior
- (opcional) DataGrip u otro cliente SQL

### 1. Crear la base de datos

Los scripts de `db/` se ejecutan **en orden**:

| Script | Qué hace |
|---|---|
| `01_schema.sql` | Crea la base `torneo_futbol5` (la borra si existe), las tablas y los turnos |
| `02_triggers.sql` | Reglas de negocio que no entran en constraints, sanciones automáticas y auditoría |
| `03_procedimientos.sql` | `marcar_jugado` y `generar_fixture` |
| `04_vistas.sql` | Resultado de cada partido, tabla de posiciones, goleadores, fair play, sanciones |
| `05_usuarios.sql` | Usuarios de MySQL con permisos diferenciados |
| `06_datos.sql` | Datos de prueba (6 equipos, 3 fechas jugadas, fecha 4 a futuro) |
| `07_reportes.sql` | Las consultas de los reportes (no modifica nada) |

**Opción A: con DataGrip**
1. Crear una conexión MySQL como `root` (o un usuario con permisos para crear bases y usuarios).
2. Abrir cada script de `01` a `06`, en orden, y ejecutarlo completo (botón *Execute* con todo el archivo, o clic derecho en el archivo → *Run*). DataGrip entiende la directiva `DELIMITER`.
3. Abrir `07_reportes.sql`, ejecutar el `SET @torneo = 1;` y después cualquier consulta con Ctrl+Enter.

**Opción B: con un comando**
```bash
pip install -r requirements-dev.txt
python db/setup_db.py --password <contraseña de root>
```
Los datos de prueba usan fechas relativas al día en que se cargan: la fecha 3 se jugó "ayer" (todavía se puede corregir, ventana de 48 h) y la fecha 4 queda a futuro. Si pasan más de dos días, se pueden volver a cargar.

> Las reglas de horario usan `NOW()`: toda conexión tiene que ejecutar `SET time_zone = '-03:00';`.
## Descripción del proyecto

El proyecto consiste en el diseño e implementación de un sistema de información para la gestión del Torneo Interfacultades de Fútbol 5.

El objetivo es centralizar la información del torneo y asegurar la integridad de los datos, automatizando las reglas de negocio relacionadas con la inscripción de equipos, la programación de partidos, el registro de resultados y las sanciones disciplinarias.

### Funcionalidades

El sistema contempla las siguientes funcionalidades:

- **Gestión de torneos:** administración de las ediciones semestrales y sus estados: inscripción, en curso y finalizado.
- **Gestión de jugadores y equipos:** registro de jugadores, facultades, capitanes y planteles, con validaciones sobre la cantidad y el tipo de integrantes.
- **Gestión de complejos y canchas:** administración de las instalaciones deportivas y sus características.
- **Organización del fixture:** generación y administración de partidos, con controles para evitar enfrentamientos duplicados, equipos asignados a más de un partido en una misma fecha y superposición de partidos en una cancha.
- **Registro de planillas:** inscripción de los jugadores participantes, goles y tarjetas de cada partido.
- **Gestión de sanciones:** aplicación automática de suspensiones por tarjetas rojas o acumulación de amarillas, además de sanciones disciplinarias.
- **Control de resultados:** cálculo del marcador a partir de los goles registrados, validación del momento en que se puede marcar un partido como jugado y restricciones para corregir resultados.
- **Control de acceso:** diferenciación de permisos entre administradores y planilleros.

### Reportes

La base de datos permite consultar información para el seguimiento del torneo y la toma de decisiones:

1. Tabla de posiciones, con partidos jugados, ganados, empatados y perdidos, goles a favor y en contra, diferencia de goles y puntos.
2. Tabla de goleadores.
3. Clasificación de fair play por equipo.
4. Promedio de goles por fecha y para toda la edición.
5. Utilización de canchas y turnos.
6. Cantidad de jugadores por facultad y tipo.
7. Jugadores inscriptos que nunca participaron en una planilla.
8. Cantidad de sanciones por equipo y motivo.
9. Porcentaje de partidos jugados, postergados y cancelados.
10. Consultas adicionales sobre remontadas, distribución temporal de los goles y rachas recientes de los equipos.

### Implementación de la base de datos

La solución utiliza MySQL 8 y SQL para modelar la información y aplicar las reglas de negocio directamente en la base de datos.

La implementación incluye:

- Tablas relacionales con claves primarias, claves foráneas y restricciones de integridad.
- Triggers para validar operaciones y automatizar reglas de negocio.
- Procedimientos almacenados para operaciones como la generación del fixture y el registro de partidos jugados.
- Vistas para centralizar cálculos y simplificar la generación de reportes.
- Usuarios de base de datos con permisos diferenciados según su función.
- Auditoría de las correcciones de resultados.
- Datos de prueba para verificar el funcionamiento de las consultas y las restricciones.

### Pruebas automatizadas

Se incorporaron tests automatizados con `pytest` para verificar las reglas de negocio, los permisos y los reportes de la base de datos. Las pruebas utilizan una instancia real de MySQL y comprueban tanto las operaciones válidas como los casos que deben rechazarse.

**Última ejecución:** 40 tests aprobados (`40 passed`).

Para repetir las pruebas, consultar las instrucciones de la sección [Cómo correrlo localmente](#3-tests).

### 2. Usuarios

| Aplicación | Contraseña | Rol |
|---|---|---|
| `admin@ucu.edu.uy` | `admin123` | administrador |
| `planillero@ucu.edu.uy` | `planillero123` | planillero |

| Usuario MySQL | Contraseña | Uso |
|---|---|---|
| `torneo_admin` | `Admin.Torneo2026` | conexión del backend para administradores |
| `torneo_planillero` | `Planillero.Torneo2026` | conexión del backend para planilleros |
| `torneo_auth` | `Auth.Torneo2026` | solo lee `login` para validar el inicio de sesión |

### 3. Tests

Recrean la base `torneo_futbol5` desde cero (¡se pierden los cambios hechos a mano!) y prueban cada regla de la letra intentando violarla.

```bash
pip install -r requirements-dev.txt
# Windows (PowerShell): $env:DB_PASSWORD="..."   |   Linux/Mac: export DB_PASSWORD=...
pytest tests -v
```

### 4. Backend y frontend
_En construcción._

[![Tablero en Trello](https://img.shields.io/badge/Trello-Tablero_del_proyecto-C1F0D0?logo=trello&logoColor=black)](https://trello.com/b/xCyPoRcR)


