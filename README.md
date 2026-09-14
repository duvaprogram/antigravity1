# 🚚 Sistema de Domicilios

Sistema completo de gestión de domicilios/entregas con panel de administración moderno.

![Estado](https://img.shields.io/badge/Estado-En%20Desarrollo-yellow)
![Supabase](https://img.shields.io/badge/Backend-Supabase-green)

## 🌟 Características

- **📦 Gestión de Productos**: Catálogo completo con SKU, categorías y precios
- **📊 Control de Inventario**: Stock por ciudad con alertas de bajo inventario
- **👥 Gestión de Clientes**: Base de datos de clientes con información de contacto
- **📋 Guías de Despacho**: Creación y seguimiento de entregas
- **✅ Confirmaciones**: Registro y análisis de confirmaciones de pedidos
- **🌙 Modo Oscuro/Claro**: Interfaz adaptable a preferencias del usuario

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Estilo**: CSS personalizado con variables y glassmorphism

## 🚀 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/duvaprogram/antigravity1.git
cd antigravity1
```

2. Configura Supabase:
   - Crea un proyecto en [Supabase](https://supabase.com/)
   - Actualiza las credenciales en `js/supabase-config.js`

3. Ejecuta un servidor local:
```bash
npx http-server -p 3000
```

4. Abre en tu navegador: `http://localhost:3000`

## 📁 Estructura del Proyecto

```
domicilios-system/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos globales
├── js/
│   ├── app.js          # Módulo principal
│   ├── database.js     # Capa de acceso a datos (Supabase)
│   ├── supabase-config.js  # Configuración de Supabase
│   ├── clients.js      # Módulo de clientes
│   ├── products.js     # Módulo de productos
│   ├── inventory.js    # Módulo de inventario
│   ├── guides.js       # Módulo de guías
│   └── confirmation.js # Módulo de confirmaciones
└── assets/             # Recursos estáticos
```

## 🔐 Configuración de Supabase

El proyecto utiliza las siguientes tablas en Supabase:
- `products` - Catálogo de productos
- `cities` - Ciudades de operación
- `categories` - Categorías de productos
- `inventory` - Stock por ciudad
- `clients` - Información de clientes
- `guides` - Guías de despacho
- `guide_items` - Items de cada guía
- `guide_statuses` - Estados de las guías
- `confirmations` - Registro de confirmaciones
- `pages` - Páginas/orígenes de pedidos

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 👤 Autor

Desarrollado con ❤️ por [duvaprogram](https://github.com/duvaprogram)
