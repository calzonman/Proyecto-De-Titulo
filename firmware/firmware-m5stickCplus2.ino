#include <M5StickCPlus2.h>
#include <WiFi.h>
#include <PubSubClient.h>

// Configuración WiFi y MQTT
const char* ssid = "TU_WIFI";
const char* password = "TU_PASSWORD";
const char* mqtt_server = "TU_BROKER_MQTT";
const int mqtt_port = 1883; // Puerto MQTT
const char* mqtt_topic = "rfid/tags"; // Tema MQTT

WiFiClient espClient;
PubSubClient client(espClient);

// Configuración RFID 
HardwareSerial UHFSerial(1);
const int UHF_TX_PIN = 32;
const int UHF_RX_PIN = 33;
const unsigned long UHF_BAUD = 115200;

const uint8_t CMD_SINGLE_POLLING[] = {0xBB,0x00,0x22,0x00,0x00,0x22,0x7E};

// Enviar comando genérico
void sendCommand(const uint8_t* cmd, size_t len) {
  UHFSerial.write(cmd, len);
  UHFSerial.flush();
}

// Leer respuesta UART
size_t readResponse(uint8_t* out, size_t maxLen, unsigned long timeout = 500) {
  unsigned long start = millis();
  size_t idx = 0;
  while (millis() - start < timeout) {
    while (UHFSerial.available() && idx < maxLen) {
      out[idx++] = (uint8_t)UHFSerial.read();
    }
  }
  return idx;
}

// Extraer EPC del buffer 
bool extractEPC(const uint8_t* buf, size_t len, uint8_t* epcOut, size_t epcLen) {
  for (size_t i = 0; i + 10 < len; i++) {
    if (buf[i] == 0xBB && buf[i+1] == 0x02 && buf[i+2] == 0x22) {
      uint16_t dataLen = ((uint16_t)buf[i+3] << 8) | buf[i+4];
      size_t frameLen = dataLen + 7; 
      if (i + frameLen <= len && buf[i + frameLen - 1] == 0x7E) {
        // EPC en los últimos 12 bytes del payload
        size_t epcStart = i + frameLen - 1 - 12 - 2;
        if (epcStart + epcLen <= len) {
          memcpy(epcOut, buf + epcStart, epcLen);
          return true;
        }
      }
    }
  }
  return false;
}

void printHexBuf(const uint8_t* buf, size_t len) {
  for (size_t i = 0; i < len; i++) {
    if (buf[i] < 0x10) Serial.print('0');
    Serial.print(buf[i], HEX);
    Serial.print(' ');
  }
}

void setupWiFi() {
  Serial.println("Conectando WiFi...");
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Conectado!");
}

void setupMQTT() {
  client.setServer(mqtt_server, mqtt_port);
  while (!client.connected()) {
    if (client.connect("M5StickCPlus2_RFID")) {
      Serial.println("✅ MQTT Conectado!");
    } else {
      delay(5000);
    }
  }
}

void sendToMQTT(const String& epc) {
  String payload = "{\"epc\":\"" + epc + "\",\"timestamp\":\"" + String(millis()) + "\"}";
  client.publish(mqtt_topic, payload.c_str());
  Serial.println("📤 MQTT: " + payload);
}

void setup() {
  // Inicialización MÍNIMA del M5Stick
  M5.begin();
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("=== INICIANDO SISTEMA ===");
  
  // Inicializar RFID PRIMERO
  UHFSerial.begin(UHF_BAUD, SERIAL_8N1, UHF_RX_PIN, UHF_TX_PIN);
  delay(100);
  
  // Configurar pantalla básica
  M5.Lcd.setRotation(1);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.setTextSize(1);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.println("Sistema iniciado");
  
  // Conectar redes
  setupWiFi();
  setupMQTT();
  
  M5.Lcd.println("✅ Todo listo!");
  Serial.println("✅ Setup completado");
}

void loop() {
  M5.update();
  client.loop();
  
  // Lectura RFID
  sendCommand(CMD_SINGLE_POLLING, sizeof(CMD_SINGLE_POLLING));
  delay(100);
  uint8_t buf1[256];
  size_t len1 = readResponse(buf1, sizeof(buf1));
  
  if (len1 > 0) {
    uint8_t epc[12];
    if (extractEPC(buf1, len1, epc, sizeof(epc))) {
      // Convertir EPC a string
      String epcStr;
      for (size_t i = 0; i < sizeof(epc); i++) {
        if (epc[i] < 0x10) epcStr += '0';
        epcStr += String(epc[i], HEX);
      }
      
      Serial.print("EPC: ");
      Serial.println(epcStr);
      
      // Actualizar pantalla
      M5.Lcd.fillRect(0, 20, 160, 40, BLACK);
      M5.Lcd.setCursor(0, 20);
      M5.Lcd.println("Tag detectado:");
      M5.Lcd.println(epcStr.substring(0, 16));
      
      // Enviar a MQTT
      sendToMQTT(epcStr);
    }
  }
  
  delay(1000);
}