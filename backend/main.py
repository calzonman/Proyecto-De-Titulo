from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from models import Producto, Lectura
from dotenv import load_dotenv
import os
from bson import ObjectId
from datetime import datetime
import paho.mqtt.client as mqtt
import json
import threading
import asyncio
import queue

load_dotenv()

app = FastAPI(title="API Cadena de Frío - MVP")

# Conexión MongoDB Atlas
MONGO_URL = os.getenv("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB")
client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]

# Configuración MQTT
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "rfid/tags")

# Variables globales para controlar MQTT
mqtt_client = None
mqtt_thread = None
mqtt_message_queue = queue.Queue()
processing_task = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # o ["*"] si es solo dev
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, DELETE, etc.
    allow_headers=["*"],          # Authorization, Content-Type, etc.
)

# -------------------------------
# Cliente MQTT
# -------------------------------
def setup_mqtt():
    global mqtt_client, mqtt_thread
    
    # Evitar múltiples inicializaciones
    if mqtt_client is not None and mqtt_client.is_connected():
        print("✅ MQTT ya está conectado")
        return

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ MQTT Conectado al broker {MQTT_BROKER}:{MQTT_PORT}")
            client.subscribe(MQTT_TOPIC)
            print(f"✅ Suscrito al topic: {MQTT_TOPIC}")
            
            # Publicar mensaje de prueba de conexión
            test_msg = {"epc": "mqtt_test", "timestamp": "0", "test": True}
            client.publish(MQTT_TOPIC, json.dumps(test_msg))
            print("📤 Mensaje de prueba MQTT enviado")
        else:
            print(f"❌ Error conectando MQTT, código: {rc}")

    def on_message(client, userdata, msg):
        try:
            print(f"📨 Mensaje MQTT recibido: {msg.topic} -> {msg.payload.decode()}")
            
            payload = msg.payload.decode()
            data = json.loads(payload)
            
            print(f"🔍 Datos parseados: EPC={data.get('epc')}, Timestamp={data.get('timestamp')}")
            
            # Ignorar mensajes de prueba del propio backend
            if data.get('test'):
                print("🔧 Mensaje de prueba ignorado")
                return
                
            # Poner el mensaje en la cola para procesamiento asíncrono
            mqtt_message_queue.put(data)
            
        except json.JSONDecodeError as e:
            print(f"❌ Error decodificando JSON: {e} - Payload: {msg.payload.decode()}")
        except Exception as e:
            print(f"❌ Error en on_message: {e}")

    # Crear y configurar cliente MQTT
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    def conectar_mqtt():
        try:
            print(f"🔌 Conectando a MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
            mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            print("🔄 Iniciando loop MQTT...")
            mqtt_client.loop_forever()
        except Exception as e:
            print(f"❌ Error en loop MQTT: {e}")

    # Iniciar MQTT en un hilo separado
    mqtt_thread = threading.Thread(target=conectar_mqtt, daemon=True)
    mqtt_thread.start()
    print("🚀 MQTT client iniciado en thread separado")

async def process_mqtt_messages():
    """Procesa mensajes MQTT desde la cola de forma asíncrona"""
    while True:
        try:
            # Esperar mensaje con timeout
            data = await asyncio.get_event_loop().run_in_executor(
                None, 
                mqtt_message_queue.get, 
                True,  # block
                1.0    # timeout
            )
            if data:
                await procesar_lectura_mqtt(data)
        except queue.Empty:
            # Timeout, continuar el loop
            continue
        except Exception as e:
            print(f"❌ Error en process_mqtt_messages: {e}")

async def procesar_lectura_mqtt(data):
    try:
        epc = data.get('epc')
        temp_recibida = data.get('temperatura') # Leemos el dato que envía el Arduino
        
        print(f"🔄 Procesando lectura para EPC: {epc}, Temp: {temp_recibida}")
        
        # Usar timestamp actual
        timestamp = datetime.now(timezone.utc) - timedelta(hours=3)
        
        # 1. Buscar el producto para saber sus rangos de temperatura
        producto = await db.productos.find_one({"uid_etiqueta": epc})
        
        estado = "SIN_DATO"
        temperatura_final = None

        # 2. Procesar temperatura y calcular estado
        if temp_recibida is not None:
            try:
                temperatura_final = float(temp_recibida)
                
                if producto:
                    # Obtener rangos del producto
                    rango = (producto.get("rango_temp") or {})
                    tmin = rango.get("min")
                    tmax = rango.get("max")
                    
                    # Validar rangos
                    if isinstance(tmin, (int, float)) and isinstance(tmax, (int, float)):
                        # Corregir si min/max están invertidos
                        if tmin > tmax:
                            tmin, tmax = tmax, tmin
                        
                        # Determinar estado
                        estado = "OK" if (tmin <= temperatura_final <= tmax) else "ALERTA"
                    else:
                        estado = "SIN_RANGO" # Tiene temp, pero el producto no tiene rangos configurados
                else:
                    estado = "NO_REGISTRADO" # Detectó etiqueta, pero no existe producto asociado
                    
            except ValueError:
                temperatura_final = None
                estado = "ERROR_DATO"

        # 3. Crear objeto Lectura con los datos reales
        lectura_data = {
            "uid_etiqueta": epc,
            "timestamp": timestamp,
            "temperatura": temperatura_final, # <--- Ahora sí guardamos el valor
            "estado": estado,                 # <--- Guardamos el estado calculado (OK/ALERTA)
            "fuente": "mqtt_auto"
        }
        
        print(f"📝 Insertando en BD: {lectura_data}")
        
        # Insertar en MongoDB
        result = await db.lecturas.insert_one(lectura_data)
        
        print(f"✅ Lectura guardada en BD. ID: {result.inserted_id} | Estado: {estado}")
        
    except Exception as e:
        print(f"❌ Error guardando lectura en BD: {e}")
        import traceback
        traceback.print_exc()

async def verificar_mongodb():
    try:
        # Verificar conexión
        await client.admin.command('ping')
        print("✅ MongoDB Atlas: Conexión exitosa")
        
        # Verificar que la base de datos y colección existen
        db_names = await client.list_database_names()
        if MONGO_DB in db_names:
            print(f"✅ Base de datos '{MONGO_DB}' encontrada")
            collections = await db.list_collection_names()
            print(f"📊 Colecciones disponibles: {collections}")
            
            # Verificar que podemos escribir en lecturas
            test_doc = {
                "uid_etiqueta": "test_startup",
                "timestamp": datetime.utcnow(),
                "test": True
            }
            result = await db.lecturas.insert_one(test_doc)
            await db.lecturas.delete_one({"_id": result.inserted_id})
            print("✅ Escritura/lectura en colección 'lecturas' verificada")
        else:
            print(f"❌ Base de datos '{MONGO_DB}' no encontrada")
            
    except Exception as e:
        print(f"❌ Error conectando a MongoDB: {e}")

# -------------------------------
# Eventos de Startup/Shutdown
# -------------------------------

@app.on_event("startup")
async def startup_event():
    # Verificar que no estamos en un worker de reload
    if os.environ.get("STARTUP_COMPLETE") is None:
        os.environ["STARTUP_COMPLETE"] = "1"
        
        print("🚀 Iniciando API Cadena de Frío")
        print(f"📊 MongoDB: {MONGO_DB}")
        print(f"📡 MQTT: {MQTT_BROKER}:{MQTT_PORT}")
        
        # Verificar MongoDB
        await verificar_mongodb()
        
        # Iniciar MQTT
        setup_mqtt()
        
        # Iniciar el procesador de mensajes MQTT
        global processing_task
        processing_task = asyncio.create_task(process_mqtt_messages())
        print("🔄 Procesador de mensajes MQTT iniciado")

@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 Deteniendo API Cadena de Frío")
    if mqtt_client:
        mqtt_client.disconnect()
    if processing_task:
        processing_task.cancel()

# -------------------------------
# Endpoints de Estado
# -------------------------------

@app.get("/")
async def root():
    return {"message": "API Cadena de Frío - Sistema funcionando"}

@app.get("/status")
async def status():
    mqtt_status = "connected" if mqtt_client and mqtt_client.is_connected() else "disconnected"
    return {
        "status": "online",
        "mqtt_broker": f"{MQTT_BROKER}:{MQTT_PORT}",
        "mqtt_status": mqtt_status,
        "mongodb": "connected" if client else "disconnected"
    }

# -------------------------------
# CRUD Productos
# -------------------------------

@app.post("/productos/", response_model=Producto)
async def crear_producto(producto: Producto):
    producto_dict = producto.dict(by_alias=True, exclude={"id"})
    result = await db.productos.insert_one(producto_dict)
    producto_dict["_id"] = str(result.inserted_id)
    return producto_dict

@app.get("/productos/")
async def listar_productos():
    productos = await db.productos.find().to_list(100)
    for p in productos:
        p["_id"] = str(p["_id"])
    return productos

@app.put("/productos/{producto_id}")
async def actualizar_producto(producto_id: str, producto: Producto):
    result = await db.productos.update_one({"_id": ObjectId(producto_id)}, {"$set": producto.dict(exclude_unset=True)})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"mensaje": "Producto actualizado correctamente"}

@app.delete("/productos/{producto_id}")
async def eliminar_producto(producto_id: str):
    result = await db.productos.delete_one({"_id": ObjectId(producto_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"mensaje": "Producto eliminado correctamente"}

@app.get("/productos/by-uid/{epc}")
async def get_producto_by_uid(epc: str):
    prod = await db.productos.find_one({"uid_etiqueta": epc})
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    prod["_id"] = str(prod["_id"])
    return prod

@app.get("/productos/with-last-reading")
async def productos_con_ultima_lectura():
    pipeline = [
        # une cada producto con su última lectura (si existe)
        {"$lookup": {
            "from": "lecturas",
            "let": { "tag": "$uid_etiqueta" },
            "pipeline": [
                { "$match": { "$expr": { "$eq": ["$uid_etiqueta", "$$tag"] } } },
                { "$sort": { "timestamp": -1 } },
                { "$limit": 1 }
            ],
            "as": "last"
        }},
        {"$addFields": {
            "lastReadingTimestamp": {
                "$ifNull": [{ "$arrayElemAt": ["$last.timestamp", 0] }, None]
            },
            "lastEstado": {
                "$ifNull": [{ "$arrayElemAt": ["$last.estado", 0] }, None]
            }
        }},
        {"$project": { "last": 0 }},
        # ordenar: primero los que sí tienen última lectura, más reciente arriba
        {"$sort": { "lastReadingTimestamp": -1, "_id": 1 }}
    ]
    docs = await db.productos.aggregate(pipeline).to_list(1000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs

# -------------------------------
# CRUD Lecturas
# -------------------------------

@app.post("/lecturas/", response_model=Lectura)
async def crear_lectura(lectura: Lectura):
    # Convertimos el modelo a dict y **ignoramos** cualquier 'id' y 'estado' que mande el cliente
    lectura_dict = lectura.model_dump(by_alias=True, exclude={"id", "estado"})  # Pydantic v2
    # Si usas Pydantic v1: lectura_dict = lectura.dict(by_alias=True, exclude={"id", "estado"})

    # Timestamp por defecto
    if "timestamp" not in lectura_dict or lectura_dict["timestamp"] is None:
        lectura_dict["timestamp"] = datetime.utcnow()

    epc = lectura_dict.get("uid_etiqueta")
    # Intentamos normalizar temperatura a float si viene como string
    temperatura: Optional[float] = lectura_dict.get("temperatura")
    try:
        if temperatura is not None:
            temperatura = float(temperatura)
    except (TypeError, ValueError):
        temperatura = None

    # Estado por defecto
    estado = "SIN_DATO" if temperatura is None else "SIN_RANGO"

    # Buscamos el producto y su rango
    producto = None
    if epc:
        producto = await db.productos.find_one({"uid_etiqueta": epc})

    if temperatura is not None and producto:
        rango = (producto.get("rango_temp") or {})
        tmin = rango.get("min")
        tmax = rango.get("max")

        # Validamos que min/max existan y sean numéricos
        if isinstance(tmin, (int, float)) and isinstance(tmax, (int, float)):
            # Por si acaso min/max vienen invertidos
            if tmin > tmax:
                tmin, tmax = tmax, tmin
            estado = "OK" if (tmin <= temperatura <= tmax) else "ALERTA"
        else:
            estado = "SIN_RANGO"

    # Asignamos el estado calculado
    lectura_dict["temperatura"] = temperatura
    lectura_dict["estado"] = estado

    result = await db.lecturas.insert_one(lectura_dict)
    lectura_dict["_id"] = str(result.inserted_id)
    return lectura_dict

@app.get("/lecturas/")
async def listar_lecturas():
    lecturas = await db.lecturas.find().sort("timestamp", -1).to_list(100)
    for l in lecturas:
        l["_id"] = str(l["_id"])
        if "uid_etiqueta" in l and isinstance(l["uid_etiqueta"], ObjectId):
            l["uid_etiqueta"] = str(l["uid_etiqueta"])
    return lecturas

@app.get("/lecturas/{epc}")
async def listar_lecturas_por_epc(epc: str):
    lecturas = await db.lecturas.find({"uid_etiqueta": epc}).sort("timestamp", -1).to_list(50)
    for l in lecturas:
        l["_id"] = str(l["_id"])
    return lecturas

@app.delete("/lecturas/{lectura_id}")
async def eliminar_lectura(lectura_id: str):
    result = await db.lecturas.delete_one({"_id": ObjectId(lectura_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lectura no encontrada")
    return {"mensaje": "Lectura eliminada correctamente"}

@app.get("/etiquetas/sin-asociar")
async def etiquetas_sin_asociar():
    pipeline = [
        {"$match": {"uid_etiqueta": {"$ne": None}}},  # filtra nulos si existieran
        {"$group": {
            "_id": "$uid_etiqueta",
            "lastTimestamp": {"$max": "$timestamp"},
            "count": {"$sum": 1}
        }},
        {"$lookup": {
            "from": "productos",
            "localField": "_id",
            "foreignField": "uid_etiqueta",
            "as": "prod"
        }},
        {"$match": {"prod.0": {"$exists": False}}},
        {"$project": {"_id": 0, "uid_etiqueta": "$_id", "lastTimestamp": 1, "count": 1}},
        {"$sort": {"lastTimestamp": -1}}
    ]
    docs = await db.lecturas.aggregate(pipeline).to_list(200)
    # normaliza formato
    for d in docs:
        if isinstance(d.get("lastTimestamp"), datetime):
            d["lastTimestamp"] = d["lastTimestamp"].isoformat()
    return docs

# -------------------------------
# Endpoint para probar MQTT manualmente
# -------------------------------

@app.post("/test/mqtt")
async def test_mqtt(epc: str = "test_manual_001"):
    """Endpoint para probar MQTT manualmente"""
    if not mqtt_client or not mqtt_client.is_connected():
        raise HTTPException(status_code=500, detail="MQTT no conectado")
    
    test_message = {
        "epc": epc,
        "timestamp": str(int(datetime.utcnow().timestamp() * 1000)),
        "test": True
    }
    
    mqtt_client.publish(MQTT_TOPIC, json.dumps(test_message))
    return {"message": f"Mensaje de prueba enviado: {epc}"}

# ------------------------
# Endpoint para asociar un producto a una etiqueta
# ------------------------

@app.put("/productos/{producto_id}/asociar-etiqueta")
async def asociar_etiqueta_a_producto(producto_id: str, uid_etiqueta: str):
    try:
        # Verificar que el producto existe
        producto = await db.productos.find_one({"_id": ObjectId(producto_id)})
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Verificar que la etiqueta no esté ya en uso
        producto_existente = await db.productos.find_one({"uid_etiqueta": uid_etiqueta})
        if producto_existente:
            raise HTTPException(
                status_code=400, 
                detail=f"Esta etiqueta ya está asociada al producto: {producto_existente['nombre']}"
            )
        
        # Actualizar el producto con la nueva etiqueta
        result = await db.productos.update_one(
            {"_id": ObjectId(producto_id)},
            {"$set": {"uid_etiqueta": uid_etiqueta}}
        )
        
        if result.modified_count == 1:
            return {"mensaje": "Etiqueta asociada correctamente al producto"}
        else:
            raise HTTPException(status_code=500, detail="Error al actualizar el producto")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# Endpoint simple para probar la asociación
@app.post("/test/asociar-manual")
async def test_asociacion_manual(producto_id: str, epc: str):
    """Endpoint temporal para probar asociación sin frontend"""
    return await asociar_etiqueta_a_producto(producto_id, epc)