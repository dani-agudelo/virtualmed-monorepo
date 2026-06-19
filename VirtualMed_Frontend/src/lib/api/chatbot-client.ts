import axios, { AxiosInstance } from 'axios';

export const CHATBOT_BASE_URL =
  process.env.NEXT_PUBLIC_AI_URL?.replace(/\/$/, '') || 'http://localhost:8000';

/** Clave para endpoints RAG admin (/ingest/*). Solo demo; en producción usar proxy autenticado. */
export const CHATBOT_INTERNAL_API_KEY =
  process.env.NEXT_PUBLIC_CHATBOT_INTERNAL_API_KEY?.trim() ||
  'virtualmed-internal-dev-key';

export function createChatbotClient(options?: {
  json?: boolean;
  timeoutMs?: number;
  withInternalKey?: boolean;
}): AxiosInstance {
  const json = options?.json ?? true;
  const withInternalKey = options?.withInternalKey ?? false;

  return axios.create({
    baseURL: CHATBOT_BASE_URL,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(withInternalKey
        ? { 'X-Internal-Api-Key': CHATBOT_INTERNAL_API_KEY }
        : {}),
    },
    timeout: options?.timeoutMs ?? 120_000,
  });
}

export function extractChatbotErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (error.code === 'ERR_NETWORK') {
    return `No se pudo conectar con el chatbot (${CHATBOT_BASE_URL}). Verifica que esté en ejecución.`;
  }

  const data = error.response?.data as { detail?: unknown; message?: string } | undefined;

  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.message === 'string') return data.message;

  return error.message || fallback;
}
