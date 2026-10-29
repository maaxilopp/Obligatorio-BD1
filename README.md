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


