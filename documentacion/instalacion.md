## Paso 1: Clonar el Repositorio

Abre tu terminal o línea de comandos y ejecuta:

`git clone https://github.com/calzonman/Proyecto-De-Titulo`

Navega al directorio del proyecto:

`cd Proyecto-De-Titulo`

Explora la estructura del proyecto
`dir  # En Windows`
`ls -la  # En Linux/macOS`

Deberías ver esta estructura:

Proyecto-De-Titulo/
├── 📁 backend/          # Código del servidor
├── 📁 firmware/         # Código para el M5Stick
├── 📁 docs/            # Documentación
└── 📄 README.md        # Este archivo

## Paso 2: Configurar y Ejecutar el Backend

Navegar al directorio del backend:
`cd backend`

Crear un entorno virtual (recomendado):
`python -m venv venv`

Activar el entorno virtual
En Windows:
`venv\Scripts\activate`

En Linux/macOS:
`source venv/bin/activate`

Instalar las dependencias necesarias
`pip install -r requirements.txt`

Configurar las variables de entorno:

Abrir el archivo .env con tu editor de texto favorito y configurar:

env:
-Configuración MongoDB 
MONGO_URL=mongodb+srv://usuario:password@cluster.mongodb.net/
MONGO_DB=tu_base_de_datos

-Configuración MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_TOPIC=rfid/tags

Ejecutar el servidor:

`uvicorn main:app --reload --host 0.0.0.0 --port 8000`

✅ Verificación: Abre tu navegador y ve a http://localhost:8000/docs. Deberías ver la documentación interactiva de la API.

## Paso 3: Configurar MongoDB Atlas

### Crear una cuenta gratuita:

1. Ve a MongoDB Atlas

3. Haz clic en "Try Free"

5. Completa el formulario de registro

7. Crear un cluster:

9. Una vez registrado, haz clic en "Build a Database"

11. Selecciona el tier M0 FREE (es gratuito)

13. Elige tu proveedor de nube y región más cercana

15. Haz clic en "Create Cluster"

### Configurar seguridad:

En "Database Access" → "Add New Database User"

Crea un usuario y contraseña (¡guárdalos!)

En "Network Access" → "Add IP Address"

Agrega 0.0.0.0/0 para acceso desde cualquier IP (solo desarrollo)

### Obtener el string de conexión:

Ve a "Database" → "Connect" → "Connect your application"

Selecciona "Python" y versión "3.6 or later"

Copia el connection string

### Actualizar el archivo .env:

env
MONGO_URL=mongodb+srv://TU_USUARIO:TU_PASSWORD@cluster.mongodb.net/
MONGO_DB=TU_BASE_DE_DATOS
Reemplaza TU_USUARIO Y TU_PASSWORD con tus credenciales.

## Paso 4: Configurar Mosquitto MQTT
Usar Mosquitto Local (Recomendado)

Instalar Mosquitto en Windows usando Chocolatey
`choco install mosquitto`

O descargar el instalador desde:
https://mosquitto.org/download/

Ejecutar Mosquitto (abre una NUEVA terminal)
`mosquitto -v`

Abre dos terminales y ejecuta:

Terminal 1 (Suscriptor):

`mosquitto_sub -h localhost -p 1883 -t "test/topic" -v`

Terminal 2 (Publicador):

`mosquitto_pub -h localhost -p 1883 -t "test/topic" -m "Hello MQTT"`

Deberías ver "Hello MQTT" en la Terminal 1.

## Paso 5: Conexión del Hardware
Conexiones M5StickCPlus2 ↔ YRM1001:

3.3V (Rojo)    →     VCC
GND (Negro)    →     GND
G32 (Verde)    →     TX
G33 (Amarillo) →     RX

Verificación física:

El LED del YRM1001 debe encenderse (alimentación correcta)

Los cables deben estar firmemente conectados

Verificar que no haya cortocircuitos

## Paso 6: Configurar y Subir el Firmware
### Abrir Arduino IDE:

Descarga desde arduino.cc si no lo tienes

Instala siguiendo el asistente

### Configurar el Board Manager:

1. Ve a File → Preferences

3. En "Additional Boards Manager URLs", agrega: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

5. Instalar el board ESP32:

7. Tools → Board → Boards Manager

9. Busca "esp32" e instala "ESP32 by Espressif Systems"

### Seleccionar el board correcto:

Tools → Board → ESP32 Arduino → M5Stick-C Plus2

### Conectar el M5Stick:

Usa cable USB-C para conectar el M5Stick a tu computadora

Tools → Port → Selecciona el puerto COM correspondiente

### Cargar el firmware:

File → Open → Navega a firmware/firmware-m5stickCplus2.ino

En el código, busca y actualiza estas líneas:

cpp
// WiFi Configuration
const char* ssid = "TU_WIFI_SSID";
const char* password = "TU_WIFI_PASSWORD";

// MQTT Configuration  
const char* mqtt_server = "192.168.1.100"; // IP de tu PC
Haz clic en "Upload" (icono de flecha derecha)

### ✅ Verificación del firmware:

Abre el "Serial Monitor" (Tools → Serial Monitor)

Configura baud rate a 115200

Deberías ver mensajes como:

text
Conectando WiFi...
✅ WiFi Conectado!
IP: 192.168.1.68
✅ MQTT Conectado!
🔍 Prueba Integral del Sistema

#### Prueba 1: Backend y Base de Datos

En tu terminal, ejecuta:
curl http://localhost:8000/status
Respuesta esperada:

json
{
  "status": "online",
  "mqtt_broker": "localhost:1883",
  "mqtt_status": "connected",
  "mongodb": "connected"
}
#### Prueba 2: Comunicación MQTT

Probar MQTT manualmente
curl -X POST "http://localhost:8000/test/mqtt?epc=test_manual_001"
Deberías ver en la terminal del backend:

text
📨 Mensaje MQTT recibido: rfid/tags -> {"epc":"test_manual_001","timestamp":"...","test":true}

#### Prueba 3: Hardware en Acción
Enciende el M5Stick (si está apagado)

Abre el Serial Monitor en Arduino IDE

Acerca un tag RFID al lector YRM1001

Deberías ver en el Serial Monitor:

text
🏷️ EPC: 000000202412260000001067
📤 MQTT: {"epc":"000000202412260000001067","timestamp":"13138"}
Y en la terminal del backend:

text
📨 Mensaje MQTT recibido: rfid/tags -> {"epc":"000000202412260000001067","timestamp":"13138"}
✅ Lectura guardada en BD. ID: 67a1b2c3d4e5f67890123456

#### Prueba 4: Verificar Datos en la Base de Datos

Consultar las lecturas guardadas
curl http://localhost:8000/lecturas/
Deberías ver un JSON con las lecturas realizadas.

## 🐛 Solución de Problemas Comunes

❌ El Backend No Inicia

Verificar que Python esté instalado
`python --version`

Verificar que las dependencias estén instaladas
`pip list`

Verificar que el puerto 8000 no esté en uso
`netstat -an | findstr 8000  # Windows`

 `lsof -i :8000  # Linux/macOS`
 
❌ MongoDB Connection Failed

- Verificar el connection string en .env
- Asegurar que las credenciales sean correctas
- Verificar que la IP esté whitelisted en MongoDB Atlas

❌ MQTT No Conecta

Verificar que Mosquitto esté ejecutándose
`tasklist | findstr mosquitto  # Windows`

`ps aux | grep mosquitto  # Linux/macOS`

Verificar firewall
`netsh advfirewall firewall add rule name="MQTT" dir=in action=allow protocol=TCP localport=1883`

❌ M5Stick No Lee RFID

- Verificar que los cables estén bien conectados

- Confirmar que el YRM1001 tenga LED encendido

- Verificar que los pines G32/G33 sean correctos

- Probar con diferentes tags RFID

❌ No Hay Comunicación Entre Componentes

Verificar IPs en la misma red
`ipconfig  # Windows`

`ifconfig  # Linux/macOS`

Verificar que el M5Stick use la IP correcta de tu PC
en mqtt_server del firmware

## ✅ Checklist de Instalación Exitosa
- Repositorio clonado y estructura visible

- Backend ejecutándose en http://localhost:8000/docs

- MongoDB Atlas configurado y conectado

- MQTT Broker respondiendo a mensajes de prueba

- Hardware conectado correctamente

- Firmware cargado en el M5Stick

- Tags RFID siendo leídos y mostrados en Serial Monitor

- Lecturas guardándose en la base de datos

- API retornando datos desde /lecturas/

Si has llegado hasta aquí, tienes todo el sistema básico funcionando:

✅ Backend FastAPI procesando requests

✅ Base de datos MongoDB almacenando datos

✅ Comunicación MQTT en tiempo real

✅ Hardware IoT leyendo tags RFID

✅ Flujo completo de datos desde tag hasta base de datos

Siguientes pasos:

1. Configurar el frontend Angular 

3. Implementar sistema de alertas

5. Agregar lectura de temperatura

7. Desplegar en entorno de producción