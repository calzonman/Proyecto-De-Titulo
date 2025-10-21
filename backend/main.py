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
        print(f"🔄 Procesando lectura para EPC: {data.get('epc')}")
        
        # Usar timestamp actual para simplificar
        timestamp = datetime.utcnow()
        
        # Crear objeto Lectura
        lectura_data = {
            "uid_etiqueta": data.get("epc"),
            "timestamp": timestamp,
            "temperatura": None,
            "estado": "OK",
            "fuente": "mqtt_auto"
        }
        
        print(f"📝 Insertando en BD: {lectura_data}")
        
        # Insertar en MongoDB
        result = await db.lecturas.insert_one(lectura_data)
        
        print(f"✅ Lectura guardada en BD. ID: {result.inserted_id}")
        
        # Verificación rápida
        count = await db.lecturas.count_documents({"uid_etiqueta": data.get("epc")})
        print(f"📊 Total de lecturas para este EPC: {count}")
        
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

# -------------------------------
# CRUD Lecturas
# -------------------------------

@app.post("/lecturas/", response_model=Lectura)
async def crear_lectura(lectura: Lectura):
    lectura_dict = lectura.dict(by_alias=True, exclude={"id"})
    if "timestamp" not in lectura_dict:
        lectura_dict["timestamp"] = datetime.utcnow()
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
