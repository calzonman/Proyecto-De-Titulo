# 🚀 Backend - Sistema de Control de Inventario en Cadena de Frío

Backend FastAPI que gestiona la lógica de negocio, comunicación MQTT y persistencia de datos para el sistema de monitoreo de cadena de frío en tiempo real.

## Inicio Rápido

- Clonar el repositorio
git clone https://github.com/tuusuario/cold-chain-inventory-system.git
cd cold-chain-inventory-system/backend

- Crear y activar entorno virtual

`python -m venv venv`

`venv\Scripts\activate  # Windows`

`source venv/bin/activate  # Linux/macOS`

- Instalar dependencias

`pip install -r requirements.txt`

- Configurar variables de entorno

`copy .env.example .env  # Windows`
`cp .env.example .env  # Linux/macOS`

- Editar .env con tus configuraciones

- Ejecutar el servidor
`uvicorn main:app --reload --host 0.0.0.0 --port 8000`
¡Servidor ejecutándose! → http://localhost:8000

# 📡 Endpoints de la API

### 🔧 Gestión de Productos
| Método | Endpoint | Descripción | Body Example |
|--------|----------|-------------|--------------|
| `POST` | `/productos/` | Crear nuevo producto | `{"nombre": "Vacuna COVID-19", "rango_de_t": "2-8°C", "uid_etiqueta": "000000202412260000001067"}` |
| `GET` | `/productos/` | Listar todos los productos | - |
| `PUT` | `/productos/{id}` | Actualizar producto | `{"nombre": "Nuevo nombre"}` |
| `DELETE` | `/productos/{id}` | Eliminar producto | - |

### 📊 Gestión de Lecturas
| Método | Endpoint | Descripción | Body Example |
|--------|----------|-------------|--------------|
| `POST` | `/lecturas/` | Crear lectura manual | `{"uid_etiqueta": "000000202412260000001067", "temperatura": 4.5, "estado": "OK"}` |
| `GET` | `/lecturas/` | Listar todas las lecturas | - |
| `GET` | `/lecturas/{epc}` | Obtener lecturas por EPC | - |
| `DELETE` | `/lecturas/{id}` | Eliminar lectura | - |

### 🖥️ Sistema y Utilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/` | Estado básico del sistema |
| `GET` | `/status` | Estado detallado con métricas |
| `POST` | `/test/mqtt` | Probar comunicación MQTT |