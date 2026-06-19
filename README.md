# VirtualMed — Proyecto integrador

Monorepo: frontend, backend .NET, chatbot RAG y servicio de riesgo cardiovascular.

## Configuración (un solo `.env`)

Todos los secretos y URLs viven en **`.env` en la raíz** del monorepo (no subir a Git).

```bash
cp .env.example .env
# Completar POSTGRES_CONNECTION, GEMINI_API_KEY, NVIDIA_API_KEY, etc.
```

| Consumidor | Cómo lee el `.env` |
|------------|-------------------|
| **Docker Compose** | `env_file: .env` + mapeo a variables ASP.NET |
| **Backend local** (`dotnet run`) | DotNetEnv busca `.env` subiendo carpetas desde `VirtualMed.Api` |
| **Chatbot local** | Mismo `.env` raíz si lo exportas, o Docker |
| **Frontend local** | `bash scripts/sync-frontend-env.sh` → `.env.local` |

`appsettings.json` solo tiene estructura (Serilog, rate limits, JWT issuer). **No poner contraseñas ahí.**

## Inicio rápido con Docker

```bash
cp .env.example .env
# Completar POSTGRES_CONNECTION, GEMINI_API_KEY, NVIDIA_API_KEY

cd VirtualMedBackend
dotnet ef database update --project VirtualMed.Infrastructure --startup-project VirtualMed.Api
cd ..

docker compose build
docker compose up -d
```

| Servicio | URL |
|----------|-----|
| App | http://localhost:3000 |
| API | http://localhost:5045/swagger |
| Chatbot | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

**Manual completo:** [docs/MANUAL_DE_INSTALACION.md](docs/MANUAL_DE_INSTALACION.md)

## Arquitectura

```
Navegador
  ├─ :3000  Frontend
  ├─ :5045  Backend (.NET) → PostgreSQL, Risk ML, MinIO
  └─ :8000  Chatbot (FastAPI) → chat paciente + panel RAG admin
```

MinIO (:9000/:9001) guarda PDFs del **registro médico**. El RAG del chatbot usa `chatbot-virtualmed/data/`.

El **chatbot** lo consume el frontend directamente (chat y subida de PDFs). El backend no interviene en RAG.

## Carpetas

| Carpeta | Descripción |
|---------|-------------|
| `VirtualMed_Frontend` | Next.js |
| `VirtualMedBackend` | API .NET |
| `chatbot-virtualmed` | RAG (LlamaIndex + Chroma) |
| `virtualmed-risk-prediction` | ML riesgo cardiovascular |
