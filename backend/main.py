from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.auth import router as auth_router
from backend.routers import jugadores, planillas, reportes

app = FastAPI(
    title="Torneo Interfacultades de Fútbol 5",
    description="API para la gestión del torneo de la UCU",
    version="1.0.0",
)

# El front esta habilitado a llamar a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(jugadores.router)
app.include_router(planillas.router)
app.include_router(reportes.router)

MENSAJES = {
    "missing": "es obligatorio",
    "string_too_short": "no puede estar vacío",
    "string_too_long": "es demasiado largo",
    "string_pattern_mismatch": "no tiene un formato válido",
    "literal_error": "no es un valor permitido",
    "date_from_datetime_parsing": "no es una fecha válida (formato AAAA-MM-DD)",
    "date_parsing": "no es una fecha válida (formato AAAA-MM-DD)",
    "int_parsing": "tiene que ser un número entero",
    "greater_than": "tiene que ser mayor a {gt}",
    "greater_than_equal": "tiene que ser mayor o igual a {ge}",
    "less_than_equal": "tiene que ser menor o igual a {le}",
    "bool_parsing": "tiene que ser verdadero o falso",
}


@app.exception_handler(RequestValidationError)
async def errores_de_validacion(request: Request, exc: RequestValidationError):
    errores = []
    for error in exc.errors():
        campo = ".".join(str(parte) for parte in error["loc"] if parte != "body")
        if error["type"] == "value_error":
            mensaje = str(error["msg"]).removeprefix("Value error, ")
        else:
            mensaje = MENSAJES.get(error["type"], error["msg"]).format(**error.get("ctx", {}))
        errores.append({"campo": campo, "mensaje": mensaje})
    return JSONResponse(status_code=422, content={"detail": "Hay datos inválidos", "errores": errores})


@app.get("/", tags=["General"])
def inicio():
    return {"mensaje": "API del Torneo Interfacultades de Fútbol 5", "estado": "funcionando",
            "documentacion": "/docs"}


@app.get("/health", tags=["General"])
def health():
    return {"estado": "ok"}