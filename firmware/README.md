# Firmware - M5StickCPlus2 con Módulo RFID YRM1001

Firmware para el dispositivo M5StickCPlus2 que lee tags RFID del módulo YRM1001 y envía los datos via MQTT al backend del sistema de cadena de frío.

## 🎯 Funcionalidades

-  **Lectura de tags RFID UHF** usando protocolo EPC Global Gen2
-  **Conexión WiFi automática** con reconexión inteligente
-  **Comunicación MQTT** con el broker configurado
-  **Envío de datos en tiempo real** con formato JSON
-  **Manejo de errores** y reconexiones automáticas
-  **Interfaz visual** en pantalla del M5Stick

## Hardware Requerido

| Componente | Especificaciones | Conexión |
|------------|------------------|----------|
| **M5StickCPlus2** | ESP32-S3, WiFi, Bluetooth | Dispositivo principal |
| **YRM1001** | Lector RFID UHF 902-928MHz | Módulo RFID |
| **Cables Jumper** | Macho-hembra, 4 unidades | Conexiones |
| **Fuente Alimentación** | 5V USB-C | Energía |

## 🔌 Diagrama de Conexiones
M5StickCPlus2 → YRM1001

colocar imagen

**Código de colores recomendado:**
- 🔴 **Rojo:** 3.3V → VCC
- ⚫ **Negro:** GND → GND  
- 🟢 **Verde:** G32 → TX
- 🟡 **Amarillo:** G33 → RX

## ⚙️ Configuración

### 1. Configuración WiFi

// En el archivo firmware/m5stick_rfid.ino
`const char* ssid = "TU_WIFI_SSID";`
`const char* password = "TU_WIFI_PASSWORD";`

### 2. Configuración MQTT

`const char* mqtt_server = "192.168.1.100";  // IP de tu PC con el broker`
`const int mqtt_port = 1883;`
`const char* mqtt_topic = "rfid/tags";`
`const char* mqtt_client_id = "M5StickCPlus2_RFID";`

### 3. Configuración RFID

`const int UHF_RX_PIN = 32;   // GPIO32 para RX`
`const int UHF_TX_PIN = 33;   // GPIO33 para TX`
`const unsigned long UHF_BAUD = 115200;`

## 📦 Instalación Paso a Paso
### Paso 1: Instalar Arduino IDE
Descargar Arduino IDE desde arduino.cc

Instalar siguiendo el asistente

Abrir Arduino IDE

### Paso 2: Configurar Board Manager
File → Preferences

En "Additional Boards Manager URLs", agregar:

text
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
Click "OK"

### Paso 3: Instalar Board ESP32
Tools → Board → Boards Manager

Buscar "esp32"

Instalar "ESP32 by Espressif Systems"

Esperar a que termine la instalación

### Paso 4: Seleccionar Board Correcto
Tools → Board → ESP32 Arduino

Seleccionar "M5Stick-C Plus2"

### Paso 5: Instalar Librerías Requeridas
Sketch → Include Library → Manage Libraries

Buscar e instalar:

M5StickCPlus2 by M5Stack

PubSubClient by Nick O'Leary

### Paso 6: Conectar Hardware
Conectar M5StickCPlus2 via USB-C a la computadora

Realizar las conexiones con el YRM1001 según el diagrama

Verificar que el LED del YRM1001 esté encendido

### Paso 7: Configurar Puerto
Tools → Port

Seleccionar el puerto COM correspondiente al M5Stick

En Windows: normalmente COM3, COM4, etc.

En Linux/Mac: normalmente /dev/ttyUSB0

### Paso 8: Cargar Firmware
File → Open y navegar a firmware/m5stick_rfid.ino

Actualizar las credenciales WiFi y MQTT en el código

Click en "Upload" (➡️ icono de flecha)

Esperar a que compile y suba el código

### 🔍 Verificación
Serial Monitor
Tools → Serial Monitor

Configurar baud rate a 115200

Deberías ver mensajes como:

text
=== INICIANDO M5StickCPlus2 ===
Conectando WiFi...
.......
✅ WiFi Conectado!
IP: 192.168.1.68
Conectando MQTT...✅ MQTT Conectado!
✅ Sistema listo!
Prueba de Lectura RFID

Acercar un tag RFID al módulo YRM1001

Deberías ver en el Serial Monitor:

text
🏷️ EPC: 000000202412260000001067
📤 MQTT: {"epc":"000000202412260000001067","timestamp":"13138"}
📡 Comunicación MQTT
Estructura del Mensaje
json
{
  "epc": "000000202412260000001067",
  "timestamp": "13138"
}
Topics Utilizados
Publicación: rfid/tags - Envío de lecturas RFID

Suscripción: (Por implementar) - Para recibir comandos

## 🎛️ Comandos RFID Implementados

Comando de Inventory:

`const uint8_t CMD_SINGLE_POLLING[] = {0xBB, 0x00, 0x22, 0x00, 0x00, 0x22, 0x7E};`

Comando de Lectura de Datos:

`const uint8_t CMD_READ_DATA[] = {0xBB, 0x00, 0x39, 0x00, 0x09, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x00, 0x00, 0x02, 0x45, 0x7E};`

## 🖥️ Interfaz Visual en M5Stick
La pantalla del M5Stick muestra:

- Estado de conexión WiFi y MQTT

- IP asignada del dispositivo

- Último EPC leído

- Estado de escaneo en tiempo real

- Estados Visuales
🟢 Verde: Conectado y funcionando
🟡 Amarillo: Escaneando
🔴 Rojo: Error de conexión
⚫ Negro: Esperando datos

## 🔧 Personalización
- Modificar Frecuencia de Escaneo

// En la función loop(), modificar el delay
`delay(2000);  // Escanear cada 2 segundos`

- Agregar Más Comandos RFID

// Ejemplo: Comando para obtener versión del firmware
`const uint8_t CMD_GET_VERSION[] = {0xBB, 0x00, 0x03, 0x00, 0x03, 0x7E};`

- Cambiar Topic MQTT

`const char* mqtt_topic = "rfid/lecturas";  // Topic personalizado`

## 🐛 Solución de Problemas
- ❌ No Se Conecta a WiFi

// Verificar:
// - SSID y password correctos
// - Red 2.4GHz (ESP32 no soporta 5GHz)
// - Señal WiFi suficiente

- ❌ Error de Compilación

// Posibles soluciones:
// - Verificar que las librerías estén instaladas
// - Seleccionar board correcto (M5Stick-C Plus2)
// - Verificar que ESP32 board esté instalado

- ❌ No Lee Tags RFID

// Verificar:
// - Conexiones físicas (VCC, GND, TX, RX)
// - Alimentación adecuada (LED YRM1001 encendido)
// - Tags RFID compatibles (UHF EPC Gen2)
// - Distancia adecuada (5-10 cm máximo)

- ❌ MQTT No Conecta

// Verificar:
// - IP correcta del broker MQTT
// - Puerto 1883 accesible
// - Broker ejecutándose
// - Firewall bloqueando conexiones

- ❌ Serial Monitor Sin Datos

// Verificar:
// - Baud rate configurado a 115200
// - Puerto COM correcto seleccionado
// - Cable USB funcionando
// - M5Stick encendido (botón lateral)

## 📊 Logs de Diagnóstico
### Logs Normales

✅ WiFi Conectado! IP: 192.168.1.68
✅ MQTT Conectado!
🔍 Escaneando RFID...
🏷️ EPC: 000000202412260000001067
📤 MQTT: {"epc":"000000202412260000001067","timestamp":"13138"}

### Logs de Error

❌ Error conectando WiFi
❌ Fallo MQTT, rc=-2
❌ Sin respuesta del lector RFID
❌ No se pudo extraer EPC

## 🔄 Flujo de Operación
1. Inicialización: Configura WiFi, MQTT y RFID

3. Conexión: Conecta a WiFi y broker MQTT

5. Escaneo: Lee tags RFID cada 2 segundos

7. Procesamiento: Extrae EPC del mensaje RFID

9. Transmisión: Envía datos via MQTT

11. Visualización: Muestra estado en pantalla

13. Reconexión: Maneja errores automáticamente