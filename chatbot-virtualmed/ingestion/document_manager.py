"""Gestion de documentos PDF del corpus RAG."""

from __future__ import annotations

import logging
import re
import threading
from pathlib import Path

from llama_index.core.schema import Document

from config import DATA_DIR, MAX_CHUNKS_PER_INGEST, MAX_PDF_PAGES
from ingestion.loader import list_pdf_files, load_pdf_documents_from_paths
from ingestion.node_parsers import get_sentence_splitter
from ingestion.pipeline import enrich_node_metadata, run_ingestion_pipeline
from storage.chroma_store import get_or_create_collection
from storage.index_store import get_vector_store

logger = logging.getLogger(__name__)

_INGEST_LOCK = threading.Lock()

_FILENAME_SAFE_PATTERN = re.compile(r"[^a-zA-Z0-9._-]+")


def normalize_file_name(file_name: str) -> str:
    """Normaliza el nombre de archivo para comparacion de duplicados."""
    return Path(file_name).name.strip().lower()


def sanitize_file_name(file_name: str) -> str:
    """Sanitiza el nombre de archivo conservando la extension .pdf."""
    raw_name = Path(file_name).name.strip()
    if not raw_name:
        raise ValueError("El nombre del archivo es invalido.")

    stem = Path(raw_name).stem
    cleaned_stem = _FILENAME_SAFE_PATTERN.sub("_", stem).strip("._")
    if not cleaned_stem:
        cleaned_stem = "documento"

    return f"{cleaned_stem}.pdf"


def document_exists(file_name: str) -> bool:
    """Indica si ya existe un PDF con el mismo nombre normalizado."""
    target = normalize_file_name(file_name)
    return any(normalize_file_name(path.name) == target for path in list_pdf_files())


def save_uploaded_pdf(file_name: str, content: bytes) -> Path:
    """Guarda un PDF en el directorio de datos."""
    if document_exists(file_name):
        raise ValueError(
            f"Ya existe un documento con el nombre '{sanitize_file_name(file_name)}'."
        )

    safe_name = sanitize_file_name(file_name)
    destination = DATA_DIR / safe_name
    destination.write_bytes(content)
    return destination


def _count_pdf_pages(file_path: Path) -> int:
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        return len(reader.pages)
    except Exception as exc:
        raise ValueError(f"No se pudo leer el PDF: {exc}") from exc


def _validate_pdf_limits(file_path: Path) -> int:
    page_count = _count_pdf_pages(file_path)
    if page_count > MAX_PDF_PAGES:
        raise ValueError(
            f"El PDF tiene {page_count} paginas. Maximo permitido: {MAX_PDF_PAGES}."
        )

    documents = load_pdf_documents_from_paths([file_path])
    preview_nodes = get_sentence_splitter().get_nodes_from_documents(documents)
    if len(preview_nodes) > MAX_CHUNKS_PER_INGEST:
        raise ValueError(
            f"El PDF genera demasiados fragmentos ({len(preview_nodes)}). "
            f"Maximo permitido: {MAX_CHUNKS_PER_INGEST}."
        )
    return len(preview_nodes)


def ingest_pdf_path(file_path: Path) -> tuple[list[Document], list]:
    """Indexa un PDF ya persistido en data/."""
    if not _INGEST_LOCK.acquire(blocking=True, timeout=600):
        raise RuntimeError("No fue posible iniciar la indexacion (timeout de cola).")

    try:
        _validate_pdf_limits(file_path)
        vector_store = get_vector_store()
        documents = load_pdf_documents_from_paths([file_path])
        nodes = run_ingestion_pipeline(documents, vector_store=vector_store)
        enriched_nodes = enrich_node_metadata(nodes, documents)
        return documents, enriched_nodes
    finally:
        _INGEST_LOCK.release()


def ingest_uploaded_pdf(file_name: str, content: bytes) -> dict[str, int | str]:
    """Guarda e indexa un PDF subido."""
    destination = save_uploaded_pdf(file_name, content)
    try:
        documents, nodes = ingest_pdf_path(destination)
        return {
            "file_name": destination.name,
            "indexed_documents": len(documents),
            "indexed_nodes": len(nodes),
        }
    except Exception:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise


def _count_nodes_for_file(file_name: str) -> int:
    collection = get_or_create_collection()
    try:
        result = collection.get(where={"file_name": file_name}, include=[])
        ids = result.get("ids") or []
        return len(ids)
    except Exception:
        return 0


def list_indexed_documents() -> list[dict[str, int | str]]:
    """Lista PDFs en data/ con conteo de nodos indexados."""
    documents: list[dict[str, int | str]] = []
    for path in list_pdf_files():
        documents.append(
            {
                "file_name": path.name,
                "indexed_nodes": _count_nodes_for_file(path.name),
                "file_size_bytes": path.stat().st_size,
            }
        )
    return documents


def delete_document(file_name: str) -> bool:
    """Elimina un PDF del disco, docstore/Chroma via re-ingest strategy."""
    safe_name = sanitize_file_name(file_name)
    file_path = DATA_DIR / safe_name

    if not file_path.exists():
        raise FileNotFoundError(f"No se encontro el documento '{safe_name}'.")

    collection = get_or_create_collection()
    try:
        result = collection.get(where={"file_name": safe_name}, include=[])
        ids = result.get("ids") or []
        if ids:
            collection.delete(ids=ids)
    except Exception as exc:
        logger.warning("event=chroma_delete_failed file_name=%s error=%s", safe_name, exc)

    file_path.unlink(missing_ok=True)

    # Re-sincroniza docstore persistido eliminando referencias obsoletas en el proximo ingest.
    from ingestion.pipeline import get_docstore
    from config import DOCSTORE_PATH

    docstore = get_docstore()
    doc_ids = [doc_id for doc_id in docstore.docs.keys() if safe_name in str(doc_id)]
    for doc_id in doc_ids:
        docstore.delete_document(doc_id, raise_error=False)
    docstore.persist(str(DOCSTORE_PATH))

    return True
