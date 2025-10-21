# Configuración del Hardware - M5StickCPlus2 + YRM1001

Guía completa de conexión y configuración del hardware para el sistema de cadena de frío.

## 📋 Componentes Requeridos

| Componente | Cantidad | Especificaciones | Propósito |
|------------|----------|------------------|-----------|
| **M5StickCPlus2** | 1 | ESP32-S3, WiFi, Bluetooth, Pantalla 1.14" | Dispositivo IoT principal |
| **Módulo RFID YRM1001** | 1 | UHF 902-928MHz, Protocolo EPC Gen2 | Lector de tags RFID |
| **Cables Jumper** | 4 | Macho-hembra, 10cm | Conexiones entre dispositivos |
| **Fuente Alimentación** | 1 | USB-C 5V | Energía para el sistema |
| **Tags RFID UHF** | Múltiples | EPC Gen2, 860-960MHz | Etiquetas para productos |

## 🔌 Diagrama de Conexiones

### Esquema Eléctrico
M5StickCPlus2 → YRM1001

![](imagenes/ejemplo-conexion.jpg)


### Código de Colores Recomendado
- 🔴 **Rojo:** 3.3V → VCC (Alimentación)
- ⚫ **Azul:** GND → GND (Tierra)
- 🟢 **Verde:** G32 → TX (Transmisión de datos)
- 🟡 **Amarillo:** G33 → RX (Recepción de datos)

## 🛠️ Paso a Paso de Conexión

### Paso 1: Identificar los Pines del M5StickCPlus2 

![](imagenes/m5stick-pines.png)

### Paso 2: Identificar los Pines  del modulo YRM1001

![](imagenes/modulo-YRM1001.png)
![](imagenes/tabla-YRM1001.png)

### Paso 3: Realizar las Conexiones

(**insertar imagen**)

## ✅ Verificación de la Instalación

### Indicadores LED

**En el YRM1001:**
- 🔴 **LED rojo encendido:** Alimentación correcta
- 🔴 **LED rojo apagado:** Problema de alimentación
- 🔵 **LED azul parpadeante:** leyendo etiqueta

### Prueba de Funcionamiento

1. **Conecta el M5Stick** via USB-C a la computadora
2. **Observa el LED del YRM1001** - debe estar encendido
3. **Abre el Serial Monitor** en Arduino IDE (115200 baudios)
4. **Acerca un tag RFID** al módulo YRM1001 (5-10 cm de distancia)
5. **Deberías ver en el Serial Monitor:**

🏷️ EPC: 000000202412260000001067
📤 MQTT: {"epc":"000000202412260000001067","timestamp":"13138"}

## 🐛 Solución de Problemas
**❌ LED del YRM1001 No Enciende**

Causas posibles:

- Conexión de alimentación incorrecta

- Cable 3.3V suelto o dañado

- Módulo YRM1001 defectuoso

Solución:

- Verificar conexión 3.3V → VCC

- Probar con otro cable jumper

- Medir voltaje en pin VCC con multímetro

**❌ No Lee Tags RFID**

- Causas posibles:

- Conexiones TX/RX invertidas

- Tags RFID no compatibles

- Distancia muy grande

Solución:

- Verificar G32→TX y G33→RX

- Usar tags UHF EPC Gen2 compatibles

- Acercar tag a 5-10 cm del módulo

**❌ Comunicación Serial Errática**

- Causas posibles:

- Baud rate incorrecto

- Interferencias eléctricas

- Pines flojos

Solución:

- Verificar baud rate 115200 en código y Serial Monitor

- Usar cables de calidad y bien conectados

- Alejar de fuentes de interferencia

## 📏 Especificaciones Técnicas
### M5StickCPlus2
Microcontrolador: ESP32-S3 dual-core

Memoria: 8MB PSRAM + 16MB Flash

WiFi: 802.11 b/g/n (2.4GHz)

Bluetooth: 5.0 LE

Alimentación: 5V USB-C

Puertos GPIO: G32, G33, etc.

### Módulo YRM1001
Protocolo: EPC Global UHF Gen2 (ISO 18000-6C)

Frecuencia: 902-928 MHz (ajustable)

Potencia salida: 0-30 dBm

Alcance lectura: Hasta 5 metros

Interfaz: UART TTL (3.3V)

Consumo: ~100mA durante lectura

##🔄 Flujo de Operación
1. Alimentación: M5Stick energiza YRM1001 via 5V

3. Inicialización: Comunicación serial a 115200 baudios

5. Comando: M5Stick envía comandos de inventory

7. Respuesta: YRM1001 responde con datos del tag

9. Procesamiento: M5Stick extrae EPC y formatea mensaje

11. Transmisión: Datos enviados via MQTT

## 💡 Mejores Prácticas
### Ubicación del Hardware
✅ Colocar en área despejada para mejor lectura RFID

✅ Mantener alejado de superficies metálicas

✅ Evitar fuentes de interferencia (motores, transformadores)

### Mantenimiento
✅ Verificar conexiones periódicamente

✅ Limpiar antena del YRM1001 regularmente

✅ Actualizar firmware cuando esté disponible

### Seguridad
✅ Fijar hardware para evitar desconexiones

✅ Proteger de condiciones ambientales extremas

✅ Usar fuente de alimentación estable

### 🎯 Consejos para Mejor Rendimiento
Optimización de Lectura
Distancia ideal: 5-10 cm entre tag y módulo

Orientación: Tags paralelos a la antena del YRM1001

Entorno: Minimizar objetos metálicos cercanos

Alimentación Estable
Usar fuente USB de calidad

Evitar extensiones USB largas

Verificar voltaje estable en 5V
