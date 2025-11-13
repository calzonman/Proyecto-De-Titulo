
# 🖥️ Frontend - Dashboard de Control de Inventario

![React](https://img.shields.io/badge/React-18.0%2B-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite)
![shadcn/ui](https://img.shields.io/badge/UI-shadcn/ui-black?logo=shadcnui)
![Tailwind CSS](https://img.shields.io/badge/CSS-Tailwind-38B2AC?logo=tailwindcss)

Interfaz de usuario moderna y responsiva diseñada para la gestión visual del sistema de cadena de frío. Este frontend consume la API REST del backend (FastAPI) y presenta los datos de trazabilidad RFID y telemetría en tiempo real.

> **Nota de Diseño:** La interfaz ha sido implementada siguiendo fielmente los mockups de Figma y utiliza un sistema de componentes modular para asegurar una experiencia de usuario intuitiva.

## 🎯 Funcionalidades Principales

| Funcionalidad | Estado | Descripción |
|---------------|---------|-------------|
| **Dashboard Principal** | ✅ Listo | Visualización de la última lectura, productos y etiquetas sin asociar. |
| **Gestión de Productos** | ✅ Listo | Listar, crear y asociar etiquetas RFID a productos existentes. |
| **Gráficos de Telemetría** | ✅ Listo | Gráficos históricos de temperatura por producto usando Recharts. |
| **Asociación de Etiquetas** | ✅ Listo | Flujo modal para asociar etiquetas RFID (EPC) a productos. |
| **Diseño Responsivo** | ✅ Listo | Adaptable a tablets y escritorio para uso en almacén. |

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología | Uso |
|-----------|------------|-----|
| **Core** | React 18 + TypeScript | Biblioteca de UI y tipado estático robusto. |
| **Build Tool** | Vite | Entorno de desarrollo ultrarrápido. |
| **Componentes UI** | **shadcn/ui** | Componentes de UI accesibles y componibles (Cards, Dialogs, Badges). |
| **Estilos** | **Tailwind CSS** | Framework CSS utility-first para estilizado rápido. |
| **Estado** | React Hooks (`useState`) | Gestión del estado local del componente. |
| **HTTP Client** | **Fetch (nativo)** | Comunicación con la API Backend (FastAPI). |
| **Gráficos** | **Recharts** | Librería para la creación de gráficos de líneas (temperatura). |
| **Iconos** | **Lucide React** | Biblioteca de iconos SVG limpia y ligera. |

## 📁 Estructura del Directorio (Simplificada)

frontend/
├── public/             # Archivos estáticos
├── src/
│   ├── components/     # Componentes de UI (la mayoría de shadcn)
│   │   └── ui/         # -> Botones, Cards, Dialogs, etc.
│   ├── services/       # Lógica de peticiones (ej: productos.ts, lecturas.ts)
│   ├── App.tsx         # Componente raíz y lógica principal del dashboard
│   ├── globals.css     # Estilos globales y variables de Tailwind
│   └── main.tsx        # Punto de entrada de React
├── .env.example        # Plantilla de variables de entorno
├── index.html          # Entry point HTML
├── package.json        # Dependencias y scripts
├── tsconfig.json       # Configuración de TypeScript
└── vite.config.ts      # Configuración de Vite

## 🚀 Instalación y Configuración
###Prerrequisitos
- Node.js (v18 o superior recomendado)

- NPM (o Yarn/PNPM)

- Backend (FastAPI) ejecutándose localmente (normalmente en http://localhost:8000).

### Paso 1: Instalar Dependencias
Navega a la carpeta del frontend e instala los paquetes necesarios:

Bash:

`cd frontend`

`npm install`

### Paso 2: Configurar Variables de Entorno
Crea un archivo .env en la raíz de la carpeta frontend. Puedes copiarlo desde .env.example si existe. Asegúrate de definir la URL de tu API:

####Dentro del archivo .env establece:
`VITE_API_URL=http://localhost:8000`

Este valor es leído por los servicios (ej: import.meta.env.VITE_API_URL) para conectar con el backend.

### Paso 3: Ejecutar en Desarrollo
Inicia el servidor de desarrollo local de Vite:

Bash:

`npm run dev`

La aplicación estará disponible (generalmente en http://localhost:5173 o un puerto similar).

### 📜 Scripts Disponibles
`npm run dev`: Inicia el servidor de desarrollo con Hot Reload.

`npm run build`: Compila la aplicación para producción (genera la carpeta dist).

`npm run preview`: Previsualiza la build de producción localmente.

###🔌 Integración con Backend
El frontend espera que el backend (FastAPI) esté ejecutándose en la URL definida en VITE_API_URL. Es crucial que el backend tenga configurado CORS para permitir peticiones desde el origen del frontend (ej: http://localhost:5173).
  
