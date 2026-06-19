"""Limpieza de texto de respuesta del asistente."""

from __future__ import annotations

import re

_FUENTES_SECTION_PATTERN = re.compile(
    r"\n\s*\*{0,2}Fuentes\*{0,2}\s*:.*\Z",
    flags=re.IGNORECASE | re.DOTALL,
)

_INLINE_SOURCE_CITATION_PATTERN = re.compile(
    r"\s*\((?:Seg[úu]n el (?:archivo|documento)[^)]*)\)\s*",
    flags=re.IGNORECASE,
)

_LEADING_SOURCE_INTRO_PATTERN = re.compile(
    r"^(?:Seg[úu]n (?:los documentos|el contexto|la informaci[óo]n recuperada)[^,:\n]*[,:]?\s*)",
    flags=re.IGNORECASE | re.MULTILINE,
)

_MULTI_SPACE_PATTERN = re.compile(r"[ \t]{2,}")
_EXTRA_NEWLINES_PATTERN = re.compile(r"\n{3,}")


def clean_answer_text(answer: str) -> str:
    """Elimina citas inline y secciones de fuentes del texto generado.

    Las fuentes se devuelven por separado en el campo ``sources`` de la API.

    Args:
        answer: Texto crudo del LLM.

    Returns:
        str: Respuesta lista para mostrar al usuario.
    """
    text = answer.strip()
    if not text:
        return text

    text = _FUENTES_SECTION_PATTERN.sub("", text)
    text = _INLINE_SOURCE_CITATION_PATTERN.sub(" ", text)
    text = _LEADING_SOURCE_INTRO_PATTERN.sub("", text)
    text = _MULTI_SPACE_PATTERN.sub(" ", text)
    text = _EXTRA_NEWLINES_PATTERN.sub("\n\n", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)

    return text.strip()
