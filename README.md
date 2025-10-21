# 🧊 Sistema de Control de Inventario en Cadena de Frío

![Estado](https://img.shields.io/badge/Estado-MVP%20Funcional-brightgreen)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue)
![Python](https://img.shields.io/badge/Python-3.11%2B-yellow)
![IoT](https://img.shields.io/badge/Platform-IoT%20%2B%20Cloud-orange)

Sistema IoT integral para monitoreo y trazabilidad en tiempo real de productos perecederos, diseñado específicamente para PYMES del sector alimentario y farmacéutico.

## 🎯 Problemática Que Apunta

- **Pérdidas del 30-45%** en frutas y hortalizas por mala gestión de frío (ODEPA, 2023)
- **420,000 muertes anuales** por ETAs relacionadas con cadena de frío (OMS, 2023)
- **Altos costos** de soluciones empresariales inaccesibles para PYMES
- **Falta de trazabilidad** en tiempo real de productos sensibles

##  Características Principales

| Funcionalidad | Estado | Beneficio |
|---------------|---------|------------|
| Trazabilidad en tiempo real | ✅ MVP | Conocer ubicación exacta de productos |
| Lectura automática de RFID | ✅ MVP | Identificación sin contacto |
| Comunicación MQTT en tiempo real | ✅ MVP | Datos instantáneos |
| Almacenamiento en MongoDB Cloud | ✅ MVP | Acceso remoto a datos |
| API REST documentada | ✅ MVP | Integración sencilla |
| Monitoreo continuo de temperatura | 🔄 En desarrollo | Detectar rupturas de cadena de frío |
| Dashboard interactivo | 🔄 En desarrollo | Visualización intuitiva |
| Alertas automáticas | 🔄 En desarrollo | Notificaciones inmediatas |

## 🏗️ Arquitectura del Sistema

**colocar imagen de la arquitectura**

## 🛠️ Tecnologías Utilizadas
| Capa | Tecnologías | Propósito |
|------|-------------|-----------|
| **Backend** | FastAPI, Python 3.11, Pydantic, Motor | API REST y lógica de negocio |
| **Base de Datos** | MongoDB Atlas, AsyncIO | Almacenamiento escalable |
| **IoT & Comunicación** | MQTT, ESP32, M5stickCplus2, YRM1001 | Comunicación en tiempo real |
| **Desarrollo** | Git, GitHub, Arduino IDE, Visual Studio | Control de versiones y desarrollo |
| **Infraestructura** | MongoDB Cloud, Mosquitto MQTT | Servicios en la nube |

## 📁 Estructura del Proyecto

Proyecto-De-Titulo/
├── 📁 backend/                 # API FastAPI 
│   ├── main.py                # Aplicación principal
│   ├── models.py              # Modelos de datos
│   ├── requirements.txt       # Dependencias Python
│   └── README.md              # Documentación backend
├── 📁 firmware/               # Código para M5StickCPlus2
│   ├── m5stick_rfid.ino      # Sketch Arduino principal
│   └── README.md              # Documentación firmware
├── 📁 docs/                   # Documentación técnica
│   ├── instalacion.md        # Guía de instalación 
│   ├── arquitectura.md        # Arquitectura del sistema
│   └── hardware-setup.md       # Instalación de componentes físicos
├── 📁 images/                 # Diagramas y capturas
├── 📄 .gitignore             # Archivos ignorados por Git
├── 📄 LICENSE                # Licencia MIT
└── 📄 README.md              # Este archivo

## 📊 Estado de Desarrollo
✅ COMPLETADO (MVP Funcional)
1. Backend FastAPI con CRUD completo

3. Comunicación MQTT integrada

5. Lectura y procesamiento de tags RFID

7. Almacenamiento en MongoDB Atlas

9. API REST documentada con Swagger

11. Reconexión automática WiFi/MQTT

13. Manejo de errores robusto

🔄 EN DESARROLLO

1. Frontend Angular con dashboard

3. Sistema de alertas y notificaciones

5. Lectura de datos de temperatura

## 🎯 Casos de Uso
### 🏭 Almacenes de Productos Perecederos
- Monitoreo en tiempo real de temperatura

- Trazabilidad de lote a lote

- Alertas por ruptura de cadena de frío

### 🚚 Transporte Refrigerado
- Verificación de condiciones durante tránsito

- Registro automático de entregas

- Comprobación de condiciones al recibir

### 💊 Farmacias y Hospitales
1. Control de vacunas y medicamentos sensibles

3. Cumplimiento de normativas sanitarias

5. Auditoría automática de condiciones