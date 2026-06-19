# Manual de instalación — VirtualMed

Guía completa para instalar y ejecutar el ecosistema **VirtualMed** (proyecto integrador).  
Actualizado para la arquitectura con **Docker Compose**, chatbot RAG consumido **directamente desde el frontend**, y base de datos en **PostgreSQL (Render)**.

---

## Tabla de contenidos

1. [Descripción del sistema](#1-descripción-del-sistema)
2. [Requisitos previos](#2-requisitos-previos)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Arquitectura y puertos](#4-arquitectura-y-puertos)
5. [Instalación con Docker (recomendado)](#5-instalación-con-docker-recomendado)
6. [Archivo `.env` completo](#6-archivo-env-completo)
7. [Base de datos](#7-base-de-datos)
8. [MinIO (documentos de médicos)](#8-minio-documentos-de-médicos)
9. [Verificación](#9-verificación)
10. [Uso de la aplicación](#10-uso-de-la-aplicación)
11. [Instalación sin Docker (desarrollo)](#11-instalación-sin-docker-desarrollo)
12. [Despliegue en otra máquina](#12-despliegue-en-otra-máquina)
13. [Solución de problemas](#13-solución-de-problemas)
14. [Qué compartir del proyecto](#14-qué-compartir-del-proyecto)
15. [Resumen para sustentación](#15-resumen-para-sustentación)

---

## 1. Descripción del sistema

VirtualMed es una plataforma de telemedicina integrada compuesta por:

| Componente | Tecnología | Función |
|------------|------------|---------|
| **Frontend** | Next.js (React) | Interfaz web (paciente, médico, admin) |
| **Backend** | .NET 10 / ASP.NET Core | API REST, autenticación JWT, citas, videoconsulta, riesgo CV |
| **Chatbot RAG** | FastAPI + LlamaIndex + ChromaDB | Asistente clínico con documentos PDF indexados |
| **Risk Prediction** | FastAPI + scikit-learn/XGBoost | Predicción de riesgo cardiovascular |
| **MinIO** | Object storage S3-compatible | PDFs de soporte al **registro de médicos** |
| **Base de datos** | PostgreSQL | Usuarios, citas, historias clínicas, etc. |

> **MinIO ≠ RAG del chatbot.** Los PDFs del panel admin RAG viven en `chatbot-virtualmed/data/` + Chroma. MinIO solo guarda documentos que sube un médico al registrarse.

---

## 2. Requisitos previos

### Software

| Herramienta | Versión mínima | Uso |
|-------------|----------------|-----|
| **Docker Desktop** | Reciente | Levantar todos los servicios |
| **Git** | Cualquiera | Clonar el repositorio |
| **.NET SDK** | 10.x | Migraciones de base de datos (una vez) |
| **Node.js** | 20+ | Solo si desarrollas frontend sin Docker |
| **Python** | 3.12 | Solo si desarrollas chatbot/risk sin Docker |

### Cuentas y claves externas

| Servicio | Variable | Dónde obtenerla |
|----------|----------|-----------------|
| Google AI (Gemini) | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| NVIDIA (embeddings) | `NVIDIA_API_KEY` | [NVIDIA Build](https://build.nvidia.com/) |
| PostgreSQL | `POSTGRES_CONNECTION` | [Render](https://render.com) u otro hosting |

### Hardware recomendado

- **RAM:** 8 GB libres mínimo (el chatbot con Chroma consume memoria).
- **Disco:** ~5 GB para imágenes Docker.
- **Red:** acceso a internet (APIs Gemini/NVIDIA y PostgreSQL en Render).

---

## 3. Estructura del repositorio

```text
integrador/
├── docker-compose.yml              ← Orquesta los 5 contenedores (+ MinIO)
├── .env.example                    ← Plantilla de configuración
├── .env                            ← Tu configuración (NO subir a Git)
├── scripts/
│   ├── sync-frontend-env.sh        ← Copia NEXT_PUBLIC_* al frontend (dev local)
│   └── sync-frontend-env.ps1
├── README.md
├── docs/
│   ├── MANUAL_DE_INSTALACION.md    ← Este documento
│   └── audit_log_bd_triggers.sql   ← Triggers de auditoría (ejecutar en PostgreSQL)
├── VirtualMed_Frontend/            ← Next.js
├── VirtualMedBackend/              ← API .NET
├── chatbot-virtualmed/             ← Chatbot RAG
│   ├── Dockerfile
│   ├── data/                       ← PDFs del corpus (persistente)
│   └── chroma_db/                  ← Índice vectorial (persistente)
└── virtualmed-risk-prediction/     ← Modelo ML
    ├── Dockerfile
    └── models/                     ← Modelo entrenado v1
```

---

## 4. Arquitectura y puertos

### Diagrama

```mermaid
flowchart TB
  subgraph Browser["Navegador del usuario"]
    U[Usuario]
  end

  U -->|:3000| FE[Frontend Next.js]
  U -->|:5045| BE[Backend .NET]
  U -->|:8000| CB[Chatbot FastAPI]

  BE --> DB[(PostgreSQL Render)]
  BE -->|interno| RP[Risk ML :8001]
  BE -->|interno| MO[MinIO :9000]

  CB --> DATA[data/ + chroma_db/]
```

### Puertos expuestos en localhost

| Puerto | Servicio | Visible al usuario |
|--------|----------|-------------------|
| **3000** | Frontend | Sí — aplicación web |
| **5045** | Backend API | Sí — login, citas, etc. |
| **8000** | Chatbot | Sí — chat y panel RAG admin |
| **8001** | Risk ML | Opcional (debug); backend lo usa por red interna |
| **9000** | MinIO API | Opcional (debug); backend lo usa por red interna |
| **9001** | MinIO Console | Sí — panel web para ver buckets/archivos |

### Quién llama a quién

| Funcionalidad | Ruta |
|---------------|------|
| Login, citas, videoconsulta, riesgo CV | Navegador → **Backend** (:5045) |
| Chat del paciente | Navegador → **Chatbot** (`POST /chat`) |
| Panel admin: subir/listar/borrar PDFs RAG | Navegador → **Chatbot** (`/ingest/*`) |
| Registro de médico (PDF soporte) | Backend → **MinIO** (bucket `doctor-documents`) |
| Predicción de riesgo | Backend → Risk ML (red Docker interna) |

> El **backend no interviene** en el chat ni en la gestión RAG. Eso va directo al chatbot.

---

## 5. Instalación con Docker (recomendado)

### Paso 1 — Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd integrador
```

### Paso 2 — Crear el archivo `.env`

```bash
cp .env.example .env
```

Edita `.env` con tus valores reales (ver [sección 6](#6-archivo-env-completo)).

### Paso 3 — Migraciones de base de datos (EF Core)

Solo la **primera vez** (requiere .NET SDK instalado). Crea tablas e índices desde el código del backend:

```bash
cd VirtualMedBackend
dotnet ef database update --project VirtualMed.Infrastructure --startup-project VirtualMed.Api
cd ..
```

Si falla, verifica que `POSTGRES_CONNECTION` en `.env` sea correcta y que Render permita conexiones externas.

### Paso 4 — Triggers de auditoría (SQL manual)

Ejecutar **una vez** el script `docs/audit_log_bd_triggers.sql` **en la misma base de datos** (después de las migraciones). No lo aplica EF Core; debes correrlo tú con un cliente PostgreSQL.

Ver detalle en [sección 7](#7-base-de-datos).

Ejemplo con `psql` (ajusta usuario, host y BD):

```bash
psql "postgresql://USUARIO:CONTRASEÑA@HOST.render.com:5432/NOMBRE_BD?sslmode=require" \
  -f docs/audit_log_bd_triggers.sql
```

En **Render**: Dashboard → PostgreSQL → **Connect** → pestaña **PSQL** o **External**, y pega/ejecuta el contenido del archivo.

### Paso 5 — Construir las imágenes Docker

Desde la carpeta `integrador/`:

```bash
docker compose build
```

La primera vez puede tardar **15–30 minutos** (descarga de imágenes base, `npm`, Python, .NET).

### Paso 6 — Levantar los servicios

```bash
docker compose up -d
```

Al arrancar, el **backend** ejecuta automáticamente la semilla de roles y permisos (`RolePermissionSeeder`). Ver [sección 7](#7-base-de-datos).

Comprobar que todos estén activos:

```bash
docker compose ps
```

Deberías ver 5 contenedores: `virtualmed-frontend`, `virtualmed-backend`, `virtualmed-chatbot`, `virtualmed-risk`, `virtualmed-minio`.

### Paso 7 — Verificar (ver [sección 9](#9-verificación))

---

## 6. Archivo `.env` completo

**Un solo archivo** en la raíz (`integrador/.env`) concentra secretos y URLs. Docker Compose, el backend (.NET) y el chatbot lo leen desde ahí. `appsettings.json` solo guarda estructura (Serilog, rate limits), **sin contraseñas**.

```bash
cp .env.example .env
```

Plantilla completa (ver también `.env.example` en el repo):

```env
# ── Base de datos ────────────────────────────────────────────────────────────
POSTGRES_CONNECTION="Host=<HOST>;Port=5432;Database=<BD>;Username=<USER>;Password=<PASS>;SSL Mode=Require;Trust Server Certificate=true"

# ── Backend (.NET) ─────────────────────────────────────────────────────────────
JWT_KEY=<CLAVE_SECRETA_MIN_32_CARACTERES>
ENCRYPTION_KEY=<CLAVE_CIFRADO_2FA>

# MinIO — documentos de registro médico (NO es el RAG)
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=virtualmed
MINIO_SECRET_KEY=VirtualMed123
MINIO_BUCKET=doctor-documents
MINIO_USE_SSL=false

# Twilio (videoconsulta WebRTC) — opcional en demo
TWILIO_ACCOUNT_SID=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=

# SendGrid (correo) — opcional
EMAIL_ENABLED=false
EMAIL_FROM=
EMAIL_FROM_NAME=VirtualMed
EMAIL_API_KEY=
EMAIL_FRONTEND_BASE_URL=http://localhost:3000

# Risk ML — solo relevante si corres backend sin Docker
RISK_PREDICTION_BASE_URL=http://localhost:8001

# ── Chatbot ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY=<TU_GEMINI_API_KEY>
NVIDIA_API_KEY=<TU_NVIDIA_API_KEY>
EMBED_MODEL=nvidia/llama-nemotron-embed-1b-v2
INTERNAL_API_KEY=virtualmed-internal-dev-key

# ── Frontend (se compilan en la imagen Docker) ────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:5045/api
NEXT_PUBLIC_WS_URL=ws://localhost:5045/hubs/video-chat
NEXT_PUBLIC_AI_URL=http://localhost:8000
NEXT_PUBLIC_CHATBOT_INTERNAL_API_KEY=virtualmed-internal-dev-key
```

### Tabla de variables

| Variable | Obligatoria | Quién la usa | Qué poner |
|----------|-------------|--------------|-----------|
| `POSTGRES_CONNECTION` | Sí | Backend | Cadena Npgsql con `SSL Mode=Require` (Render) |
| `JWT_KEY` | Sí | Backend | Texto secreto ≥ 32 caracteres |
| `ENCRYPTION_KEY` | Sí | Backend | Clave para cifrado 2FA |
| `MINIO_ENDPOINT` | Sí* | Backend | Docker: `minio:9000` · Local: `localhost:9000` |
| `MINIO_ACCESS_KEY` | Sí* | Backend + contenedor MinIO | Default demo: `virtualmed` |
| `MINIO_SECRET_KEY` | Sí* | Backend + contenedor MinIO | Default demo: `VirtualMed123` |
| `MINIO_BUCKET` | No | Backend | Default: `doctor-documents` |
| `MINIO_USE_SSL` | No | Backend | `false` en local/Docker |
| `GEMINI_API_KEY` | Sí | Chatbot | Google AI Studio |
| `NVIDIA_API_KEY` | Sí | Chatbot | NVIDIA Build |
| `INTERNAL_API_KEY` | Sí | Chatbot + frontend RAG | Misma clave en ambos lados |
| `NEXT_PUBLIC_*` | Sí | Frontend (build) | URLs **desde el navegador** (localhost, no nombres Docker) |

\* Obligatorio si usas registro de médicos con documento adjunto.

### Reglas importantes

1. **`INTERNAL_API_KEY` = `NEXT_PUBLIC_CHATBOT_INTERNAL_API_KEY`** — si no coinciden, el panel RAG responde **401**.

2. **`POSTGRES_CONNECTION` entre comillas dobles** — evita que Docker Compose corte la cadena.

3. **`MINIO_ENDPOINT` según el modo:**
   - **Docker Compose:** `minio:9000` (nombre del servicio en la red interna).
   - **`dotnet run` local** con MinIO en Docker: `localhost:9000`.

4. **Tras cambiar `NEXT_PUBLIC_*`**, reconstruir el frontend:

   ```bash
   docker compose build frontend && docker compose up -d frontend
   ```

5. **No subir `.env` a Git.**

---

## 7. Base de datos

Orden recomendado al instalar por **primera vez**:

```text
1. dotnet ef database update     → esquema (tablas, FK, audit_logs vacía)
2. audit_log_bd_triggers.sql     → triggers + índices de auditoría en PostgreSQL
3. docker compose up -d          → backend corre RolePermissionSeeder al iniciar
```

### Opción A — PostgreSQL en Render (recomendado para el equipo)

1. Crear instancia PostgreSQL en [Render](https://render.com).
2. Copiar **External Connection String** o armar la cadena manualmente.
3. Pegar en `POSTGRES_CONNECTION` del `.env`.
4. Ejecutar migraciones EF (paso 3 de instalación).
5. Ejecutar `docs/audit_log_bd_triggers.sql` en esa BD (paso 4).
6. Levantar Docker; la semilla de roles se aplica sola al arrancar el backend.

### Opción B — PostgreSQL local en Docker

1. Descomentar el servicio `postgres` en `docker-compose.yml`.
2. Cambiar `POSTGRES_CONNECTION`:

   ```env
   POSTGRES_CONNECTION="Host=postgres;Port=5432;Database=virtualmed;Username=virtualmed;Password=virtualmed123"
   ```

3. Ejecutar migraciones apuntando a localhost:5432.
4. Ejecutar `audit_log_bd_triggers.sql` contra esa BD.
5. `docker compose up -d`.

### Migraciones (Entity Framework Core)

Crea el esquema relacional (usuarios, citas, `audit_logs`, etc.):

```bash
cd VirtualMedBackend
dotnet ef database update --project VirtualMed.Infrastructure --startup-project VirtualMed.Api
```

Para generar una migración nueva (solo desarrollo):

```bash
dotnet ef migrations add NombreMigracion --project VirtualMed.Infrastructure --startup-project VirtualMed.Api
```

### Triggers de auditoría (`docs/audit_log_bd_triggers.sql`)

**Sí, debes ejecutarlo manualmente en PostgreSQL.** No forma parte de las migraciones EF.

El script es **idempotente** (`IF NOT EXISTS`, `CREATE OR REPLACE`): puedes re-ejecutarlo sin duplicar triggers.

| Qué hace | Detalle |
|----------|---------|
| Extensión | `pgcrypto` (si no existe) |
| Índices | Sobre `audit_logs` (`OccurredAt`, `TableName`, `RowPk`) |
| `UpdatedAt` | Triggers automáticos en tablas clínicas y RBAC |
| Auditoría | INSERT/UPDATE/DELETE → filas en `audit_logs` (JSON `OldData`/`NewData`) |

**Tablas auditadas:** `roles`, `permissions`, `role_permissions`, `appointments`, `clinical_encounters`, `diagnoses`, `prescriptions`, `medications`, `prescription_medications`, `video_sessions`, `video_chat_messages`.

**Notas:**

- La app puede setear `app.user_id` antes de cada `SaveChanges` para registrar quién hizo el cambio (interceptor del backend).
- En `video_sessions`, el token de sala (`RoomToken`) **no** se guarda en el log de auditoría (se redacta).

**Cómo ejecutarlo:**

```bash
# Desde la raíz del monorepo, con psql y URL de conexión
psql "postgresql://USUARIO:CONTRASEÑA@HOST:5432/BD?sslmode=require" \
  -f docs/audit_log_bd_triggers.sql
```

Alternativas: DBeaver, pgAdmin, consola SQL de Render, o `\i ruta/al/archivo.sql` dentro de `psql`.

**Comprobar que aplicó:**

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_%audit%'
ORDER BY event_object_table;
```

Deberías ver triggers en las tablas listadas arriba.

### Semilla de roles y permisos (`RolePermissionSeeder`)

**No hay que ejecutar un script SQL aparte.** La semilla corre **automáticamente** cada vez que el backend arranca (`Program.cs` → `SeedAsync()`).

Archivo: `VirtualMedBackend/VirtualMed.Infrastructure/Persistence/RolePermissionSeeder.cs`

| Qué hace | Detalle |
|----------|---------|
| Permisos | Inserta o actualiza el catálogo (`Patient:Read`, `Appointment:Create`, `AuditLog:Read`, etc.) |
| Roles | Asegura roles estándar: **Patient**, **Doctor**, **Specialist**, **Admin**, **FamilyMember** |
| Asignación | Sincroniza permisos por rol (p. ej. Admin → `AuditLog:Read`, `Doctor:Approve`, gestión de usuarios) |
| Idempotente | Si ya existen, actualiza descripciones y re-sincroniza enlaces rol–permiso |

Si la BD no está disponible al iniciar, la API **sigue levantándose** y deja un warning en logs; al conectar la BD, reinicia el backend:

```bash
docker compose restart backend
```

**Importante:** la semilla **no crea usuarios de prueba** (no hay admin/contraseña por defecto). Debes **registrar** usuarios por la app o insertarlos manualmente. Los permisos del JWT dependen del rol asignado en `users`.

**Panel RAG admin:** el frontend valida acceso por rol **Admin** (no requiere permiso `RagDocument:*` en BD, porque el chatbot es independiente del backend).

### Usuarios y acceso inicial

1. Ejecutar migraciones + triggers SQL + levantar backend (semilla de roles).
2. Registrar un usuario (paciente, médico o admin según flujo de la app).
3. Para admin: usar un usuario con rol **Admin** (asignación manual en BD o flujo de registro del equipo).
4. Cerrar sesión y volver a entrar si cambiaste roles/permisos (el JWT cachea claims al login).

---

## 8. MinIO (documentos de médicos)

MinIO es el almacén de objetos (compatible S3) donde el backend guarda el **PDF de soporte** que adjunta un médico al registrarse. El bucket se crea automáticamente en el primer upload.

### Qué NO es MinIO en este proyecto

| Almacén | Uso | Dónde vive |
|---------|-----|------------|
| **MinIO** | Documento de registro médico | Contenedor `virtualmed-minio`, volumen `minio_data` |
| **Carpeta `data/` + Chroma** | Corpus RAG del chatbot | `chatbot-virtualmed/data/` y `chroma_db/` |

### Con Docker Compose (incluido)

El servicio `minio` ya está en `docker-compose.yml`. Credenciales por defecto (demo):

| Campo | Valor |
|-------|-------|
| API | http://localhost:9000 |
| Consola web | http://localhost:9001 |
| Usuario | `virtualmed` (=`MINIO_ACCESS_KEY`) |
| Contraseña | `VirtualMed123` (=`MINIO_SECRET_KEY`) |
| Bucket | `doctor-documents` |

Pasos para comprobar:

1. `docker compose up -d`
2. Abrir http://localhost:9001 e iniciar sesión con las credenciales del `.env`.
3. Tras un registro de médico con PDF, ver objetos en el bucket `doctor-documents`.

### Variables en `.env`

```env
MINIO_ENDPOINT=minio:9000      # Docker Compose
MINIO_ACCESS_KEY=virtualmed
MINIO_SECRET_KEY=VirtualMed123
MINIO_BUCKET=doctor-documents
MINIO_USE_SSL=false
```

Docker Compose sincroniza `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` con el contenedor MinIO (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`).

### Desarrollo sin Docker (backend local)

Si corres `dotnet run` pero MinIO sigue en Docker:

```env
MINIO_ENDPOINT=localhost:9000
```

Si no levantas MinIO, el backend **arranca** pero fallará al registrar un médico con documento adjunto.

---

## 9. Verificación

### Comprobar servicios

| URL | Respuesta esperada |
|-----|-------------------|
| http://localhost:3000 | Pantalla de login VirtualMed |
| http://localhost:5045/health | Texto `Healthy` |
| http://localhost:5045/swagger | Documentación Swagger API |
| http://localhost:8000/health | `{"status":"ok"}` |
| http://localhost:8000/docs | Swagger del chatbot |
| http://localhost:8001/health | `{"status":"ok","model_version":"v1"}` |
| http://localhost:9000/minio/health/live | HTTP 200 (MinIO API) |
| http://localhost:9001 | Consola MinIO (login con `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`) |

### Comprobar contenedores

```bash
docker compose ps
docker compose logs -f chatbot
docker compose logs -f backend
```

### Comprobar variables en backend

```bash
docker compose exec backend printenv ConnectionStrings__DefaultConnection
```

Debe mostrar la cadena con `SSL Mode=Require`.

### Prueba funcional

1. **Login** con usuario admin o paciente.
2. **Chat paciente** (`/dashboard/patient/chat`): enviar pregunta → respuesta del asistente.
3. **RAG admin** (`/dashboard/admin/rag-documents`): subir PDF → aparece en tabla y en `chatbot-virtualmed/data/`.

---

## 10. Uso de la aplicación

### URLs principales (tras login)

| Rol | Función | Ruta |
|-----|---------|------|
| Paciente | Chat asistente | `/dashboard/patient/chat` |
| Admin | Base RAG (PDFs) | `/dashboard/admin/rag-documents` |
| Admin | Dashboard | `/dashboard/admin` |

### Panel RAG (admin)

- Arrastra o selecciona PDFs (máx. 20 MB).
- Se indexan **uno a la vez** (cola secuencial).
- Los archivos quedan en `chatbot-virtualmed/data/`.
- El índice vectorial persiste en `chatbot-virtualmed/chroma_db/`.

### Chat paciente

- Conversación con memoria por sesión (`session_id` en el chatbot).
- Historial guardado en **localStorage** del navegador (no en PostgreSQL).

---

## 11. Instalación sin Docker (desarrollo)

Útil para depurar un servicio aislado. Usa el **mismo `.env` raíz**; el backend lo carga automáticamente (DotNetEnv).

### Terminal 1 — MinIO (si no usas Docker para el resto)

```bash
docker run -d --name virtualmed-minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=virtualmed -e MINIO_ROOT_PASSWORD=VirtualMed123 \
  minio/minio server /data --console-address ":9001"
```

En `.env`: `MINIO_ENDPOINT=localhost:9000`.

### Terminal 2 — Chatbot

```bash
cd chatbot-virtualmed
python -m venv .venv
source .venv/Scripts/activate    # Windows Git Bash
pip install -r requirements.txt
# Variables desde integrador/.env (exportar GEMINI_API_KEY, NVIDIA_API_KEY, INTERNAL_API_KEY)
uvicorn api.main:app --reload --port 8000
```

### Terminal 3 — Risk ML

```bash
cd virtualmed-risk-prediction
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Terminal 4 — Backend

```bash
cd VirtualMedBackend/VirtualMed.Api
dotnet run --launch-profile http
```

API en `http://localhost:5045`. Asegúrate de tener `MINIO_ENDPOINT=localhost:9000` y `RISK_PREDICTION_BASE_URL=http://localhost:8001` en el `.env` raíz.

### Terminal 5 — Frontend

Desde la raíz del monorepo:

```bash
bash scripts/sync-frontend-env.sh   # Windows: powershell -File scripts/sync-frontend-env.ps1
cd VirtualMed_Frontend
npm install
npm run dev
```

App en `http://localhost:3000`.

---

## 12. Despliegue en otra máquina

Para demo en LAN o servidor:

1. Clonar repo y configurar `.env` con **su** PostgreSQL y API keys.
2. Cambiar URLs **accesibles desde el navegador del cliente**:

   ```env
   NEXT_PUBLIC_API_URL=http://192.168.1.100:5045/api
   NEXT_PUBLIC_WS_URL=ws://192.168.1.100:5045/hubs/video-chat
   NEXT_PUBLIC_AI_URL=http://192.168.1.100:8000
   ```

3. Abrir firewall: puertos **3000**, **5045**, **8000**.
4. `docker compose build && docker compose up -d`.
5. Actualizar CORS del backend si el frontend no es `http://localhost:3000`.

---

## 13. Solución de problemas

### Registro médico: error MinIO / backend no arranca

- Mensaje `MinIO 'Endpoint' no configurado` → falta `MINIO_ENDPOINT` en `.env`.
- Con Docker: usar `MINIO_ENDPOINT=minio:9000`, no `localhost:9000`.
- Con `dotnet run` local: usar `MINIO_ENDPOINT=localhost:9000` y tener MinIO corriendo.
- Verificar contenedor: `docker compose ps minio` y logs `docker compose logs minio`.
- Consola: http://localhost:9001 con las credenciales del `.env`.

### Login: `SSL/TLS required` o error 500

- Falta `SSL Mode=Require` en `POSTGRES_CONNECTION`.
- Usar comillas dobles en toda la cadena en `.env`.
- Reiniciar: `docker compose up -d backend`.

### Frontend: `Network Error` / connection refused

- Backend no está corriendo: `docker compose ps`.
- `NEXT_PUBLIC_API_URL` debe ser `http://localhost:5045/api` (con Docker).

### Chat no responde

- Chatbot caído: `docker compose logs chatbot`.
- Verificar `NEXT_PUBLIC_AI_URL=http://localhost:8000`.
- Probar: `curl http://localhost:8000/health`.

### RAG admin: 401 API key inválida

- `INTERNAL_API_KEY` ≠ `NEXT_PUBLIC_CHATBOT_INTERNAL_API_KEY`.
- Reconstruir frontend tras corregir.

### RAG admin: 409 duplicado

- Ya existe un PDF con ese nombre en `data/`.

### Docker build: `auth.docker.io: no such host`

- Problema de DNS/red. Reiniciar Docker Desktop o cambiar DNS a 8.8.8.8.

### Docker build frontend: error `/app/public`

- Resuelto en Dockerfile con `mkdir -p public`.

### Puerto 8000 ocupado

- Detener contenedor viejo: `docker stop chatbot-backend`.
- O proceso local: `netstat -ano | findstr :8000` → `taskkill /PID <id> /F`.

### Auditoría vacía o sin registros en `audit_logs`

- ¿Ejecutaste `docs/audit_log_bd_triggers.sql` **después** de las migraciones?
- Comprueba triggers: consulta `information_schema.triggers` (ver [sección 7](#7-base-de-datos)).
- Los cambios hechos **antes** de instalar triggers no se auditan retroactivamente.

### No aparece zona de subida PDF (admin)

- Usuario debe ser **Admin**.
- Cerrar sesión y volver a entrar si faltan permisos en el JWT.

---

## 14. Qué compartir del proyecto

| Compartir (Git) | No compartir |
|-----------------|--------------|
| Código fuente | Archivo `.env` |
| `docker-compose.yml` | API keys reales |
| `.env.example` | Contraseñas de BD |
| `Dockerfile` de cada servicio | |
| Este manual | |

Cada persona que instale debe:

1. Clonar el repo.
2. Copiar `.env.example` → `.env`.
3. Poner **su** cadena PostgreSQL y **sus** API keys.
4. Ejecutar `docker compose build && docker compose up -d`.

---

## 15. Resumen para sustentación

1. **Arquitectura de microservicios**: frontend Next.js, backend .NET, chatbot Python (RAG), servicio ML Python, MinIO para documentos clínicos de registro.
2. **Docker Compose** permite levantar todo con un comando reproducible.
3. **Un solo `.env`** centraliza secretos; `appsettings.json` solo estructura.
4. **Desacoplamiento RAG**: PDFs del chatbot en disco (`data/`) + Chroma; frontend habla directo con FastAPI.
5. **MinIO** almacena documentos de soporte del registro médico (distinto del corpus RAG).
6. **Backend** centraliza negocio clínico (auth, citas, videoconsulta, riesgo CV) y PostgreSQL.
7. **Auditoría en BD:** migraciones EF + script SQL de triggers + semilla automática de RBAC al arrancar.
8. **Persistencia**: BD relacional + volúmenes Docker (MinIO, corpus RAG).

---

## Comandos de referencia rápida

```bash
# Instalación completa
cp .env.example .env
# (editar .env)
cd VirtualMedBackend && dotnet ef database update --project VirtualMed.Infrastructure --startup-project VirtualMed.Api && cd ..
psql "postgresql://USUARIO:PASS@HOST:5432/BD?sslmode=require" -f docs/audit_log_bd_triggers.sql
docker compose build
docker compose up -d

# Día a día
docker compose ps
docker compose logs -f
docker compose down
docker compose up -d --build

# Solo frontend tras cambiar NEXT_PUBLIC_*
docker compose build frontend && docker compose up -d frontend
```

---

*VirtualMed — Manual de instalación. Proyecto integrador.*
