"""Seguridad para endpoints internos de administracion RAG."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()


def verify_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-Api-Key"),
) -> None:
    """Valida la API key compartida con VirtualMedBackend."""
    if not INTERNAL_API_KEY:
        return

    if not x_internal_api_key or x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key interna invalida.",
        )
