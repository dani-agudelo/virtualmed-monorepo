"""Punto de entrada FastAPI para endpoints de ingestion y chat."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    ChatRequest,
    ChatResponse,
    DeleteDocumentResponse,
    IngestResponse,
    IngestUploadResponse,
    RagDocumentItem,
)
from api.security import verify_internal_api_key
from config import CHROMA_COLLECTION, MAX_UPLOAD_BYTES, configure_settings
from generation.query_engine import get_chat_engine
from generation.response_formatter import clean_answer_text
from ingestion.document_manager import (
    delete_document,
    ingest_uploaded_pdf,
    list_indexed_documents,
    sanitize_file_name,
)
from ingestion.pipeline import (
    load_and_prepare_nodes,
)
from retrieval.postprocessor import extract_source_metadata
from storage.index_store import get_vector_store

logger = logging.getLogger(__name__)

OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Estado de la API",
    },
    {
        "name": "ingestion",
        "description": "Carga e indexacion de documentos en ChromaDB.",
    },
    {
        "name": "chat",
        "description": "Consultas conversacionales con RAG y citas de fuentes.",
    },
]

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Inicializa las dependencias de la app una vez por inicio del proceso."""
    configure_settings()
    logger.info("event=startup chroma_collection=%s collection_ready=true", CHROMA_COLLECTION)
    yield

app = FastAPI(
    title="VirtualMed RAG API",
    description="Servicio RAG soportado por LlamaIndex y ChromaDB.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/swagger",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=OPENAPI_TAGS,
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "tryItOutEnabled": True,
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Devuelve el estado de la API.

    Returns:
        dict[str, str]: Estado de la API.
    """
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse, tags=["ingestion"])
def ingest_documents() -> IngestResponse:
    """Ingesta documentos usando IngestionPipeline + IngestionCache.

    Returns:
        IngestResponse: Metricas de ingestion para documentos e indices.

    Raises:
        HTTPException: Si la ingestion falla o no hay documentos disponibles.
    """
    ingest_started = time.perf_counter()
    try:
        load_started = time.perf_counter()
        vector_store = get_vector_store(collection_name=CHROMA_COLLECTION)
        vector_store_ready_seconds = time.perf_counter() - load_started
        
        pipeline_started = time.perf_counter()
        documents, nodes = load_and_prepare_nodes(vector_store=vector_store)
        pipeline_seconds = time.perf_counter() - pipeline_started
        total_documents = len(documents)
        total_seconds = time.perf_counter() - ingest_started

        logger.info(
            "event=ingest_complete collection=%s documents=%s nodes=%s "
            "vector_store_ready_seconds=%.3f pipeline_seconds=%.3f total_seconds=%.3f",
            CHROMA_COLLECTION,
            total_documents,
            len(nodes),
            vector_store_ready_seconds,
            pipeline_seconds,
            total_seconds,
        )
        return IngestResponse(
            indexed_documents=total_documents,
            indexed_nodes=len(nodes),
            total_documents=total_documents,
            collection_name=CHROMA_COLLECTION,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc


@app.post(
    "/ingest/upload",
    response_model=IngestUploadResponse,
    tags=["ingestion"],
    dependencies=[Depends(verify_internal_api_key)],
)
async def ingest_upload(file: UploadFile = File(...)) -> IngestUploadResponse:
    """Indexa un PDF subido por el backend de VirtualMed."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo PDF esta vacio.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo supera el maximo de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        result = ingest_uploaded_pdf(file.filename, content)
        return IngestUploadResponse(
            file_name=str(result["file_name"]),
            indexed_documents=int(result["indexed_documents"]),
            indexed_nodes=int(result["indexed_nodes"]),
            collection_name=CHROMA_COLLECTION,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "Ya existe" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc


@app.get(
    "/ingest/documents",
    response_model=list[RagDocumentItem],
    tags=["ingestion"],
    dependencies=[Depends(verify_internal_api_key)],
)
def list_documents() -> list[RagDocumentItem]:
    """Lista documentos PDF indexados."""
    items = list_indexed_documents()
    return [RagDocumentItem(**item) for item in items]


@app.delete(
    "/ingest/documents/{file_name}",
    response_model=DeleteDocumentResponse,
    tags=["ingestion"],
    dependencies=[Depends(verify_internal_api_key)],
)
def remove_document(file_name: str) -> DeleteDocumentResponse:
    """Elimina un PDF del corpus y sus vectores asociados."""
    safe_name = sanitize_file_name(file_name)
    try:
        delete_document(safe_name)
        return DeleteDocumentResponse(
            file_name=safe_name,
            deleted=True,
            message="Documento eliminado correctamente.",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}") from exc


@app.post("/chat", response_model=ChatResponse, tags=["chat"])
def chat(request: ChatRequest) -> ChatResponse:
    """Responde una pregunta del usuario usando RAG.

    Args:
        request: Cuerpo de solicitud de chat del usuario.

    Returns:
        ChatResponse: Respuesta del asistente y fuentes extraidas.

    Raises:
        HTTPException: Si la operacion de chat falla.
    """
    started = time.perf_counter()
    try:
        chat_engine = get_chat_engine(
            session_id=request.session_id,
            similarity_top_k=request.similarity_top_k,
        )
        response = chat_engine.chat(request.message)
        sources = extract_source_metadata(getattr(response, "source_nodes", None))
        answer = clean_answer_text(str(response.response))
        total_seconds = time.perf_counter() - started
        logger.info(
            "event=chat_complete session_id=%s top_k=%s sources=%s latency_seconds=%.3f",
            request.session_id,
            request.similarity_top_k,
            len(sources),
            total_seconds,
        )
        return ChatResponse(answer=answer, sources=sources)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc
