<img src="./public/img/f5_banner_roadmpa_manager.PNG">

# 👋 Roadmap Manager App

Este repositorio contiene una **aplicación web diseñada para generar y gestionar de forma automatizada roadmaps formativos**, optimizando los procesos académicos y de coordinación.

La aplicación es:

- 🔒 **Accesible para personal interno**
- 👀 **Visible para alumnos**
- ⚡ **Orientada a la automatización y eficiencia**

---

## 💡 Origen de la iniciativa

Este proyecto surge como una **idea impulsada por [Alexandra Zambrano](https://github.com/AlexandraZambrano)**, con el objetivo de mejorar la organización, planificación y seguimiento de la experiencia formativa.

---

## 🧡Propósito de la aplicación

La app permite:

-  **Creación automatizada de roadmaps**
-  **Gestión de píldoras formativas**
-  **Control de asistencias**
-  **Centralización de información académica**

Facilitando el trabajo de:

- 👩‍🏫 **Personal docente**
- 🧑‍💼 **Equipo de coordinación**
- 🎓 **Alumnado**

---

##  Reto del proyecto

El principal desafío de esta iniciativa es:

> **Diseñar y desarrollar una aplicación interna optimizando los recursos disponibles, garantizando accesibilidad, escalabilidad y un coste muy bajo para la organización.**

Este enfoque busca:

- Reducir carga operativa  
- Mejorar la eficiencia organizativa  
- Minimizar costes de infraestructura  
- Asegurar sostenibilidad tecnológica  

---

##  Stack tecnológico

La aplicación está construida con:

- **Frontend:** JavaScript Vanilla + Bootstrap 5
- **Backend:** Node.js + Express  
- **Base de datos:** MySQL (via Sequelize ORM)
- **Auth:** API externa Symfony (tokens RS256)

---


## ⚙️ Configuración del entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `SQL_DIALECT` | Motor SQL: `mysql`, `postgres`, `mariadb`… |
| `SQL_HOST` | Host de la base de datos |
| `SQL_PORT` | Puerto (MySQL: 3306) |
| `SQL_DATABASE` | Nombre del schema |
| `SQL_USER` / `SQL_PASSWORD` | Credenciales SQL |
| `SQL_SSL` | `true` si el proveedor cloud requiere SSL |
| `NODE_ENV` | `development` o `production` |
| `EXTERNAL_AUTH_URL_PROD` | URL de la API de autenticación externa |
| `EXTERNAL_JWT_PUBLIC_KEY` | Clave pública RS256 del servidor de auth (ver abajo) |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Cuenta Gmail para envío de emails |

### 🔑 Clave pública RS256

La clave pública del servidor de autenticación se configura con la variable `EXTERNAL_JWT_PUBLIC_KEY`. Pega el contenido PEM en una sola línea, **reemplazando los saltos de línea reales por `\n`**:

```
EXTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----
```

> Si la variable no está definida, el servidor intentará leer el fichero `backend/keys/public.pem` como fallback.


## Funcionalidades principales

- Generación dinámica de roadmaps  
- Gestión de contenidos formativos  
- Seguimiento de asistencia  
- Panel de control interno  
- Visualización para alumnado  

---

##  Estado del proyecto

Aplicación en desarrollo y mejora continua.

Como miembro del equipo puedes:

1. Proponer mejoras mediante *issues*  
2. Contribuir mediante *pull requests*  
3. Sugerir nuevas funcionalidades  
4. Colaborar en la evolución del producto  

---

✨ Desarrollado para optimizar la gestión formativa  
🧡 Idea impulsada por Alexandra Zambrano 🧡 
