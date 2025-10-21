from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# Modelo para la colección Productos
class Producto(BaseModel):
    id: Optional[str] = Field(alias="_id")
    nombre: str
    rango_de_t: str
    UID_etiqueta: str

# Modelo para la colección Lecturas
class Lectura(BaseModel):
    id: Optional[str] = Field(alias="_id")
    UID_etiqueta: str
    temperatura: float
    timestamp: datetime
    estado: str
