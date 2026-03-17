# Agent Memory — Roadmap Manager

## Descripción
El proyecto es una aplicación web para generar y gestionar roadmaps formativos de manera automatizada. Está diseñada para ser accesible por el personal interno (docentes y coordinación) y visible para los alumnos, con un enfoque en la automatización y la eficiencia para optimizar los procesos académicos.

## Stack Tecnológico
- **Frontend:** JavaScript Vanilla
- **Backend:** Node.js con Express.js
- **Base de datos:** MongoDB con Mongoose
- **Autenticación:** JSON Web Tokens (JWT)
- **Dependencias clave:**
  - `bcryptjs`: para el hash de contraseñas.
  - `body-parser`: para parsear los cuerpos de las peticiones.
  - `cors`: para la gestión de Cross-Origin Resource Sharing.
  - `dotenv`: para la gestión de variables de entorno.
  - `jsonwebtoken`: para la creación y verificación de tokens de acceso.
  - `mongoose`: como ODM para interactuar con MongoDB.
  - `multer`: para la subida de archivos.
  - `nodemailer`: para el envío de correos electrónicos.
  - `xlsx`: para trabajar con archivos Excel.

## Arquitectura
- **`backend/`**: Contiene la lógica del servidor.
  - **`models/`**: Define los esquemas de Mongoose para las colecciones de la base de datos (ej. `Student.js`, `Promotion.js`, `Competence.js`).
  - **`utils/`**: Utilidades reusables, como el envío de correos (`email.js`).
  - **`keys/`**: Almacena las claves públicas para la verificación de tokens JWT externos.
- **`public/`**: Contiene los archivos estáticos del frontend.
  - **`css/`**: Hojas de estilo.
  - **`js/`**: Lógica de cliente en JavaScript Vanilla, separada por vistas o funcionalidades (ej. `auth.js`, `dashboard.js`).
  - **`img/`**: Imágenes y recursos gráficos.
  - **Archivos HTML**: Vistas principales de la aplicación (`index.html`, `login.html`, `dashboard.html`, etc.).
- **`server.js`**: Punto de entrada de la aplicación. Configura el servidor Express, la conexión a la base de datos, los middlewares y las rutas principales.
- **`package.json`**: Define los metadatos del proyecto, las dependencias y los scripts.

## Convenciones
- **Estilo de código:** El código backend utiliza módulos ES (`import`/`export`). El frontend es JavaScript Vanilla.
- **Naming:** Los modelos de Mongoose siguen la convención de nombres en singular y con mayúscula inicial (ej. `Student`). Las rutas de la API parecen seguir un estilo RESTful.
- **Patrones:** La aplicación sigue un patrón de servidor monolítico que sirve tanto la API como los archivos estáticos del frontend.

## Decisiones Técnicas
- **JavaScript Vanilla en el Frontend:** Se optó por no usar un framework de frontend moderno (como React, Vue o Angular) para mantener la simplicidad y reducir la sobrecarga, alineado con el objetivo de mantener un bajo coste.
- **Node.js y Express en el Backend:** Una elección común y robusta para construir APIs RESTful, con un amplio ecosistema de librerías.
- **MongoDB como Base de Datos:** Su naturaleza NoSQL y su flexibilidad son adecuadas para un proyecto en evolución donde los esquemas pueden cambiar.
- **Autenticación dual:** El sistema soporta autenticación propia basada en email/contraseña y una autenticación externa mediante JWT (RS256), lo que sugiere integración con un sistema de usuarios centralizado.

## Estado Actual
- La aplicación está en desarrollo y mejora continua.
- Funcionalidades principales implementadas incluyen la generación de roadmaps, gestión de contenidos, y seguimiento de asistencia.
- No hay un framework de testing configurado (`"test": "echo \"Error: no test specified\" && exit 1"`).
- Existe una guía de migración (`MIGRATION_GUIDE.md`) y varios scripts de migración, lo que indica que la base de datos ha sufrido cambios estructurales.

## Contexto para Cambios
- Antes de realizar cambios, es crucial entender la separación entre la lógica de backend (Node.js) y la de frontend (JavaScript Vanilla).
- Cualquier cambio en los modelos de la base de datos (`backend/models/`) puede requerir un script de migración si hay datos existentes.
- La autenticación tiene dos flujos (interno y externo) que deben ser considerados al modificar el sistema de login o la seguridad de las rutas.
- Dado que no hay tests automatizados, los cambios deben ser probados manualmente de forma exhaustiva.
